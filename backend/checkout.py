#!/usr/bin/env python3
"""
Multi-SCM Code Checkout System
Supports GitHub, GitLab, Bitbucket, AWS CodeCommit, Azure Repos, and GCP Source Repositories
"""

import os
import sys
import subprocess
import tempfile
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
from pathlib import Path
import logging
from urllib.parse import urlparse
import base64
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class CheckoutConfig:
    """Configuration for code checkout"""
    repo_url: str
    branch: str = "main"
    tag: str = None
    commit_hash: str = None
    destination_path: str = None
    shallow_clone: bool = True
    credentials: Dict[str, Any] = None

class SCMError(Exception):
    """Custom exception for SCM operations"""
    pass

class BaseSCM(ABC):
    """Abstract base class for Source Code Managers"""
    
    def __init__(self, config: CheckoutConfig):
        self.config = config
        self.temp_dir = None
        
    @abstractmethod
    def authenticate(self) -> bool:
        """Authenticate with the SCM provider"""
        pass
    
    @abstractmethod
    def build_clone_url(self) -> str:
        """Build the appropriate clone URL with credentials"""
        pass
    
    def checkout(self) -> str:
        """Main checkout method"""
        try:
            if not self.authenticate():
                raise SCMError("Authentication failed")
            
            clone_url = self.build_clone_url()
            destination = self._prepare_destination()
            
            self._clone_repository(clone_url, destination)
            self._checkout_specific_ref(destination)
            
            logger.info(f"Successfully checked out code to: {destination}")
            return destination
            
        except Exception as e:
            self._cleanup()
            raise SCMError(f"Checkout failed: {str(e)}")
    
    def _prepare_destination(self) -> str:
        """Prepare the destination directory"""
        if self.config.destination_path:
            dest = Path(self.config.destination_path)
            dest.mkdir(parents=True, exist_ok=True)
            return str(dest.absolute())
        else:
            self.temp_dir = tempfile.mkdtemp(prefix="scm_checkout_")
            return self.temp_dir
    
    def _clone_repository(self, clone_url: str, destination: str):
        """Clone the repository"""
        cmd = ["git", "clone"]
        
        if self.config.shallow_clone:
            cmd.extend(["--depth", "1"])
        
        if self.config.branch and not self.config.tag and not self.config.commit_hash:
            cmd.extend(["-b", self.config.branch])
        
        cmd.extend([clone_url, destination])
        
        logger.info(f"Cloning repository: {self.config.repo_url}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise SCMError(f"Git clone failed: {result.stderr}")
    
    def _checkout_specific_ref(self, destination: str):
        """Checkout specific tag or commit if specified"""
        if self.config.tag:
            self._run_git_command(["checkout", f"tags/{self.config.tag}"], destination)
        elif self.config.commit_hash:
            # For shallow clones, we might need to fetch more history
            if self.config.shallow_clone:
                self._run_git_command(["fetch", "--unshallow"], destination)
            self._run_git_command(["checkout", self.config.commit_hash], destination)
    
    def _run_git_command(self, cmd: list, cwd: str):
        """Run a git command in the specified directory"""
        full_cmd = ["git"] + cmd
        result = subprocess.run(full_cmd, cwd=cwd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise SCMError(f"Git command failed: {' '.join(full_cmd)} - {result.stderr}")
    
    def _cleanup(self):
        """Clean up temporary resources"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

class GitHubSCM(BaseSCM):
    """GitHub Source Code Manager"""
    
    def authenticate(self) -> bool:
        """Authenticate with GitHub using token or SSH"""
        if not self.config.credentials:
            logger.warning("No credentials provided for GitHub. Attempting public access.")
            return True
        
        token = self.config.credentials.get('token')
        if token:
            # Token will be used in clone URL
            return True
        
        ssh_key = self.config.credentials.get('ssh_key_path')
        if ssh_key and os.path.exists(ssh_key):
            os.environ['GIT_SSH_COMMAND'] = f'ssh -i {ssh_key} -o StrictHostKeyChecking=no'
            return True
        
        return False
    
    def build_clone_url(self) -> str:
        """Build GitHub clone URL"""
        if self.config.credentials and self.config.credentials.get('token'):
            token = self.config.credentials['token']
            parsed = urlparse(self.config.repo_url)
            if parsed.hostname == 'github.com':
                return f"https://{token}@github.com{parsed.path}"
        
        return self.config.repo_url

class GitLabSCM(BaseSCM):
    """GitLab Source Code Manager"""
    
    def authenticate(self) -> bool:
        """Authenticate with GitLab using token or SSH"""
        if not self.config.credentials:
            logger.warning("No credentials provided for GitLab. Attempting public access.")
            return True
        
        token = self.config.credentials.get('token')
        username = self.config.credentials.get('username', 'oauth2')
        
        if token:
            return True
        
        ssh_key = self.config.credentials.get('ssh_key_path')
        if ssh_key and os.path.exists(ssh_key):
            os.environ['GIT_SSH_COMMAND'] = f'ssh -i {ssh_key} -o StrictHostKeyChecking=no'
            return True
        
        return False
    
    def build_clone_url(self) -> str:
        """Build GitLab clone URL"""
        if self.config.credentials and self.config.credentials.get('token'):
            token = self.config.credentials['token']
            username = self.config.credentials.get('username', 'oauth2')
            parsed = urlparse(self.config.repo_url)
            
            if 'gitlab' in parsed.hostname:
                return f"https://{username}:{token}@{parsed.hostname}{parsed.path}"
        
        return self.config.repo_url

class BitbucketSCM(BaseSCM):
    """Bitbucket Source Code Manager"""
    
    def authenticate(self) -> bool:
        """Authenticate with Bitbucket using app password or SSH"""
        if not self.config.credentials:
            logger.warning("No credentials provided for Bitbucket. Attempting public access.")
            return True
        
        username = self.config.credentials.get('username')
        app_password = self.config.credentials.get('app_password')
        
        if username and app_password:
            return True
        
        ssh_key = self.config.credentials.get('ssh_key_path')
        if ssh_key and os.path.exists(ssh_key):
            os.environ['GIT_SSH_COMMAND'] = f'ssh -i {ssh_key} -o StrictHostKeyChecking=no'
            return True
        
        return False
    
    def build_clone_url(self) -> str:
        """Build Bitbucket clone URL"""
        if self.config.credentials:
            username = self.config.credentials.get('username')
            app_password = self.config.credentials.get('app_password')
            
            if username and app_password:
                parsed = urlparse(self.config.repo_url)
                if 'bitbucket' in parsed.hostname:
                    return f"https://{username}:{app_password}@{parsed.hostname}{parsed.path}"
        
        return self.config.repo_url

class AWSCodeCommitSCM(BaseSCM):
    """AWS CodeCommit Source Code Manager"""
    
    def authenticate(self) -> bool:
        """Authenticate with AWS CodeCommit using credentials helper"""
        try:
            # Check if AWS CLI is configured
            result = subprocess.run(['aws', 'sts', 'get-caller-identity'], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                raise SCMError("AWS CLI not configured or no valid credentials")
            
            # Configure git to use AWS credential helper
            subprocess.run(['git', 'config', '--global', 
                          'credential.helper', '!aws codecommit credential-helper $@'])
            subprocess.run(['git', 'config', '--global', 
                          'credential.UseHttpPath', 'true'])
            
            return True
        except Exception as e:
            logger.error(f"AWS CodeCommit authentication failed: {e}")
            return False
    
    def build_clone_url(self) -> str:
        """Build AWS CodeCommit clone URL"""
        return self.config.repo_url

class AzureReposSCM(BaseSCM):
    """Azure Repos Source Code Manager"""
    
    def authenticate(self) -> bool:
        """Authenticate with Azure Repos using PAT"""
        if not self.config.credentials:
            logger.error("Personal Access Token required for Azure Repos")
            return False
        
        pat = self.config.credentials.get('personal_access_token')
        if not pat:
            logger.error("Personal Access Token not provided")
            return False
        
        return True
    
    def build_clone_url(self) -> str:
        """Build Azure Repos clone URL"""
        if self.config.credentials:
            pat = self.config.credentials.get('personal_access_token')
            if pat:
                parsed = urlparse(self.config.repo_url)
                if 'dev.azure.com' in parsed.hostname or 'visualstudio.com' in parsed.hostname:
                    # Encode PAT for basic auth
                    encoded_pat = base64.b64encode(f":{pat}".encode()).decode()
                    return f"https://:{pat}@{parsed.hostname}{parsed.path}"
        
        return self.config.repo_url

class GCPSourceReposSCM(BaseSCM):
    """GCP Source Repositories Source Code Manager"""
    
    def authenticate(self) -> bool:
        """Authenticate with GCP Source Repositories using gcloud"""
        try:
            # Check if gcloud is configured
            result = subprocess.run(['gcloud', 'auth', 'list', '--filter=status:ACTIVE'],
                                  capture_output=True, text=True)
            if result.returncode != 0 or not result.stdout.strip():
                raise SCMError("gcloud not configured or no active account")
            
            # Configure git to use gcloud credential helper
            subprocess.run(['git', 'config', '--global', 
                          'credential.https://source.developers.google.com.helper', 'gcloud.sh'])
            
            return True
        except Exception as e:
            logger.error(f"GCP Source Repositories authentication failed: {e}")
            return False
    
    def build_clone_url(self) -> str:
        """Build GCP Source Repositories clone URL"""
        return self.config.repo_url

class SCMFactory:
    """Factory class to create appropriate SCM instances"""
    
    @staticmethod
    def create_scm(config: CheckoutConfig) -> BaseSCM:
        """Create SCM instance based on repository URL"""
        parsed_url = urlparse(config.repo_url)
        hostname = parsed_url.hostname.lower() if parsed_url.hostname else ''
        
        if 'github.com' in hostname:
            return GitHubSCM(config)
        elif 'gitlab' in hostname:
            return GitLabSCM(config)
        elif 'bitbucket' in hostname:
            return BitbucketSCM(config)
        elif 'codecommit' in hostname or 'amazonaws.com' in hostname:
            return AWSCodeCommitSCM(config)
        elif 'dev.azure.com' in hostname or 'visualstudio.com' in hostname:
            return AzureReposSCM(config)
        elif 'source.developers.google.com' in hostname:
            return GCPSourceReposSCM(config)
        else:
            # Default to GitHub SCM for generic Git repositories
            logger.warning(f"Unknown SCM provider for {hostname}, using GitHub SCM")
            return GitHubSCM(config)

class CodeCheckoutManager:
    """Main manager class for code checkout operations"""
    
    def __init__(self):
        self.checkout_history = []
    
    def checkout_code(self, config: CheckoutConfig) -> str:
        """Checkout code from the specified repository"""
        try:
            logger.info(f"Starting checkout for repository: {config.repo_url}")
            
            scm = SCMFactory.create_scm(config)
            destination = scm.checkout()
            
            # Record successful checkout
            self.checkout_history.append({
                'repo_url': config.repo_url,
                'branch': config.branch,
                'tag': config.tag,
                'commit_hash': config.commit_hash,
                'destination': destination,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
            
            return destination
            
        except Exception as e:
            logger.error(f"Checkout failed: {str(e)}")
            raise
    
    def get_checkout_history(self) -> list:
        """Get history of checkout operations"""
        return self.checkout_history.copy()

# Example usage and configuration templates
def create_github_config(repo_url: str, token: str = None, branch: str = "main") -> CheckoutConfig:
    """Create GitHub checkout configuration"""
    credentials = {'token': token} if token else None
    return CheckoutConfig(repo_url=repo_url, branch=branch, credentials=credentials)

def create_gitlab_config(repo_url: str, token: str = None, branch: str = "main") -> CheckoutConfig:
    """Create GitLab checkout configuration"""
    credentials = {'token': token} if token else None
    return CheckoutConfig(repo_url=repo_url, branch=branch, credentials=credentials)

def create_bitbucket_config(repo_url: str, username: str = None, app_password: str = None, branch: str = "main") -> CheckoutConfig:
    """Create Bitbucket checkout configuration"""
    credentials = None
    if username and app_password:
        credentials = {'username': username, 'app_password': app_password}
    return CheckoutConfig(repo_url=repo_url, branch=branch, credentials=credentials)

def create_aws_codecommit_config(repo_url: str, branch: str = "main") -> CheckoutConfig:
    """Create AWS CodeCommit checkout configuration"""
    return CheckoutConfig(repo_url=repo_url, branch=branch)

def create_azure_repos_config(repo_url: str, pat: str, branch: str = "main") -> CheckoutConfig:
    """Create Azure Repos checkout configuration"""
    credentials = {'personal_access_token': pat}
    return CheckoutConfig(repo_url=repo_url, branch=branch, credentials=credentials)

def create_gcp_source_repos_config(repo_url: str, branch: str = "main") -> CheckoutConfig:
    """Create GCP Source Repositories checkout configuration"""
    return CheckoutConfig(repo_url=repo_url, branch=branch)

def load_config_from_env() -> list:
    """Load repository configurations from environment variables"""
    configs = []
    
    # GitHub Configuration
    github_repo = os.getenv('GITHUB_REPO_URL')
    if github_repo:
        github_token = os.getenv('GITHUB_TOKEN')
        github_branch = os.getenv('GITHUB_BRANCH', 'main')
        configs.append(create_github_config(github_repo, token=github_token, branch=github_branch))
        logger.info(f"Loaded GitHub config for: {github_repo}")
    
    # GitLab Configuration
    gitlab_repo = os.getenv('GITLAB_REPO_URL')
    if gitlab_repo:
        gitlab_token = os.getenv('GITLAB_TOKEN')
        gitlab_branch = os.getenv('GITLAB_BRANCH', 'main')
        configs.append(create_gitlab_config(gitlab_repo, token=gitlab_token, branch=gitlab_branch))
        logger.info(f"Loaded GitLab config for: {gitlab_repo}")
    
    # Bitbucket Configuration
    bitbucket_repo = os.getenv('BITBUCKET_REPO_URL')
    if bitbucket_repo:
        bitbucket_username = os.getenv('BITBUCKET_USERNAME')
        bitbucket_password = os.getenv('BITBUCKET_APP_PASSWORD')
        bitbucket_branch = os.getenv('BITBUCKET_BRANCH', 'main')
        configs.append(create_bitbucket_config(
            bitbucket_repo, 
            username=bitbucket_username, 
            app_password=bitbucket_password, 
            branch=bitbucket_branch
        ))
        logger.info(f"Loaded Bitbucket config for: {bitbucket_repo}")
    
    # AWS CodeCommit Configuration
    aws_repo = os.getenv('AWS_CODECOMMIT_REPO_URL')
    if aws_repo:
        aws_branch = os.getenv('AWS_CODECOMMIT_BRANCH', 'main')
        configs.append(create_aws_codecommit_config(aws_repo, branch=aws_branch))
        logger.info(f"Loaded AWS CodeCommit config for: {aws_repo}")
    
    # Azure Repos Configuration
    azure_repo = os.getenv('AZURE_REPO_URL')
    if azure_repo:
        azure_pat = os.getenv('AZURE_PERSONAL_ACCESS_TOKEN')
        azure_branch = os.getenv('AZURE_BRANCH', 'main')
        if azure_pat:
            configs.append(create_azure_repos_config(azure_repo, pat=azure_pat, branch=azure_branch))
            logger.info(f"Loaded Azure Repos config for: {azure_repo}")
        else:
            logger.warning(f"Azure repo URL provided but no PAT found in AZURE_PERSONAL_ACCESS_TOKEN")
    
    # GCP Source Repositories Configuration
    gcp_repo = os.getenv('GCP_SOURCE_REPO_URL')
    if gcp_repo:
        gcp_branch = os.getenv('GCP_SOURCE_BRANCH', 'main')
        configs.append(create_gcp_source_repos_config(gcp_repo, branch=gcp_branch))
        logger.info(f"Loaded GCP Source Repositories config for: {gcp_repo}")
    
    return configs

def print_environment_variables_help():
    """Print help information about required environment variables"""
    help_text = """
    Environment Variables Configuration:

🔹 GitHub:
   - GITHUB_REPO_URL (required): Repository URL
   - GITHUB_TOKEN (optional): Personal access token for private repos
   - GITHUB_BRANCH (optional, default: main): Branch to checkout

🔹 GitLab:
   - GITLAB_REPO_URL (required): Repository URL
   - GITLAB_TOKEN (optional): Personal access token for private repos
   - GITLAB_BRANCH (optional, default: main): Branch to checkout

🔹 Bitbucket:
   - BITBUCKET_REPO_URL (required): Repository URL
   - BITBUCKET_USERNAME (optional): Username for private repos
   - BITBUCKET_APP_PASSWORD (optional): App password for private repos
   - BITBUCKET_BRANCH (optional, default: main): Branch to checkout

🔹 AWS CodeCommit:
   - AWS_CODECOMMIT_REPO_URL (required): Repository URL
   - AWS_CODECOMMIT_BRANCH (optional, default: main): Branch to checkout
   - Note: Requires AWS CLI to be configured

🔹 Azure Repos:
   - AZURE_REPO_URL (required): Repository URL
   - AZURE_PERSONAL_ACCESS_TOKEN (required): Personal access token
   - AZURE_BRANCH (optional, default: main): Branch to checkout

🔹 GCP Source Repositories:
   - GCP_SOURCE_REPO_URL (required): Repository URL
   - GCP_SOURCE_BRANCH (optional, default: main): Branch to checkout
   - Note: Requires gcloud to be configured

🔹 General Options:
   - SCM_DESTINATION_PATH (optional): Custom destination path for checkouts
   - SCM_SHALLOW_CLONE (optional, default: true): Enable shallow cloning
   - SCM_TAG (optional): Specific tag to checkout (overrides branch)
   - SCM_COMMIT_HASH (optional): Specific commit to checkout (overrides branch/tag)

Example usage:
export GITHUB_REPO_URL="https://github.com/user/repo.git"
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_BRANCH="develop"
python scm_checkout.py
    """
    print(help_text)

if __name__ == "__main__":
    # Check if help is requested
    if len(os.sys.argv) > 1 and os.sys.argv[1] in ['--help', '-h']:
        print_environment_variables_help()
        exit(0)
    
    # Load configurations from environment variables
    configs = load_config_from_env()
    
    if not configs:
        logger.warning("No repository configurations found in environment variables.")
        print("Use --help to see available environment variables.")
        print_environment_variables_help()
        exit(1)
    
    # Initialize the manager
    manager = CodeCheckoutManager()
    
    # Apply global configuration options from environment
    destination_path = os.getenv('SCM_DESTINATION_PATH')
    shallow_clone = os.getenv('SCM_SHALLOW_CLONE', 'true').lower() == 'true'
    tag = os.getenv('SCM_TAG')
    commit_hash = os.getenv('SCM_COMMIT_HASH')
    
    # Process each configuration
    for config in configs:
        try:
            # Apply global overrides if specified
            if destination_path:
                config.destination_path = destination_path
            config.shallow_clone = shallow_clone
            if tag:
                config.tag = tag
                config.branch = None  # Tag takes precedence
            if commit_hash:
                config.commit_hash = commit_hash
                config.branch = None  # Commit hash takes precedence
                config.tag = None
            
            destination = manager.checkout_code(config)
            print(f"Successfully checked out {config.repo_url} to: {destination}")
            
        except Exception as e:
            print(f"Failed to checkout {config.repo_url}: {e}")
    
    # Print checkout history
    if manager.get_checkout_history():
        print("\nCheckout History:")
        for entry in manager.get_checkout_history():
            print(f"  - {entry['repo_url']} -> {entry['destination']}")
    
    print(f"\n Total repositories processed: {len(configs)}")
    print(f"Successful checkouts: {len(manager.get_checkout_history())}")
    print(f"Failed checkouts: {len(configs) - len(manager.get_checkout_history())}")