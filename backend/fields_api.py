# backend/fields_api.py
"""Per-user CRUD for tracked fields. Auth via Clerk session, persistence via SQLAlchemy."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field as PField, field_validator
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .auth import verify_clerk_session
from .database import Field as FieldModel, User, get_db

router = APIRouter(prefix="/api/fields", tags=["fields"])


class FieldIn(BaseModel):
    name: str = PField(min_length=1, max_length=80)
    area: float = PField(ge=0)
    areaUnit: str = "ha"
    soilType: str = ""
    crop: str = ""
    sowingDate: Optional[str] = None  # ISO date "YYYY-MM-DD"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: str = ""

    @field_validator("areaUnit")
    @classmethod
    def _unit_ok(cls, v: str) -> str:
        u = (v or "ha").lower()
        return "acre" if u in ("acre", "acres") else "ha"


class FieldUpdate(BaseModel):
    name: Optional[str] = PField(default=None, min_length=1, max_length=80)
    area: Optional[float] = PField(default=None, ge=0)
    areaUnit: Optional[str] = None
    soilType: Optional[str] = None
    crop: Optional[str] = None
    sowingDate: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


def _parse_iso_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except ValueError:
            return None


def _serialize(f: FieldModel) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "area": f.area,
        "areaUnit": f.area_unit,
        "soilType": f.soil_type or "",
        "crop": f.crop or "",
        "sowingDate": f.sowing_date.date().isoformat() if f.sowing_date else None,
        "latitude": f.latitude,
        "longitude": f.longitude,
        "notes": f.notes or "",
        "createdAt": f.created_at.isoformat() if f.created_at else None,
        "updatedAt": f.updated_at.isoformat() if f.updated_at else None,
    }


async def _ensure_user(db: Session, request: Request) -> User:
    user_data = await verify_clerk_session(request)
    if not user_data or not user_data.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = user_data.get("id")
    email = ""
    if user_data.get("email_addresses"):
        email = user_data["email_addresses"][0].get("email_address", "") or ""
    first_name = user_data.get("first_name") or "User"
    last_name = user_data.get("last_name") or ""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=email or f"{user_id}@agrivision.com",
            first_name=first_name,
            last_name=last_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.get("")
async def list_fields(request: Request, db: Session = Depends(get_db)):
    user = await _ensure_user(db, request)
    rows = (
        db.query(FieldModel)
        .filter(FieldModel.user_id == user.id)
        .order_by(desc(FieldModel.updated_at))
        .all()
    )
    return {"fields": [_serialize(r) for r in rows]}


@router.post("")
async def create_field(payload: FieldIn, request: Request, db: Session = Depends(get_db)):
    user = await _ensure_user(db, request)
    field = FieldModel(
        user_id=user.id,
        name=payload.name.strip(),
        area=float(payload.area),
        area_unit=payload.areaUnit,
        soil_type=(payload.soilType or "").strip(),
        crop=(payload.crop or "").strip(),
        sowing_date=_parse_iso_date(payload.sowingDate),
        latitude=payload.latitude,
        longitude=payload.longitude,
        notes=(payload.notes or "").strip(),
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return {"field": _serialize(field)}


@router.patch("/{field_id}")
async def update_field(
    field_id: int,
    payload: FieldUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    user = await _ensure_user(db, request)
    field = (
        db.query(FieldModel)
        .filter(FieldModel.id == field_id, FieldModel.user_id == user.id)
        .first()
    )
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        field.name = str(data["name"]).strip()
    if "area" in data and data["area"] is not None:
        field.area = float(data["area"])
    if "areaUnit" in data and data["areaUnit"] is not None:
        u = (data["areaUnit"] or "ha").lower()
        field.area_unit = "acre" if u in ("acre", "acres") else "ha"
    for src, dst in (("soilType", "soil_type"), ("crop", "crop"), ("notes", "notes")):
        if src in data and data[src] is not None:
            setattr(field, dst, str(data[src]).strip())
    if "sowingDate" in data:
        field.sowing_date = _parse_iso_date(data["sowingDate"])
    if "latitude" in data:
        field.latitude = data["latitude"]
    if "longitude" in data:
        field.longitude = data["longitude"]
    db.commit()
    db.refresh(field)
    return {"field": _serialize(field)}


@router.delete("/{field_id}")
async def delete_field(field_id: int, request: Request, db: Session = Depends(get_db)):
    user = await _ensure_user(db, request)
    field = (
        db.query(FieldModel)
        .filter(FieldModel.id == field_id, FieldModel.user_id == user.id)
        .first()
    )
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()
    return {"deleted": field_id}
