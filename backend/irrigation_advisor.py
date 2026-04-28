# backend/irrigation_advisor.py
"""ET0 (Hargreaves) + Kc-based irrigation advice. Returns per-day depth + volume."""

from __future__ import annotations

import math
from typing import Optional

from pydantic import BaseModel, Field as PField

from .crop_calendar import CALENDAR


# Soil water-holding capacity (mm of plant-available water per cm of soil depth)
# (very rough textbook midpoints; OK for advisory not for engineering).
SOIL_AWC_MM_PER_CM = {
    "sandy": 0.7, "loamy sand": 1.0, "sandy loam": 1.2,
    "loamy": 1.5, "loam": 1.5, "clay loam": 1.8, "silty": 1.7,
    "clay": 2.0, "peaty": 2.2, "chalky": 1.0,
}

# Application efficiency by irrigation method (gross water needed = net / eff)
METHOD_EFFICIENCY = {
    "drip": 0.90, "sprinkler": 0.75, "furrow": 0.60, "flood": 0.50, "basin": 0.55,
}

# Crop root depth (cm) — used to convert AWC to total available water at stage
CROP_ROOT_DEPTH_CM = {
    "rice": 30, "wheat": 90, "maize": 90, "cotton": 120, "tomato": 60,
}

# Management Allowable Depletion fraction (depletion before irrigation triggers)
CROP_MAD = {
    "rice": 0.20, "wheat": 0.55, "maize": 0.50, "cotton": 0.55, "tomato": 0.40,
}


class IrrigationInput(BaseModel):
    crop: str
    stage: Optional[str] = None  # if missing, derive from days_since_sowing
    daysSinceSowing: Optional[int] = None
    soilType: str = "loamy"
    method: str = "drip"
    area: float = PField(default=1.0, ge=0)
    areaUnit: str = "ha"
    tempMaxC: float = 32.0
    tempMinC: float = 22.0
    humidity: float = 60.0
    rainfallMm: float = 0.0
    language: str = "en"


def _hectares(area: float, unit: str) -> float:
    u = (unit or "ha").lower()
    if u in ("acre", "acres"): return area * 0.4046856
    return float(area)


def _hargreaves_et0(t_max: float, t_min: float, ra: float = 30.0) -> float:
    """ET0 in mm/day. `ra` is extraterrestrial radiation in MJ/m^2/day (~30 for tropics)."""
    t_mean = (t_max + t_min) / 2.0
    delta = max(0.5, t_max - t_min)
    return max(0.0, 0.0023 * (t_mean + 17.8) * math.sqrt(delta) * (ra / 2.45))


def _stage_from_days(crop: str, days: int) -> Optional[dict]:
    spec = CALENDAR.get(crop)
    if not spec: return None
    for st in spec["stages"]:
        if st["start_day"] <= days < st["end_day"]:
            return st
    return spec["stages"][-1] if days >= spec["stages"][-1]["start_day"] else spec["stages"][0]


def _resolve_stage(crop: str, stage_key: Optional[str], days: Optional[int]) -> dict:
    spec = CALENDAR.get(crop)
    if not spec:
        raise ValueError(f"Unsupported crop: {crop}. Available: {sorted(CALENDAR)}")
    if stage_key:
        for st in spec["stages"]:
            if st["key"] == stage_key:
                return st
    if days is not None:
        s = _stage_from_days(crop, max(0, int(days)))
        if s: return s
    return spec["stages"][0]


def _hint(language: str, key: str) -> str:
    en = {
        "stress": "Water stress at this stage cuts yield significantly — do not skip.",
        "drain_rice": "Rice needs standing water; depth shown is what to top up after rainfall.",
        "drip_pref": "Drip is preferred for this crop — saves 30–40% water vs. flood.",
        "rain_offset": "Rainfall covers part of today's demand — irrigate the deficit only.",
        "rain_fully_covered": "Rainfall is enough today — skip irrigation, check again tomorrow.",
    }
    hi = {
        "stress": "इस अवस्था में पानी की कमी उपज को काफ़ी घटाती है — सिंचाई न छोड़ें।",
        "drain_rice": "धान में पानी भरा रखें; दिखाई गई मात्रा वर्षा के बाद टॉप-अप के लिए है।",
        "drip_pref": "इस फ़सल के लिए ड्रिप उत्तम है — फ्लड की तुलना में 30–40% पानी की बचत।",
        "rain_offset": "वर्षा से आज की आधी माँग पूरी — केवल कमी सिंचाई करें।",
        "rain_fully_covered": "वर्षा आज की पूरी माँग पूरी कर रही है — आज सिंचाई न करें।",
    }
    return (hi if language == "hi" else en).get(key, "")


def advise(payload: IrrigationInput) -> dict:
    crop = (payload.crop or "").strip().lower()
    stage = _resolve_stage(crop, payload.stage, payload.daysSinceSowing)
    soil = (payload.soilType or "loamy").strip().lower()
    method = (payload.method or "drip").strip().lower()
    eff = METHOD_EFFICIENCY.get(method, 0.75)
    awc_per_cm = SOIL_AWC_MM_PER_CM.get(soil, 1.5)
    root_cm = CROP_ROOT_DEPTH_CM.get(crop, 60)
    mad = CROP_MAD.get(crop, 0.5)
    et0 = _hargreaves_et0(payload.tempMaxC, payload.tempMinC)
    etc = stage["kc"] * et0  # mm/day
    net_today = max(0.0, etc - max(0.0, payload.rainfallMm))
    gross_today_mm = net_today / max(0.1, eff) if net_today > 0 else 0.0
    taw_mm = awc_per_cm * root_cm  # total available water in root zone, mm
    raw_mm = taw_mm * mad  # readily available water before stress
    interval_days = max(1, round(raw_mm / max(0.1, etc)))
    ha = _hectares(payload.area, payload.areaUnit)
    # 1 mm over 1 ha = 10,000 L = 10 m^3
    volume_today_l = round(gross_today_mm * ha * 10000)
    interval_volume_l = round(gross_today_mm * interval_days * ha * 10000)
    notes = []
    if crop == "rice":
        notes.append(_hint(payload.language, "drain_rice"))
    if crop in ("tomato", "cotton") and method != "drip":
        notes.append(_hint(payload.language, "drip_pref"))
    if stage["key"] in ("flowering", "panicle", "tasseling", "squaring", "jointing"):
        notes.append(_hint(payload.language, "stress"))
    if payload.rainfallMm > 0:
        notes.append(_hint(payload.language, "rain_fully_covered" if payload.rainfallMm >= etc else "rain_offset"))
    return {
        "crop": crop, "stage": stage["key"], "stageLabel": stage["label_hi" if payload.language == "hi" else "label_en"],
        "kc": stage["kc"],
        "et0MmDay": round(et0, 2),
        "etcMmDay": round(etc, 2),
        "rainfallMm": round(payload.rainfallMm, 2),
        "netMmToday": round(net_today, 2),
        "grossMmToday": round(gross_today_mm, 2),
        "intervalDays": interval_days,
        "applicationEfficiency": eff,
        "rootDepthCm": root_cm,
        "soilTawMm": round(taw_mm, 1),
        "soilRawMm": round(raw_mm, 1),
        "areaHa": round(ha, 4),
        "volumeTodayL": volume_today_l,
        "volumePerCycleL": interval_volume_l,
        "notes": [n for n in notes if n],
    }
