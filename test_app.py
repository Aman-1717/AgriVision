#!/usr/bin/env python3
"""Smoke test the running app. Run from project root: python3 test_app.py"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app_fastapi import app
import uvicorn
import threading
import time
import urllib.request

PORT = 8765


def run_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


if __name__ == "__main__":
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(5)
    ok = True
    for path in ["/", "/docs"]:
        try:
            r = urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=5)
            status = r.status
            r.close()
            print(f"  {path} -> {status}")
            if status != 200:
                ok = False
        except Exception as e:
            print(f"  {path} -> FAIL: {e}")
            ok = False
    print("OK" if ok else "SOME FAILED")
    sys.exit(0 if ok else 1)
