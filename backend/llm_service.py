# llm_service.py
import os
import logging
import json
from pathlib import Path
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

# Get the absolute path to the root directory
root_dir = Path(__file__).parent.parent
env_path = root_dir / '.env'

# Load environment variables from the root .env file
load_dotenv(env_path, override=True)

# Debug: Print environment variables (remove in production)
print(f"Loading .env from: {env_path}")
print(f"GROQ_API_KEY present: {'YES' if os.getenv('GROQ_API_KEY') else 'NO'}")

logger = logging.getLogger(__name__)

# Initialize the LLM globally to be reused
try:
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise ValueError("GROQ_API_KEY not found in environment variables")
    
    # Unset HTTP proxy environment variables to prevent proxy-related issues
    if 'HTTP_PROXY' in os.environ:
        del os.environ['HTTP_PROXY']
    if 'HTTPS_PROXY' in os.environ:
        del os.environ['HTTPS_PROXY']
    if 'http_proxy' in os.environ:
        del os.environ['http_proxy']
    if 'https_proxy' in os.environ:
        del os.environ['https_proxy']
        
    # Initialize the LLM client
    llm = ChatGroq(
        api_key=groq_api_key,
        model_name="llama-3.3-70b-versatile",
        temperature=0.1
    )
    
    # Test the connection with a simple request
    llm.invoke("Test connection")
    logger.info("Groq LLM service initialized successfully with model 'llama-3.3-70b-versatile'.")
except Exception as e:
    logger.error(f"Failed to initialize Groq LLM service: {e}")
    llm = None

def create_command_parser_chain():
    """Creates a LangChain chain to parse natural language commands into structured JSON."""
    if not llm:
        logger.error("LLM not initialized, cannot create command parser chain.")
        return None
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert parser for a DevOps platform. Your task is to convert a user's natural language input into a structured JSON object.
        
        Available Operations:
        1. Build Operations:
           - build <repo> [branch] - Start a new build for a repository
           - status [build_id] - Check status of a build
           
        2. Deployment Operations:
           - deploy <service> [version] - Deploy a service
           - list deployments - List all deployments
           
        3. Repository Operations:
           - list repos - List available repositories
           - repo info <name> - Get info about a repository
           
        4. Help:
           - help - Show this help message
        
        Response Format (JSON):
        {{
            "command": "build|deploy|status|list|help",
            "target": "repository|service|build_id",
            "parameters": {{
                "repo": "repository_name_or_url",
                "branch": "branch_name",
                "build_id": "build_identifier",
                "service": "service_name",
                "version": "version_number"
            }},
            "error": null|{{"message": "error description"}}
        }}
        
        Examples:
        User: build the frontend repo on main branch
        {{"command": "build", "target": "repository", "parameters": {{"repo": "frontend", "branch": "main"}}}}
        
        User: what's the status of build 123?
        {{"command": "status", "target": "build", "parameters": {{"build_id": "123"}}}}
        
        User: list all repositories
        {{"command": "list", "target": "repos", "parameters": {{}}}}
        """),
        ("user", "{command}")
    ])
    
    def parse_and_validate_output(text: str) -> dict:
        """Parse the LLM output and validate the structure."""
        import re
        # Regex to find the first JSON object in the text. Handles surrounding text.
        match = re.search(r'\{.*\}', text, re.DOTALL)
        
        if not match:
            logger.error(f"No JSON object found in LLM output: {text}")
            return {
                "command": "error",
                "target": "system",
                "parameters": {},
                "error": {"message": "Could not find a valid JSON object in the response."}
            }
            
        json_text = match.group(0)

        try:
            result = json.loads(json_text)
            
            # Basic validation
            if not isinstance(result, dict):
                raise ValueError("Expected a JSON object")
                
            if "command" not in result:
                raise ValueError("Missing 'command' field")
                
            # Ensure parameters is a dict
            if "parameters" not in result:
                result["parameters"] = {}
            elif not isinstance(result["parameters"], dict):
                result["parameters"] = {}
                
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM output: {text}")
            return {
                "command": "error",
                "target": "system",
                "parameters": {},
                "error": {"message": f"Failed to parse command: {str(e)}"}
            }
        except Exception as e:
            logger.error(f"Error processing command: {str(e)}")
            return {
                "command": "error",
                "target": "system",
                "parameters": {},
                "error": {"message": f"Error processing command: {str(e)}"}
            }
    
    # Create the chain with output parsing
    chain = prompt | llm | StrOutputParser()
    
    # Add output parsing and validation
    return lambda inputs: parse_and_validate_output(chain.invoke(inputs))

def create_failure_analyzer_chain():
    """Creates a LangChain chain to analyze error logs and suggest solutions."""
    if not llm:
        logger.error("LLM not initialized, cannot create failure analyzer chain.")
        return None

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert DevOps engineer. You will be given an error log from a failed CI/CD pipeline.
        Your task is to:
        1. Briefly explain the most likely root cause of the error in simple terms.
        2. Provide a clear, actionable suggestion for how to fix it.
        Keep your response concise and helpful.
        """),
        ("user", "Error Log:\n---\n{error_log}\n---")
    ])

    return prompt | llm | StrOutputParser()