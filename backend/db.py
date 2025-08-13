import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.dirname(__file__)
BUILDS_FILE = os.path.join(DATA_DIR, 'build_history.json')
SECRETS_FILE = os.path.join(DATA_DIR, 'secrets.json')
AWS_CREDS_FILE = os.path.join(DATA_DIR, 'aws_credentials.json')
VARIABLES_FILE = os.path.join(DATA_DIR, 'variables.json')

def load_data(file_path: str) -> List[Dict[str, Any]]:
    """Load data from a JSON file."""
    if not os.path.exists(file_path):
        return []
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError):
        return []

def save_data(file_path: str, data: List[Dict[str, Any]]) -> None:
    """Save data to a JSON file."""
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4, default=str)

# Build Functions
def get_all_builds() -> List[Dict[str, Any]]:
    return load_data(BUILDS_FILE)

def get_build_by_id(build_id: str) -> Optional[Dict[str, Any]]:
    builds = get_all_builds()
    return next((build for build in builds if build['id'] == build_id), None)

def add_build(build_data: Dict[str, Any]) -> Dict[str, Any]:
    builds = get_all_builds()
    # Only generate a new ID if one isn't already provided
    if 'id' not in build_data or not build_data['id']:
        build_data['id'] = f"build_{datetime.now().strftime('%Y%m%d_%H%M%S%f')}"
    build_data['startTime'] = datetime.now().isoformat()
    builds.insert(0, build_data)
    save_data(BUILDS_FILE, builds)
    return build_data

def update_build(build_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    builds = get_all_builds()
    for build in builds:
        if build['id'] == build_id:
            build.update(updates)
            if 'endTime' not in updates:
                 build['endTime'] = datetime.now().isoformat()
            save_data(BUILDS_FILE, builds)
            return build
    return None

# Secret Functions
def get_all_secrets() -> List[Dict[str, Any]]:
    return load_data(SECRETS_FILE)

def add_secret(secret_data: Dict[str, Any]) -> Dict[str, Any]:
    secrets = get_all_secrets()
    secret_data['id'] = f"secret_{datetime.now().strftime('%Y%m%d_%H%M%S%f')}"
    secret_data['lastModified'] = datetime.now().isoformat()
    # In a real app, value should be encrypted
    secret_data['isEncrypted'] = False 
    secrets.append(secret_data)
    save_data(SECRETS_FILE, secrets)
    return secret_data

def get_secret_by_name(name: str) -> Optional[Dict[str, Any]]:
    secrets = get_all_secrets()
    return next((secret for secret in secrets if secret.get('name') == name), None)

# AWS Credential Set Functions
def get_all_aws_credential_sets() -> List[Dict[str, Any]]:
    """Retrieves all AWS credential sets."""
    return load_data(AWS_CREDS_FILE)

def get_aws_credential_set_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Finds a single AWS credential set by its unique name."""
    creds = get_all_aws_credential_sets()
    return next((c for c in creds if c.get('name') == name), None)

def add_aws_credential_set(cred_data: Dict[str, Any]) -> Dict[str, Any]:
    """Adds a new AWS credential set to the database."""
    creds = get_all_aws_credential_sets()
    # Simple validation to prevent duplicates
    if any(c['name'] == cred_data['name'] for c in creds):
        raise ValueError(f"An AWS credential set with the name '{cred_data['name']}' already exists.")

    cred_data['id'] = f"aws_{datetime.now().strftime('%Y%m%d_%H%M%S%f')}"
    cred_data['lastModified'] = datetime.now().isoformat()
    # In a real app, values should be encrypted
    creds.append(cred_data)
    save_data(AWS_CREDS_FILE, creds)
    return cred_data

def delete_aws_credential_set_by_name(name: str) -> bool:
    """Deletes an AWS credential set by its name. Returns True if successful."""
    creds = get_all_aws_credential_sets()
    original_count = len(creds)
    creds_to_keep = [c for c in creds if c.get('name') != name]
    
    if len(creds_to_keep) < original_count:
        save_data(AWS_CREDS_FILE, creds_to_keep)
        return True
    return False

# Environment Variable Functions
def get_all_variables() -> List[Dict[str, Any]]:
    """Retrieves all environment variables."""
    return load_data(VARIABLES_FILE)

def add_variable(variable_data: Dict[str, Any]) -> Dict[str, Any]:
    """Adds a new environment variable to the database."""
    variables = get_all_variables()
    
    # Check if variable with same key already exists
    if any(v.get('key') == variable_data.get('key') for v in variables):
        raise ValueError(f"A variable with key '{variable_data.get('key')}' already exists.")
    
    # Add metadata
    variable_data['id'] = f"var_{uuid.uuid4().hex}"
    variable_data['createdAt'] = datetime.now().isoformat()
    variable_data['updatedAt'] = variable_data['createdAt']
    
    variables.append(variable_data)
    save_data(VARIABLES_FILE, variables)
    return variable_data

def get_variable_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Finds a single variable by its name (key)."""
    variables = get_all_variables()
    return next((v for v in variables if v.get('key') == name), None)

def get_variable_by_id(variable_id: str) -> Optional[Dict[str, Any]]:
    """Finds a single variable by its ID."""
    variables = get_all_variables()
    return next((v for v in variables if v.get('id') == variable_id), None)

def update_variable(variable_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Updates an existing variable."""
    variables = get_all_variables()
    for var in variables:
        if var.get('id') == variable_id:
            var.update(updates)
            var['lastModified'] = datetime.utcnow().isoformat()
            save_data(VARIABLES_FILE, variables)
            return var
    return None

def delete_variable_by_id(variable_id: str) -> bool:
    """Deletes a variable by its ID. Returns True if successful."""
    variables = get_all_variables()
    original_count = len(variables)
    variables_to_keep = [v for v in variables if v.get('id') != variable_id]
    
    if len(variables_to_keep) < original_count:
        save_data(VARIABLES_FILE, variables_to_keep)
        return True
    return False
