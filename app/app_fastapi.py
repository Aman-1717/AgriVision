"""Shim: use `uvicorn backend.app_fastapi:app` or `python run.py` (preferred)."""
from backend.app_fastapi import app  # noqa: F401
