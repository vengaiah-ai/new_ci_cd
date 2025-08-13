# orchestrator.py
import json
import logging
import threading

from .ci_agent import CIAgent
from .cd_agent import CDAgent
from . import db

logger = logging.getLogger(__name__)
from typing import Optional, Dict, List, Any


class Orchestrator:
    def __init__(self):
        pass

    def run_pipeline(self, build_id: str, config_json: str, env_variables: Optional[Dict[str, str]] = None):
        try:
            logger.info(f"[{build_id}] Orchestrator received build request.")
            config = json.loads(config_json)
            logger.info(f"[{build_id}] Build config loaded successfully.")

            # Pass build_id to agents
            logger.info(f"[{build_id}] Instantiating CIAgent...")
            ci_agent = CIAgent(build_id, config, env_variables)
            logger.info(f"[{build_id}] CIAgent instantiated. Starting CI process...")
            image_uri = ci_agent.run()

            if image_uri:
                logger.info(f"[{build_id}] CI process successful. Image URI: {image_uri}. Starting CD process...")
                cd_agent = CDAgent(build_id, config, env_variables)
                cd_agent.run(image_uri)
                logger.info(f"[{build_id}] CD process completed.")
            else:
                logger.error(f"[{build_id}] CI agent failed; skipping deployment.")
                db.update_build(build_id, {"status": "failed", "message": "CI agent failed to produce an image URI."})

        except Exception as e:
            logger.error(f"[{build_id}] An unhandled exception occurred in the orchestrator's run_pipeline.", exc_info=True)
            db.update_build(build_id, {"status": "failed", "message": f"Orchestrator failed: {str(e)}"})

    def run_parallel(self, configs, env_variables_list: Optional[List[Dict[str, str]]] = None):
        # Run multiple pipelines in parallel threads
        threads = []
        for i, config_json in enumerate(configs):
            env_variables = env_variables_list[i] if env_variables_list else None
            thread = threading.Thread(target=self.run_pipeline, args=(config_json, env_variables))
            thread.start()
            threads.append(thread)
        for t in threads:
            t.join()

if __name__ == "__main__":
    # Read command-line arguments
    import sys
    if len(sys.argv) < 2:
        print("Usage: python orchestrator.py <config_path> [image_uri]")
        sys.exit(1)

    config_path = sys.argv[1]
    with open(config_path) as f:
        config = json.load(f)

    orchestrator = Orchestrator()

    # If an image_uri is provided, run only the CD agent
    if len(sys.argv) > 2:
        image_uri = sys.argv[2]
        print(f"CI step skipped. Running CD agent directly with image: {image_uri}")
        cd_agent = CDAgent(config)
        cd_agent.run(image_uri)
    else:
        # Otherwise, run the full CI/CD pipeline
        print("Running full CI/CD pipeline...")
        config_data_str = json.dumps(config)
        orchestrator.run_pipeline(config_data_str)
