# backend/crop_calendar.py
"""Per-crop growth-stage calendar with day offsets and recommended activities."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from pydantic import BaseModel, Field as PField


# Each stage: (key, label_en, label_hi, start_day, end_day, kc_avg,
#              activities_en, activities_hi). Day offsets are from sowing.
_S = lambda key, en, hi, s, e, kc, a_en, a_hi: {  # noqa: E731
    "key": key, "label_en": en, "label_hi": hi,
    "start_day": s, "end_day": e, "kc": kc,
    "activities_en": a_en, "activities_hi": a_hi,
}

CALENDAR: dict[str, dict] = {
    "rice": {"duration_days": 120, "stages": [
        _S("nursery", "Nursery / Sowing", "नर्सरी / बुवाई", 0, 25, 1.05,
           ["Puddle the field, apply basal N+P+K", "Maintain 2–3 cm standing water", "Treat seeds before sowing"],
           ["खेत में कीचड़ बनाएँ, N+P+K की बेसल खुराक दें", "2–3 सेमी पानी बनाए रखें", "बीज को बुवाई से पहले उपचारित करें"]),
        _S("tillering", "Tillering", "कल्ले फूटना", 25, 55, 1.20,
           ["First top-dressing of N", "Hand-weed or apply selective weedicide", "Watch for stem borer"],
           ["N की पहली टॉप-ड्रेसिंग", "हाथ से निराई या चयनात्मक खरपतवारनाशी", "तना छेदक पर नज़र रखें"]),
        _S("panicle", "Panicle initiation", "बाली बनना", 55, 80, 1.20,
           ["Second top-dressing of N+K", "Maintain 5 cm water", "Scout for blast/BLB"],
           ["N+K की दूसरी टॉप-ड्रेसिंग", "5 सेमी पानी बनाए रखें", "ब्लास्ट / BLB की निगरानी"]),
        _S("flowering", "Flowering", "फूल आना", 80, 100, 1.10,
           ["Avoid water stress", "Spray fungicide if humid"],
           ["जल तनाव न होने दें", "नमी अधिक हो तो फफूँदनाशक छिड़काव"]),
        _S("maturity", "Grain filling & harvest", "पकना व कटाई", 100, 120, 0.90,
           ["Drain field 7–10 days before harvest", "Harvest at 80% golden grains"],
           ["कटाई से 7–10 दिन पहले पानी निकालें", "80% सुनहरे दानों पर कटाई"]),
    ]},
    "wheat": {"duration_days": 130, "stages": [
        _S("germination", "Sowing & germination", "बुवाई व अंकुरण", 0, 15, 0.55,
           ["Sow at 4–5 cm depth", "First irrigation (CRI) at 20–25 days"],
           ["4–5 सेमी गहराई पर बुवाई", "पहली सिंचाई 20–25 दिन (CRI)"]),
        _S("tillering", "Tillering", "कल्ले फूटना", 15, 50, 0.95,
           ["Top-dress urea after CRI", "Weed control by 30 days"],
           ["CRI के बाद यूरिया टॉप-ड्रेसिंग", "30 दिन तक खरपतवार नियंत्रण"]),
        _S("jointing", "Jointing & booting", "गांठ बनना", 50, 80, 1.15,
           ["Irrigate at jointing & booting", "Watch for rust", "Second N split"],
           ["गांठ व बूटिंग पर सिंचाई", "रस्ट पर निगरानी", "N की दूसरी मात्रा"]),
        _S("flowering", "Heading & flowering", "बाली व फूल", 80, 100, 1.15,
           ["Critical irrigation", "Spray fungicide if rust seen"],
           ["महत्वपूर्ण सिंचाई", "रस्ट दिखे तो फफूँदनाशक छिड़काव"]),
        _S("maturity", "Grain filling & harvest", "पकना व कटाई", 100, 130, 0.45,
           ["Last irrigation at milk stage", "Harvest at 14–16% grain moisture"],
           ["दूधिया अवस्था पर अंतिम सिंचाई", "14–16% दाने की नमी पर कटाई"]),
    ]},
    "maize": {"duration_days": 110, "stages": [
        _S("germination", "Sowing & germination", "बुवाई व अंकुरण", 0, 12, 0.40,
           ["Treat seed", "Light first irrigation"],
           ["बीज उपचार", "हल्की पहली सिंचाई"]),
        _S("vegetative", "Vegetative (V6–V12)", "वृद्धि अवस्था", 12, 50, 1.05,
           ["Top-dress urea at knee-high", "Hand weed twice"],
           ["घुटने ऊँचा होने पर यूरिया", "दो बार निराई"]),
        _S("tasseling", "Tasseling & silking", "नर-मादा फूल", 50, 75, 1.20,
           ["Avoid moisture stress (most critical)", "Watch for fall armyworm"],
           ["नमी की कमी से बचें (सबसे महत्वपूर्ण)", "फॉल आर्मीवर्म की निगरानी"]),
        _S("grain", "Grain fill", "दाना भरना", 75, 100, 1.05,
           ["Steady irrigation", "Final top-dress if pale"],
           ["नियमित सिंचाई", "पीलापन हो तो अंतिम टॉप-ड्रेसिंग"]),
        _S("harvest", "Maturity & harvest", "पकना व कटाई", 100, 110, 0.60,
           ["Harvest when husks brown & kernels hard"],
           ["भूसी भूरी व दाने सख़्त होने पर कटाई"]),
    ]},
    "cotton": {"duration_days": 170, "stages": [
        _S("germination", "Sowing & germination", "बुवाई व अंकुरण", 0, 20, 0.45,
           ["Treat seed against sucking pests"],
           ["रसचूसक कीटों से बीज उपचार"]),
        _S("vegetative", "Vegetative", "वृद्धि", 20, 60, 0.90,
           ["First top-dress N", "Inter-cultivation"],
           ["N की पहली टॉप-ड्रेसिंग", "अंतर-कर्षण"]),
        _S("squaring", "Squaring & flowering", "स्क्वायरिंग व फूल", 60, 110, 1.20,
           ["Critical irrigation window", "Scout for bollworm & whitefly"],
           ["सिंचाई की महत्वपूर्ण खिड़की", "बॉलवर्म व सफेद मक्खी की निगरानी"]),
        _S("boll", "Boll development", "गूलर विकास", 110, 150, 1.15,
           ["Maintain even moisture", "Boron / K spray if shedding"],
           ["समान नमी बनाए रखें", "गिराव हो तो बोरॉन / K स्प्रे"]),
        _S("harvest", "Boll opening & picking", "गूलर खुलना व चुनाई", 150, 170, 0.65,
           ["Stop irrigation before first picking", "Pick in 3–4 rounds"],
           ["पहली चुनाई से पहले सिंचाई बंद", "3–4 राउंड में चुनाई"]),
    ]},
    "tomato": {"duration_days": 110, "stages": [
        _S("nursery", "Nursery", "नर्सरी", 0, 25, 0.50,
           ["Raise seedlings on raised beds", "Transplant at 4–5 leaf stage"],
           ["उठी क्यारियों पर पौध तैयार करें", "4–5 पत्ती पर रोपाई"]),
        _S("vegetative", "Vegetative", "वृद्धि", 25, 50, 0.85,
           ["Stake plants", "First N+K top-dress"],
           ["पौधों को सहारा दें", "N+K टॉप-ड्रेसिंग"]),
        _S("flowering", "Flowering & fruit set", "फूल व फल बनना", 50, 80, 1.15,
           ["Steady irrigation (avoid blossom-end rot)", "Calcium spray if needed"],
           ["नियमित सिंचाई (BER से बचाव)", "जरूरत हो तो कैल्शियम स्प्रे"]),
        _S("fruit", "Fruit development", "फल विकास", 80, 100, 1.05,
           ["Watch for early blight", "Pick mature green fruits regularly"],
           ["अर्ली ब्लाइट की निगरानी", "पके हरे फल नियमित तोड़ें"]),
        _S("harvest", "Harvest", "कटाई", 100, 110, 0.80,
           ["Pick every 2–3 days", "Sort for market grade"],
           ["हर 2–3 दिन पर तुड़ाई", "ग्रेडिंग कर बाज़ार भेजें"]),
    ]},
}


class CalendarRequest(BaseModel):
    crop: str
    sowingDate: Optional[str] = None  # ISO date; defaults to today
    language: str = "en"


def _parse_date(s: Optional[str]) -> date:
    if not s:
        return date.today()
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return date.today()


_CROP_NAME_HI = {
    "rice": "धान", "wheat": "गेहूँ", "maize": "मक्का",
    "cotton": "कपास", "tomato": "टमाटर",
}


def list_crops(language: str = "en") -> list[dict]:
    use_hi = language == "hi"
    return [
        {
            "key": k,
            "name": (_CROP_NAME_HI.get(k, k.title()) if use_hi else k.title()),
            "duration": v["duration_days"],
        }
        for k, v in CALENDAR.items()
    ]


def build_timeline(crop: str, sowing: date, language: str = "en") -> dict:
    crop_l = (crop or "").strip().lower()
    spec = CALENDAR.get(crop_l)
    if not spec:
        raise ValueError(f"Unsupported crop: {crop}. Available: {sorted(CALENDAR)}")
    today = date.today()
    days_in = (today - sowing).days
    out_stages = []
    current_key = None
    label_field = "label_hi" if language == "hi" else "label_en"
    act_field = "activities_hi" if language == "hi" else "activities_en"
    for st in spec["stages"]:
        s_date = sowing + timedelta(days=st["start_day"])
        e_date = sowing + timedelta(days=st["end_day"])
        is_current = st["start_day"] <= days_in < st["end_day"]
        if is_current:
            current_key = st["key"]
        out_stages.append({
            "key": st["key"],
            "label": st[label_field],
            "startDay": st["start_day"], "endDay": st["end_day"],
            "startDate": s_date.isoformat(), "endDate": e_date.isoformat(),
            "kc": st["kc"],
            "activities": list(st[act_field]),
            "isCurrent": is_current,
            "isPast": days_in >= st["end_day"],
        })
    harvest = sowing + timedelta(days=spec["duration_days"])
    return {
        "crop": crop_l, "sowingDate": sowing.isoformat(),
        "harvestDate": harvest.isoformat(),
        "durationDays": spec["duration_days"],
        "daysSinceSowing": days_in,
        "daysToHarvest": max(0, (harvest - today).days),
        "currentStageKey": current_key,
        "stages": out_stages,
    }


def available_crops() -> list[str]:
    return sorted(CALENDAR.keys())
