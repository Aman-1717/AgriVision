#!/usr/bin/env python3
"""
Run AgriVision. Use from project root: python run.py
   or: python run.py --port 8080
"""
import os
import sys

# Ensure project root is on path so the correct app is loaded (for reload and workers)
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault("PYTHONPATH", project_root)

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(project_root, ".env"))
except ImportError:
    pass

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("AGRIVISION_PORT", "8000"))
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            port = int(sys.argv[idx + 1])
    # Import string required for reload/workers; PYTHONPATH above ensures our app is loaded
    uvicorn.run(
        "backend.app_fastapi:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
