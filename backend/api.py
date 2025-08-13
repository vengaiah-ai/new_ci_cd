# backend/api.py
import json
import math
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# App modules
from .orchestrator import Orchestrator
from .query_agent import interpret_user_command
from . import db

app = FastAPI(title="PipelinePilot API", version="1.0.0")

# --- CORS Middleware ---
# This is the key change to allow the frontend to communicate with the backend.
origins = [
    "http://localhost:8081",  # Old dev server
    "http://localhost:8082",  # Current frontend dev server
    "http://localhost:5173",  # Default Vite port
    "http://localhost",
    "http://127.0.0.1:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    build_id: Optional[str] = None
    repo_url: Optional[str] = None
    aws_credential_name: Optional[str] = None # Name of the stored credential set

class PipelineFormData(BaseModel):
    repositoryUrl: str
    branch: str
    commitSha: Optional[str] = None
    configurationPath: Optional[str] = None
    environment: Optional[str] = "dev"
    buildType: Optional[str] = "standard"

class SecretData(BaseModel):
    name: str
    value: str
    environment: str
    description: Optional[str] = None
    createdBy: str = "api"

class AWSCredentialSet(BaseModel):
    name: str
    aws_access_key_id: str
    aws_secret_access_key: str
    region: str
    iam_role_arn: Optional[str] = None
    description: Optional[str] = None

# --- Helper Functions ---
def build_pipeline_config(repo_url: str, branch: str, aws_credential_name: str) -> (str, Dict[str, Any]):
    """Constructs the full pipeline configuration and generates a unique build ID."""
    import uuid

    build_id = str(uuid.uuid4())[:8]

    # Fetch the specified AWS credentials from the database
    aws_creds = db.get_aws_credential_set_by_name(aws_credential_name)
    if not aws_creds:
        raise HTTPException(status_code=404, detail=f"AWS credential '{aws_credential_name}' not found.")

    # Fetch all environment variables (can be filtered by environment if needed)
    environment_variables = db.get_all_variables()

    # Fetch the ECS_CLUSTER variable from the database
    # Fetch ECS and ECR configuration from variables using the correct keys from the frontend
    ecs_cluster_var = db.get_variable_by_name("ECS_CLUSTER_NAME")
    ecs_service_var = db.get_variable_by_name("ECS_SERVICE_NAME")
    ecs_task_def_var = db.get_variable_by_name("ECS_TASK_NAME")
    ecr_repo_var = db.get_variable_by_name("ECR_REPOSITORY_NAME")

    # Consolidate required variables for the check
    required_vars = {
        "ECS_CLUSTER_NAME": ecs_cluster_var,
        "ECS_SERVICE_NAME": ecs_service_var,
        "ECS_TASK_NAME": ecs_task_def_var,
        "ECR_REPOSITORY_NAME": ecr_repo_var
    }

    missing_vars = [key for key, value in required_vars.items() if not value]
    if missing_vars:
        raise ValueError(f"Missing required variables: {', '.join(missing_vars)}. Please set them on the Environment Variables page.")

    # Assemble the build configuration dictionary
    build_config = {
        "build_id": build_id,
        "repo_url": repo_url,
        "branch": branch,
        "commit_sha": None,  # Can be enhanced later
        "aws_credentials": aws_creds,
        "env_variables": environment_variables,
        "ecr_repo": ecr_repo_var['value'],
        "ecs_config": {
            "cluster": ecs_cluster_var['value'],
            "service": ecs_service_var['value'],
            "task_definition": ecs_task_def_var['value'],
        },
    }
    return build_id, build_config

def generate_response_message(parsed_command: Dict[str, Any]) -> str:
    """Generates a user-friendly response string from a parsed command dictionary."""
    if not parsed_command or parsed_command.get("error"):
        error_msg = parsed_command.get("error", {}).get("message", "I had trouble understanding that.")
        return f"Sorry, I couldn't process your request. {error_msg}"

    command = parsed_command.get("command")
    target = parsed_command.get("target")
    params = parsed_command.get("parameters", {})

    if command == "build":
        repo = params.get("repo", "your repository")
        branch = params.get("branch", "the default branch")
        return f"Okay, I will start a new build for the repository `{repo}` on branch `{branch}`."
    elif command == "deploy":
        service = params.get("service", "your service")
        version = params.get("version", "the latest version")
        return f"Understood. I will deploy version `{version}` of the service `{service}`."
    elif command == "status":
        build_id = params.get("build_id", "the latest build")
        return f"Checking the status of build `{build_id}`..."
    elif command == "list":
        target_name = target or "items"
        return f"Okay, I will list the available {target_name}s for you."
    elif command == "help":
        return "I can help you `build`, `deploy`, check `status`, or `list` resources. What would you like to do?"
    else:
        return "I've received your command, but I'm not sure how to act on it yet."

def run_pipeline_background(build_id: str, config: Dict[str, Any]):
    """Worker function to run the pipeline and update status."""
    try:
        db.update_build(build_id, {"status": "running"})
        orchestrator = Orchestrator()
        # The orchestrator's run_pipeline expects a JSON string
        config_json = json.dumps(config)
        orchestrator.run_pipeline(build_id, config_json)
        db.update_build(build_id, {"status": "success"})
    except Exception as e:
        # In a real app, you'd log the full error
        print(f"Pipeline failed for build {build_id}: {e}")
        db.update_build(build_id, {"status": "failed", "message": str(e)})

# --- API Routes ---
@app.get("/api/builds")
async def get_builds(
    status: Optional[str] = None,
    repository: Optional[str] = None,
    branch: Optional[str] = None,
    page: int = 1,
    limit: int = 10
):
    """Get build history with filtering and pagination."""
    all_builds = db.get_all_builds()

    # Apply filters
    if status:
        all_builds = [b for b in all_builds if b.get('status') == status]
    if repository:
        all_builds = [b for b in all_builds if repository in b.get('repository', '')]
    if branch:
        all_builds = [b for b in all_builds if b.get('branch') == branch]

    # Apply pagination
    total_items = len(all_builds)
    start_index = (page - 1) * limit
    end_index = start_index + limit
    paginated_builds = all_builds[start_index:end_index]

    return {
        "data": paginated_builds,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_items,
            "totalPages": math.ceil(total_items / limit)
        }
    }

@app.get("/api/builds/{build_id}")
async def get_build(build_id: str):
    """Get specific build details."""
    build = db.get_build_by_id(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    return build

@app.post("/api/builds", status_code=201)
async def create_build(request: PipelineFormData, background_tasks: BackgroundTasks, aws_credential_name: str = None):
    """Create a new build directly from form data."""
    try:
        # Validate required fields
        if not request.repositoryUrl:
            raise HTTPException(status_code=400, detail="Repository URL is required")
        if not aws_credential_name:
            raise HTTPException(status_code=400, detail="AWS credential name is required")
        
        # Generate build configuration
        build_id, build_config = build_pipeline_config(
            request.repositoryUrl, 
            request.branch or "main", 
            aws_credential_name
        )
        
        # Add build to database
        db.add_build({
            "id": build_id,
            "status": "pending",
            "repository": request.repositoryUrl,
            "branch": request.branch or "main",
            "message": f"Build triggered for {request.repositoryUrl} from UI form.",
            "stages": [],
            "environment": request.environment,
            "buildType": request.buildType,
            "commitSha": request.commitSha,
            "configurationPath": request.configurationPath,
        })
        
        # Start the build process in the background
        orchestrator = Orchestrator()
        background_tasks.add_task(orchestrator.run_pipeline, build_id, json.dumps(build_config))
        
        return {
            "build_id": build_id,
            "status": "pending",
            "message": f"Build {build_id} started successfully",
            "repository": request.repositoryUrl,
            "branch": request.branch or "main"
        }
        
    except Exception as e:
        logger.error(f"Error creating build: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create build: {str(e)}")

@app.post("/api/builds/{build_id}/cancel")
async def cancel_build(build_id: str):
    """Cancel a running build (marks as cancelled)."""
    # Note: This does not actually stop the running process.
    # A more robust implementation would require inter-process communication.
    build = db.get_build_by_id(build_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    
    if build['status'] not in ["pending", "running"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a build with status: {build['status']}")

    updated_build = db.update_build(build_id, {"status": "cancelled"})
    return {"success": True, "message": f"Build {build_id} marked as cancelled", "build": updated_build}

@app.get("/api/secrets")
async def get_secrets(environment: Optional[str] = None):
    """Get secrets with optional environment filtering."""
    all_secrets = db.get_all_secrets()
    if environment:
        all_secrets = [s for s in all_secrets if s.get('environment') == environment]
    return {"data": all_secrets}

@app.post("/api/secrets", status_code=201)
async def create_secret(secret_data: SecretData):
    """Create a new secret."""
    new_secret = db.add_secret(secret_data.dict())
    return {"success": True, "message": "Secret created successfully", "data": new_secret}

# --- AWS Credentials Routes ---
@app.get("/api/aws-credentials", response_model=List[AWSCredentialSet])
async def get_aws_credentials():
    """Get all AWS credential sets, hiding sensitive keys."""
    creds = db.get_all_aws_credential_sets()
    # For security, never return the secret key in a list view
    for cred in creds:
        cred['aws_secret_access_key'] = "********"
    return creds

@app.post("/api/aws-credentials", status_code=201)
async def create_aws_credential(credential_set: AWSCredentialSet):
    """Create or update an AWS credential set.
    
    If a credential set with the same name exists, it will be updated.
    """
    try:
        existing = db.get_aws_credential_set_by_name(credential_set.name)
        if existing:
            # Update existing credentials
            updates = credential_set.dict(exclude_unset=True)
            # Preserve the ID and lastModified
            updates['id'] = existing['id']
            updates['lastModified'] = datetime.now().isoformat()
            
            # Get all credentials and update the matching one
            creds = db.get_all_aws_credential_sets()
            for cred in creds:
                if cred['name'] == credential_set.name:
                    cred.update(updates)
                    db.save_data(db.AWS_CREDS_FILE, creds)
                    return {
                        "message": f"AWS credential set '{credential_set.name}' updated successfully.",
                        "updated": True
                    }
            
            # If we got here, something went wrong
            raise HTTPException(status_code=500, detail="Failed to update existing credentials")
            
        # Add new credentials
        db.add_aws_credential_set(credential_set.dict())
        return {
            "message": f"AWS credential set '{credential_set.name}' created successfully.",
            "updated": False
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in create_aws_credential: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while processing your request")

@app.delete("/api/aws-credentials/{name}", status_code=204)
async def delete_aws_credential(name: str):
    """Delete an AWS credential set by name."""
    success = db.delete_aws_credential_set_by_name(name)
    if not success:
        raise HTTPException(status_code=404, detail="Credential set not found.")
    return

# --- Environment Variables Routes ---
@app.get("/api/variables", response_model=List[Dict[str, Any]])
async def get_variables(key: Optional[str] = None):
    """Get environment variables, optionally filtered by key."""
    if key:
        variables = [db.get_variable_by_name(key)]
        variables = [v for v in variables if v]  # Filter out None if not found
    else:
        variables = db.get_all_variables()
    # For security, never return the value in a list view
    for var in variables:
        var['value'] = "********"
    return variables

@app.post("/api/variables", status_code=201)
async def create_variable(variable: Dict[str, str]):
    """Create a new environment variable."""
    # Basic validation
    if not all(k in variable for k in ['key', 'value']):
        raise HTTPException(status_code=400, detail="'key' and 'value' are required fields.")
    db.add_variable(variable)
    return {"message": f"Variable '{variable['key']}' created successfully."}

@app.patch("/api/variables/{variable_id}", response_model=Dict[str, Any])
async def update_variable(variable_id: str, updates: Dict[str, Any]):
    """Update an environment variable by its ID."""
    if not updates:
        raise HTTPException(status_code=400, detail="No update data provided.")

    updated_variable = db.update_variable(variable_id, updates)
    if not updated_variable:
        raise HTTPException(status_code=404, detail="Variable not found.")
    
    # For security, mask the value in the response
    if 'value' in updated_variable:
        updated_variable['value'] = "********"
        
    return updated_variable

@app.delete("/api/variables/{variable_id}", status_code=204)
async def delete_variable(variable_id: str):
    """Delete an environment variable by its ID."""
    success = db.delete_variable_by_id(variable_id)
    if not success:
        raise HTTPException(status_code=404, detail="Variable not found.")
    return
    """Create a new secret."""

@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest, background_tasks: BackgroundTasks):
    """AI chat endpoint that can also trigger builds."""
    try:
        parsed_command = interpret_user_command(request.message)
        command = parsed_command.get("command")
        params = parsed_command.get("parameters", {})

        if command == "build":
            repo_url = params.get("repo")
            branch = params.get("branch", "main")
            aws_credential_name = request.aws_credential_name

            if not repo_url:
                return {"response": "I can't start a build without a repository URL.", "success": False}
            if not aws_credential_name:
                return {"response": "I need to know which AWS credential to use for the build.", "success": False}

            build_id, build_config = build_pipeline_config(repo_url, branch, aws_credential_name)

            db.add_build({
                "id": build_id,
                "status": "pending",
                "repository": repo_url,
                "branch": branch,
                "message": f"Build triggered for {repo_url} via AI command.",
                "stages": [],
            })

            orchestrator = Orchestrator()
            background_tasks.add_task(orchestrator.run_pipeline, build_id, json.dumps(build_config))

            response_message = generate_response_message(parsed_command)
            return {"response": f"{response_message} The Build ID is `{build_id}`.", "success": True, "data": parsed_command}

        else:
            response_message = generate_response_message(parsed_command)
            return {"response": response_message, "success": True, "data": parsed_command}

    except Exception as e:
        logger.error(f"Error in chat_with_ai endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

import os

# Get the absolute path to the frontend dist directory
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))

# Serve frontend static files at /app to avoid overriding /api routes
app.mount("/app", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)