# cd_agent.py
import os
import time
import boto3, json
from dotenv import load_dotenv
from .llm_service import create_failure_analyzer_chain
from typing import Optional, Dict

from . import db
from datetime import datetime
from typing import Any

class CDAgent:
    def __init__(self, build_id: str, config: Dict[str, Any], env_variables: Optional[Dict[str, str]] = None):
        load_dotenv()
        self.build_id = build_id
        self.config = config
        self.cluster = self.config["ecs_config"]["cluster"]
        self.service = self.config["ecs_config"]["service"]
        self.ecs_client = boto3.client('ecs')
        self.failure_analyzer_chain = create_failure_analyzer_chain()
        self.env_variables = env_variables or {}

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

    def run(self, image_uri: str):
        """Main entry point for the CD agent."""
        logs = ""
        try:
            # Stage 1: Update Task Definition
            self._update_stage_status("Deploy", "running", f"Starting deployment for image: {image_uri}\n")
            task_def_name = self.config["ecs_config"]["task_definition"]
            
            logs += f"Fetching latest active task definition for family: {task_def_name}\n"
            task_def = self.ecs_client.describe_task_definition(taskDefinition=task_def_name)['taskDefinition']

            new_container_defs = task_def['containerDefinitions']
            new_container_defs[0]['image'] = image_uri

            if self.env_variables:
                logs += f"Injecting {len(self.env_variables)} environment variables into task definition.\n"
                current_env_vars = {item['name']: item['value'] for item in new_container_defs[0].get('environment', [])}
                current_env_vars.update(self.env_variables)
                new_container_defs[0]['environment'] = [{'name': k, 'value': v} for k, v in current_env_vars.items()]

            logs += f"Registering new task definition with image: {image_uri}\n"
            new_task_def = self.ecs_client.register_task_definition(
                family=task_def_name,
                volumes=task_def['volumes'],
                containerDefinitions=new_container_defs,
                requiresCompatibilities=task_def['requiresCompatibilities'],
                networkMode=task_def['networkMode'],
                cpu=task_def.get('cpu'),
                memory=task_def.get('memory'),
                executionRoleArn=task_def.get('executionRoleArn')
            )
            new_task_def_arn = new_task_def['taskDefinition']['taskDefinitionArn']
            logs += f"Successfully registered new task definition: {new_task_def_arn}\n"
            self._update_stage_status("Deploy", "running", logs)

            # Stage 2: Update Service and Wait
            logs = f"Updating service {self.service} to use new task definition.\n"
            self.ecs_client.update_service(
                cluster=self.cluster,
                service=self.service,
                taskDefinition=new_task_def_arn,
                forceNewDeployment=True
            )
            logs += "Service update initiated. Waiting for deployment to stabilize...\n"
            self._update_stage_status("Deploy", "running", logs)

            waiter = self.ecs_client.get_waiter('services_stable')
            waiter.wait(
                cluster=self.cluster,
                services=[self.service],
                WaiterConfig={'Delay': 15, 'MaxAttempts': 40}
            )
            self._update_stage_status("Deploy", "success", "Deployment completed successfully.\n")
            db.update_build(self.build_id, {"status": "success"})
            return True

        except Exception as e:
            error_msg = str(e)
            self._update_stage_status("Deploy", "failed", f"Deployment failed: {error_msg}\n")
            db.update_build(self.build_id, {"status": "failed", "message": error_msg})
            self.analyze_failure(error_msg)
            return False

    def analyze_failure(self, error_msg: str):
        self._update_stage_status("Failure Analysis", "running")
        try:
            response = self.failure_analyzer_chain.invoke({"error_message": error_msg})
            analysis = response.get('text', 'No analysis available.')
            self._update_stage_status("Failure Analysis", "success", analysis)
        except Exception as e:
            self._update_stage_status("Failure Analysis", "failed", f"Could not analyze failure: {e}")
