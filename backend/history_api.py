# backend/history_api.py
"""Per-user activity log: disease scans, crop picks, yield estimates, fertilizer recs,
crop calendars, irrigation advice and farm-chat exchanges."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .auth import verify_clerk_session
from .database import ActivityHistory, User, get_db

router = APIRouter(prefix="/api/history", tags=["history"])
log = logging.getLogger("agrivision.history")

ALLOWED_KINDS = {"disease", "crop_rec", "yield", "fertilizer", "calendar", "irrigation", "chat"}


def _ensure_user_row(db: Session, user_data: dict) -> User:
    uid = user_data["id"]
    user = db.query(User).filter(User.id == uid).first()
    if user:
        return user
    email = ""
    if user_data.get("email_addresses"):
        email = user_data["email_addresses"][0].get("email_address", "") or ""
    user = User(
        id=uid,
        email=email or f"{uid}@agrivision.com",
        first_name=user_data.get("first_name") or "User",
        last_name=user_data.get("last_name") or "",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _safe_dump(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, default=str)[:20000]
    except (TypeError, ValueError):
        return ""


async def maybe_log_activity(
    request: Request,
    db: Session,
    *,
    kind: str,
    summary: str,
    input_data: Any,
    output_data: Any,
    language: str = "en",
    field_id: Optional[int] = None,
) -> None:
    """Best-effort log. Silent no-op when user is not signed in or any failure occurs."""
    if kind not in ALLOWED_KINDS:
        return
    try:
        user_data = await verify_clerk_session(request)
        if not user_data or not user_data.get("id"):
            return
        user = _ensure_user_row(db, user_data)
        row = ActivityHistory(
            user_id=user.id,
            field_id=field_id,
            kind=kind,
            summary=(summary or "")[:500],
            input_json=_safe_dump(input_data),
            output_json=_safe_dump(output_data),
            language=(language or "en")[:8],
        )
        db.add(row)
        db.commit()
    except Exception:  # noqa: BLE001
        log.exception("history.log failed kind=%s", kind)
        db.rollback()


def _serialize(row: ActivityHistory, *, full: bool = False) -> dict:
    out = {
        "id": row.id,
        "kind": row.kind,
        "summary": row.summary or "",
        "language": row.language or "en",
        "fieldId": row.field_id,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }
    if full:
        try:
            out["input"] = json.loads(row.input_json) if row.input_json else None
        except (TypeError, ValueError):
            out["input"] = None
        try:
            out["output"] = json.loads(row.output_json) if row.output_json else None
        except (TypeError, ValueError):
            out["output"] = None
    return out


async def _require_user(db: Session, request: Request) -> User:
    user_data = await verify_clerk_session(request)
    if not user_data or not user_data.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    return _ensure_user_row(db, user_data)


@router.get("")
async def list_history(
    request: Request,
    kind: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    user = await _require_user(db, request)
    q = db.query(ActivityHistory).filter(ActivityHistory.user_id == user.id)
    if kind:
        if kind not in ALLOWED_KINDS:
            raise HTTPException(status_code=400, detail="Unknown kind")
        q = q.filter(ActivityHistory.kind == kind)
    rows = q.order_by(desc(ActivityHistory.created_at)).limit(limit).all()
    return {"items": [_serialize(r) for r in rows], "total": len(rows)}


@router.get("/{item_id}")
async def get_history_item(item_id: int, request: Request, db: Session = Depends(get_db)):
    user = await _require_user(db, request)
    row = (
        db.query(ActivityHistory)
        .filter(ActivityHistory.id == item_id, ActivityHistory.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return {"item": _serialize(row, full=True)}


@router.delete("/{item_id}")
async def delete_history_item(item_id: int, request: Request, db: Session = Depends(get_db)):
    user = await _require_user(db, request)
    row = (
        db.query(ActivityHistory)
        .filter(ActivityHistory.id == item_id, ActivityHistory.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"deleted": item_id}


@router.delete("")
async def clear_history(
    request: Request,
    kind: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    user = await _require_user(db, request)
    q = db.query(ActivityHistory).filter(ActivityHistory.user_id == user.id)
    if kind:
        if kind not in ALLOWED_KINDS:
            raise HTTPException(status_code=400, detail="Unknown kind")
        q = q.filter(ActivityHistory.kind == kind)
    n = q.delete(synchronize_session=False)
    db.commit()
    return {"deleted": int(n)}
