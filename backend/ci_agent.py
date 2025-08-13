# ci_agent.py
import os, shutil, subprocess, shlex, tempfile, json, stat, base64
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
from .checkout import CodeCheckoutManager, CheckoutConfig
import boto3
import docker
from . import ci_scan
from .llm_service import create_failure_analyzer_chain
from typing import Optional, Dict, Any
from . import db
import time
from datetime import datetime

logger = logging.getLogger(__name__)

class CIAgent:
    def __init__(self, build_id: str, config: Dict[str, Any], env_variables: Optional[Dict[str, str]] = None):
        self.build_id = build_id
        self.config = config
        self.repo_url = config['repo_url']
        self.branch = config.get("branch", "main")
        self.aws_creds = config.get('aws_credentials')

        if not self.aws_creds:
            raise ValueError("AWS credentials are required but were not provided in the configuration.")

        self.region = self.aws_creds.get('region')
        self.ecr_repo = config.get("ecr_repo")

        # Use explicit credentials from config, not from environment
        self.ecr_client = boto3.client(
            'ecr',
            region_name=self.region,
            aws_access_key_id=self.aws_creds.get('aws_access_key_id'),
            aws_secret_access_key=self.aws_creds.get('aws_secret_access_key')
        )
        self.account = None  # Will be fetched later
        self.docker_client = docker.from_env()
        self.failure_analyzer_chain = create_failure_analyzer_chain()
        self.env_variables = env_variables or {}
        
        # Security scan tools configuration (user-defined)
        self.scan_tools = config.get("scan_tools", {})
        self.local_dir = None  # Will be set during checkout

        # Configure a specific logger for this build
        self.logger = logging.getLogger(f"CI-Agent-{self.build_id}")
        handler = logging.StreamHandler()
        formatter = logging.Formatter(f'%(asctime)s - CI-Agent[{self.build_id}] - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        if not self.logger.handlers:
            self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def _update_stage_status(self, name: str, status: str, logs: str = ""):
        """Helper to update the status of a stage in the database."""
        build = db.get_build_by_id(self.build_id)
        if not build:
            return

        stages = build.get('stages', [])
        stage_found = False
        for stage in stages:
            if stage['name'] == name:
                stage['status'] = status
                stage['logs'] += logs
                if status in ['success', 'failed']:
                    stage['endTime'] = datetime.now().isoformat()
                stage_found = True
                break
        
        if not stage_found:
            stages.append({
                "name": name,
                "status": status,
                "startTime": datetime.now().isoformat(),
                "endTime": None,
                "logs": logs
            })

        db.update_build(self.build_id, {"stages": stages})

    def _execute_stage(self, name: str, command: list, cwd: str):
        """Executes a command for a stage and updates the DB with status and logs.
        Returns None on success, or the error logs as a string on failure.
        """
        logs = f"--- Running stage: {name} ---\n"
        logs += f"$ {' '.join(command)}\n"
        self._update_stage_status(name, 'running', logs)
        
        try:
            process = subprocess.run(
                command, 
                cwd=cwd, 
                capture_output=True, 
                text=True, 
                check=True,
                shell=False,
                env={**os.environ, **self.env_variables}
            )
            logs += process.stdout
            self._update_stage_status(name, 'success', logs)
            return None # Success
        except subprocess.CalledProcessError as e:
            error_logs = e.stdout + e.stderr
            logs += error_logs
            self._update_stage_status(name, 'failed', logs)
            self.logger.error(f"Stage '{name}' failed with exit code {e.returncode}.")
            return logs # Failure, return logs
        except Exception as e:
            error_logs = str(e)
            logs += error_logs
            self._update_stage_status(name, 'failed', logs)
            self.logger.error(f"Stage '{name}' failed with an unexpected exception.", exc_info=True)
            return logs # Failure, return logs
    def handle_remove_readonly(self, func, path, exc):
        os.chmod(path, stat.S_IWRITE)
        func(path)

    def run(self):
        """Main entry point for the CI agent."""
        self.logger.info(f"Starting CI pipeline for {self.repo_url}")
        try:
            # Stage 1: Checkout Code
            self.logger.info("Stage 1: Starting checkout...")
            self._update_stage_status("Checkout", "running")
            if self.local_dir and os.path.exists(self.local_dir):
                shutil.rmtree(self.local_dir, onerror=self.handle_remove_readonly)
            config = CheckoutConfig(repo_url=self.repo_url, branch=self.branch)
            manager = CodeCheckoutManager()
            self.local_dir = manager.checkout_code(config)
            self.logger.info(f"Checkout successful: {self.local_dir}")
            self._update_stage_status("Checkout", "success", f"Successfully cloned {self.repo_url} to {self.local_dir}\n")

            # Stage 2: Identify Language
            self.logger.info("Stage 2: Identifying language...")
            self._update_stage_status("Setup", "running", "Identifying project language...\n")
            build_tool = self.identify_language()
            self.logger.info(f"Language detected: {build_tool}")
            self._update_stage_status("Setup", "success", f"Language identified: {build_tool}\n")

            # Stage 3: Run Tests
            self.logger.info(f"Stage 3: Running tests for {build_tool}...")
            if build_tool in ["maven", "gradle", "python"]:
                test_command = {"maven": ["mvn", "test"], "gradle": ["./gradlew", "test"], "python": ["pytest"]}[build_tool]
                self.logger.info(f"Executing test command: {' '.join(test_command)}")
                if self._execute_stage("Test", test_command, self.local_dir) is not None:
                    return None # Stop pipeline on failure
            else:
                self.logger.warning(f"Skipping tests: Unknown build tool ({build_tool})")
                self._update_stage_status("Test", "success", "Skipping tests: Unknown build tool.\n")

            # Stage 4: Security Scans
            self.logger.info("Stage 4: Running security scans...")
            self._run_security_scans()

            # Stage 5: Build Artifact
            self.logger.info(f"Stage 5: Building artifacts for {build_tool}...")
            if build_tool in ["maven", "gradle"]:
                build_command = {"maven": ["mvn", "package"], "gradle": ["./gradlew", "build"]}[build_tool]
                self.logger.info(f"Executing build command: {' '.join(build_command)}")
                if self._execute_stage("Build", build_command, self.local_dir) is not None:
                    return None # Stop pipeline on failure
            else:
                self.logger.info(f"Skipping artifact build: Not required for {build_tool}")
                self._update_stage_status("Build", "success", "Skipping artifact build: Not required for this project type.\n")

            # Stage 6: Build and Push Docker Image
            self.logger.info("Stage 6: Building and pushing Docker image...")
            image_uri = self._build_and_push_docker()
        
            self.logger.info(f"CI Pipeline completed successfully! Image: {image_uri}")
            db.update_build(self.build_id, {"status": "success"})
            return image_uri

        except Exception as e:
            error_message = f"An unexpected error occurred in the CI agent: {str(e)}"
            self.logger.error(f"PIPELINE FAILED: {error_message}", exc_info=True)
            db.update_build(self.build_id, {"status": "failed", "message": error_message})
            self.logger.info("Starting LLM failure analysis...")
            self.analyze_failure(error_message)
            return None

    def identify_language(self):
        for root, dirs, files in os.walk(self.local_dir):
            if 'pom.xml' in files:
                self.local_dir = root  # Update local_dir to the project root
                return "maven"
            if 'build.gradle' in files:
                self.local_dir = root
                return "gradle"
            if 'requirements.txt' in files:
                self.local_dir = root
                return "python"
        return "unknown"

    def _run_security_scans(self):
        self._update_stage_status("Scan", "running")
        logs = ""
        had_errors = False
        
        if not self.scan_tools:
            self.logger.info("No security scan tools configured. Skipping.")
            self._update_stage_status("Scan", "success", logs)
            return

        for tool, params in self.scan_tools.items():
            self.logger.info(f"Running scan tool: {tool}")
            scanner = ci_scan.CodeScanner(self.local_dir)
            scan_results = scanner.run_scans({tool: params})
            if not scan_results:
                logs += "No security scan tools configured. Skipping scan stage.\n"
            else:
                for tool, result in scan_results.items():
                    logs += f"--- {tool} ---\n"
                    if result['status'] == 'success':
                        if 'vulnerabilities' in result and result['vulnerabilities']:
                            logs += f"Found {len(result['vulnerabilities'])} vulnerabilities.\n"
                        else:
                            logs += "No vulnerabilities found.\n"
                    else:
                        logs += f"Scan failed: {result['error']}\n"
                        had_errors = True
            self._update_stage_status("Scan", "success", logs)
        if had_errors:
            self._update_stage_status("Scan", "failed", logs)
            raise Exception("One or more security scans failed.")

    def _build_and_push_docker(self):
        self.logger.info("Starting Docker build and push process...")
        self._update_stage_status("Dockerize", "running")
        logs = ""
        try:
            if not self.account:
                self.logger.info("Getting AWS account ID...")
                self.account = boto3.client('sts').get_caller_identity()['Account']
                self.logger.info(f"AWS Account: {self.account}")
            
            self.logger.info(f"Checking if ECR repository exists: {self.ecr_repo}")
            try:
                self.ecr_client.describe_repositories(repositoryNames=[self.ecr_repo])
                self.logger.info(f"ECR repository exists: {self.ecr_repo}")
            except self.ecr_client.exceptions.RepositoryNotFoundException:
                self.logger.info(f"Repository not found, creating: {self.ecr_repo}")
                logs += f"Repository not found. Creating ECR repository: {self.ecr_repo}\n"
                self.ecr_client.create_repository(repositoryName=self.ecr_repo)
                self.logger.info("ECR repository created successfully")

            ecr_repo_uri = f"{self.account}.dkr.ecr.{self.region}.amazonaws.com/{self.ecr_repo}"
            full_image_tag = f"{ecr_repo_uri}:latest"
            self.logger.info(f"Full image tag: {full_image_tag}")
            self.logger.info(f"Build context directory: {self.local_dir}")

            logs += f"Building Docker image: {full_image_tag}\n"
            self.logger.info("Starting Docker image build...")
            image, build_log = self.docker_client.images.build(path=self.local_dir, tag=full_image_tag, rm=True, buildargs=self.env_variables)
            
            self.logger.info("Docker build completed, processing build logs...")
            for line in build_log:
                if 'stream' in line:
                    logs += line['stream']
                    self.logger.info(f"Docker: {line['stream'].strip()}")

            self.logger.info("Starting Docker image push to ECR...")
            logs += f"Pushing image to ECR...\n"
            
            try:
                auth_config = self._get_ecr_auth_config()
                push_result = self.docker_client.images.push(full_image_tag, auth_config=auth_config)
                self.logger.info(f"Push result: {push_result}")
                logs += "Docker image pushed to ECR successfully.\n"
            except docker.errors.APIError as e:
                if 'authentication required' in str(e).lower():
                    error_msg = f"ECR authentication failed. Please check credentials. Details: {e}"
                    self.logger.error(f"AUTH ERROR: {error_msg}")
                    logs += error_msg + "\n"
                    self._update_stage_status("Dockerize", "failed", logs)
                    self.analyze_failure(logs)
                raise e

            self.logger.info("Docker image pushed successfully!")
            self._update_stage_status("Dockerize", "success", logs)
            return full_image_tag
        except Exception as e:
            error_msg = f"An error occurred during Docker build/push: {str(e)}"
            self.logger.error(f"DOCKER ERROR: {error_msg}", exc_info=True)
            logs += error_msg + "\n"
            self._update_stage_status("Dockerize", "failed", logs)
            self.logger.info("Starting LLM analysis for Docker failure...")
            self.analyze_failure(logs)
            raise

    def _get_ecr_auth_config(self):
        """Fetches ECR credentials and returns them in a format for docker-py."""
        self.logger.info("Getting fresh ECR authorization token...")
        response = self.ecr_client.get_authorization_token()
        auth_data = response['authorizationData'][0]
        token = base64.b64decode(auth_data['authorizationToken']).decode('utf-8')
        username, password = token.split(':')
        return {'username': username, 'password': password}

    def analyze_failure(self, error_text):
        self._update_stage_status("Failure Analysis", "running")
        try:
            response = self.failure_analyzer_chain.invoke({"error_message": error_text})
            analysis = response.get('text', 'No analysis available.')
            self._update_stage_status("Failure Analysis", "success", analysis)
        except Exception as e:
            self._update_stage_status("Failure Analysis", "failed", f"Could not analyze failure: {e}")

