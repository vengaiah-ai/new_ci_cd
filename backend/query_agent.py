import logging
import json
from typing import Optional
from .llm_service import create_command_parser_chain

import re  # Needed for regex extraction in your new code

logger = logging.getLogger(__name__)
command_parser_chain = create_command_parser_chain()

def interpret_user_command(command: str) -> Optional[dict]:
    """
    Uses the LLM chain to parse a natural language command into a structured task.
    Fulfills the Query Agent requirement.
    """
    logger.info(f"Query Agent processing command with LangChain: '{command}'")
    if not command_parser_chain:
        logger.error("Command parser chain is not available.")
        return None
    
    try:
        # The chain now directly returns a parsed dictionary.
        parsed_response = command_parser_chain({"command": command})
        logger.info(f"LangChain parsed response: {parsed_response}")
        return parsed_response
    except Exception as e:
        logger.error(f"An error occurred during command interpretation: {e}", exc_info=True)
        return None