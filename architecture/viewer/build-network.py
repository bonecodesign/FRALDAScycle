"""Compatibility command: generate the private ADM snapshot only."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[2]
subprocess.run(["node", str(root / "platform/tools/architecture-network.mjs")], cwd=root, check=True)
