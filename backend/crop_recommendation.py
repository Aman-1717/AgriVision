"""Crop recommendation: deterministic rule-based shortlist + optional Gemini rationale.

Inputs come from /api/crop-recommendation. The shortlist is always returned (deterministic)
so the feature still works without a Gemini key. When the key is configured, a short
narrative plan is added in the requested language (en/hi).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import google.generativeai as genai

# Compact Indian-context crop database. Ranges are practical bounds for healthy growth,
# not absolute survival limits. Sources: ICAR / FAO ECOCROP summaries.
# Tuple shape: (name_en, name_hi, temp_c, humidity_pct, rainfall_mm, ph, soils, seasons)
CROPS: list[tuple] = [
    ("Rice (Paddy)", "धान", (20, 35), (60, 95), (100, 300), (5.5, 7.0), {"clay", "loamy", "silty"}, {"kharif"}),
    ("Wheat", "गेहूँ", (10, 25), (40, 70), (40, 110), (6.0, 7.5), {"loamy", "clay"}, {"rabi"}),
    ("Maize", "मक्का", (18, 32), (50, 80), (50, 110), (5.5, 7.5), {"loamy", "sandy", "silty"}, {"kharif", "rabi"}),
    ("Cotton", "कपास", (21, 35), (40, 70), (50, 100), (6.0, 8.0), {"loamy", "sandy", "clay"}, {"kharif"}),
    ("Sugarcane", "गन्ना", (20, 35), (60, 85), (75, 165), (6.0, 7.5), {"loamy", "clay"}, {"all"}),
    ("Soybean", "सोयाबीन", (20, 32), (50, 80), (45, 70), (6.0, 7.5), {"loamy", "clay"}, {"kharif"}),
    ("Groundnut", "मूँगफली", (22, 32), (40, 70), (50, 75), (6.0, 7.0), {"sandy", "loamy"}, {"kharif"}),
    ("Mustard", "सरसों", (10, 25), (35, 65), (25, 50), (6.0, 7.5), {"loamy", "clay", "sandy"}, {"rabi"}),
    ("Chickpea (Gram)", "चना", (15, 28), (35, 65), (25, 50), (6.0, 7.5), {"loamy", "sandy"}, {"rabi"}),
    ("Pigeonpea (Arhar)", "अरहर", (20, 32), (50, 75), (60, 100), (6.0, 7.5), {"loamy", "sandy"}, {"kharif"}),
    ("Tomato", "टमाटर", (18, 30), (50, 80), (40, 80), (6.0, 7.0), {"loamy", "sandy"}, {"all"}),
    ("Potato", "आलू", (12, 22), (60, 85), (40, 80), (5.0, 6.5), {"loamy", "sandy"}, {"rabi"}),
    ("Onion", "प्याज", (13, 28), (50, 80), (40, 70), (6.0, 7.5), {"loamy"}, {"rabi"}),
    ("Ragi (Finger millet)", "रागी", (20, 30), (40, 70), (45, 90), (5.0, 8.0), {"sandy", "loamy"}, {"kharif"}),
]


@dataclass
class CropInput:
    soil_type: str
    nitrogen: float
    phosphorous: float
    potassium: float
    ph: float
    temperature: float
    humidity: float
    rainfall: float  # mm per season
    season: str      # "kharif" | "rabi" | "zaid"


def _band(value: float, lo: float, hi: float, half_width: float) -> float:
    if lo <= value <= hi:
        return 1.0
    miss = lo - value if value < lo else value - hi
    return max(0.0, 1.0 - miss / half_width)


def _score_one(crop: tuple, inp: CropInput) -> tuple[float, list[str]]:
    _name, _name_hi, t, h, r, ph, soils, seasons = crop
    soil = inp.soil_type.lower()
    season = inp.season.lower()

    s_temp = _band(inp.temperature, t[0], t[1], 6.0)
    s_hum = _band(inp.humidity, h[0], h[1], 15.0)
    s_rain = _band(inp.rainfall, r[0], r[1], 50.0)
    s_ph = _band(inp.ph, ph[0], ph[1], 1.0)

    soil_ok = 1.0 if soil in soils else 0.0
    season_ok = 1.0 if (season in seasons or "all" in seasons) else 0.0

    env = 0.30 * s_temp + 0.20 * s_hum + 0.25 * s_rain + 0.25 * s_ph
    score = env * (0.6 + 0.4 * soil_ok) * (0.5 + 0.5 * season_ok)

    reasons: list[str] = []
    if s_temp >= 0.8:
        reasons.append(f"temperature {inp.temperature:.0f}°C is in range {t[0]}-{t[1]}°C")
    if s_rain >= 0.8:
        reasons.append(f"rainfall {inp.rainfall:.0f}mm fits the {r[0]}-{r[1]}mm window")
    if s_ph >= 0.8:
        reasons.append(f"pH {inp.ph:.1f} suits {ph[0]:.1f}-{ph[1]:.1f}")
    if soil_ok == 1.0:
        reasons.append(f"{soil} soil is preferred")
    if season_ok == 1.0 and season in seasons:
        reasons.append(f"sown in {season} season")
    if not reasons:
        if soil_ok == 0.0:
            reasons.append(f"{soil} soil is not ideal")
        if season_ok == 0.0:
            reasons.append(f"{season} is off-season")
    return score, reasons


def _suitability(score: float) -> str:
    if score >= 0.65:
        return "high"
    if score >= 0.40:
        return "medium"
    return "low"


def shortlist(inp: CropInput, k: int = 5) -> list[dict]:
    rows: list[dict] = []
    for c in CROPS:
        score, reasons = _score_one(c, inp)
        rows.append({
            "name": c[0],
            "name_hi": c[1],
            "score": round(score, 3),
            "suitability": _suitability(score),
            "reason": "; ".join(reasons[:3]) if reasons else "limited fit overall",
        })
    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows[:k]


_GEMINI_AVAILABLE = False
_gemini_model = None
_gemini_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
if _gemini_key:
    try:
        genai.configure(api_key=_gemini_key)
        _gemini_model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
        _GEMINI_AVAILABLE = True
    except Exception:
        _GEMINI_AVAILABLE = False



def _build_plan_prompt(inp: CropInput, top: list[dict], language: str) -> str:
    lang_dir = (
        "Reply in HINDI (Devanagari script)."
        if language == "hi"
        else "Reply in clear, simple English."
    )
    crops_list = "\n".join(
        f"- {r['name']} (suitability: {r['suitability']})" for r in top[:3]
    )
    return f"""You are an Indian agronomy assistant. {lang_dir}

Farmer inputs:
- Soil: {inp.soil_type}; pH: {inp.ph}
- Air temperature: {inp.temperature} C; Humidity: {inp.humidity}%
- Seasonal rainfall: {inp.rainfall} mm
- Soil-test N: {inp.nitrogen}, P: {inp.phosphorous}, K: {inp.potassium} kg/ha
- Season: {inp.season}

Pre-computed crop shortlist (most suitable first):
{crops_list}

Output rules (follow strictly):
- DO NOT restate the inputs or write a preamble or disclaimer.
- Start the response directly with the heading "## Why these crops".
- Then a heading "## Sowing window & spacing" with one short line per crop.
- Then a heading "## Quick risks to watch" with 3 short bullets specific to the soil/climate.
- Keep each bullet to one line. Total length under 280 words.
- Use simple words a small farmer can understand."""


def _extract_text(resp) -> Optional[str]:
    try:
        t = (resp.text or "").strip()
        if t:
            return t
    except Exception:
        pass
    try:
        for cand in (getattr(resp, "candidates", None) or []):
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) if content else None
            if not parts:
                continue
            joined = "\n\n".join((getattr(p, "text", "") or "") for p in parts).strip()
            if joined:
                return joined
    except Exception:
        return None
    return None


def gemini_plan(inp: CropInput, top: list[dict], language: str) -> Optional[str]:
    if not _GEMINI_AVAILABLE or _gemini_model is None:
        return None
    try:
        prompt = _build_plan_prompt(inp, top, language)
        resp = _gemini_model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.45,
                "top_p": 0.9,
                "top_k": 40,
                "max_output_tokens": 4096,
            },
        )
        return _extract_text(resp)
    except Exception as e:
        print(f"crop_recommendation gemini_plan failed: {type(e).__name__}: {e}")
        return None


def _fallback_plan(top: list[dict], language: str) -> str:
    if language == "hi":
        bullets = "\n".join(
            f"- **{r['name']} ({r['name_hi']})** — {r['suitability']}: {r['reason']}"
            for r in top[:3]
        )
        return (
            "## क्यों ये फ़सलें\n"
            f"{bullets}\n\n"
            "## जोखिम\n"
            "- स्थानीय मौसम पूर्वानुमान देखें।\n"
            "- मिट्टी की जल-निकासी जाँचें।\n"
            "- हर 10–14 दिन में कीट-निगरानी रखें।"
        )
    bullets = "\n".join(
        f"- **{r['name']}** — {r['suitability']}: {r['reason']}" for r in top[:3]
    )
    return (
        "## Why these crops\n"
        f"{bullets}\n\n"
        "## Quick risks to watch\n"
        "- Track the local weather forecast.\n"
        "- Verify soil drainage matches the crop.\n"
        "- Scout for pests every 10–14 days."
    )


def recommend(inp: CropInput, language: str = "en") -> dict:
    top = shortlist(inp, k=5)
    plan = gemini_plan(inp, top, language) or _fallback_plan(top, language)
    return {"topCrops": top, "plan": plan}
