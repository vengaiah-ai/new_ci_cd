#!/usr/bin/env python3
import os
import subprocess
import logging
from typing import Dict

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def load_scan_tools() -> Dict[str, Dict]:
    """Load user-defined scanners from environment or config file."""
    # Expect a JSON or YAML config file path via env SCAN_CONFIG_PATH
    path = os.getenv("SCAN_CONFIG_PATH")
    if not path or not os.path.exists(path):
        logger.error("SCAN_CONFIG_PATH not set or file missing")
        return {}
    import yaml
    cfg = yaml.safe_load(open(path))
    return cfg.get("scanning_tools", {})

def run_tool(name: str, tool_conf: Dict):
    logger.info(f"Running scan: {name}")
    env = os.environ.copy()
    env.update(tool_conf.get("env", {}))
    cmd = tool_conf.get("command")
    report_path = tool_conf.get("report")
    if not cmd:
        logger.error(f"No command defined for {name}")
        return
    logger.info(f"Cmd: {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=tool_conf.get("cwd", "."), env=env)
    logger.info(f"{name} exited with {result.returncode}")
    if result.returncode != 0:
        logger.error(f"{name} failed. Logs available on console. Report path: {report_path}")
    else:
        logger.info(f"{name} completed successfully. Report written to: {report_path}")

def main():
    tools = load_scan_tools()
    if not tools:
        logger.error("No scan tools configured. Exiting.")
        return
    for name, conf in tools.items():
        run_tool(name, conf)

if __name__ == "__main__":
    main()
