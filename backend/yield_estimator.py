"""Yield estimator: deterministic per-hectare estimate from crop, soil, NPK and climate.

Numbers are typical Indian-context averages from ICAR / FAO summaries — central yield
plus a +/-15% band for normal field variability. Adjustment factors capture nutrient
adequacy, climate fit, soil match, and irrigation availability.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import google.generativeai as genai

# Tuple shape:
# (key, name_en, name_hi, base_qtl_ha, n_demand, p_demand, k_demand, soils,
#  temp, humidity, rainfall, rainfed_capable)
CROPS: list[tuple] = [
    ("rice", "Rice (Paddy)", "धान", 45.0, 120, 60, 60, {"clay", "loamy", "silty"},
     (20, 35), (60, 95), (100, 300), False),
    ("wheat", "Wheat", "गेहूँ", 35.0, 120, 60, 40, {"loamy", "clay"},
     (10, 25), (40, 70), (40, 110), False),
    ("maize", "Maize", "मक्का", 45.0, 150, 75, 40, {"loamy", "sandy", "silty"},
     (18, 32), (50, 80), (50, 110), True),
    ("cotton", "Cotton", "कपास", 10.0, 120, 60, 60, {"loamy", "sandy", "clay"},
     (21, 35), (40, 70), (50, 100), True),
    ("sugarcane", "Sugarcane", "गन्ना", 800.0, 250, 115, 115, {"loamy", "clay"},
     (20, 35), (60, 85), (75, 165), False),
    ("soybean", "Soybean", "सोयाबीन", 18.0, 30, 60, 40, {"loamy", "clay"},
     (20, 32), (50, 80), (45, 70), True),
    ("groundnut", "Groundnut", "मूँगफली", 20.0, 25, 50, 75, {"sandy", "loamy"},
     (22, 32), (40, 70), (50, 75), True),
    ("mustard", "Mustard", "सरसों", 12.0, 80, 40, 40, {"loamy", "clay", "sandy"},
     (10, 25), (35, 65), (25, 50), True),
    ("chickpea", "Chickpea (Gram)", "चना", 15.0, 25, 50, 25, {"loamy", "sandy"},
     (15, 28), (35, 65), (25, 50), True),
    ("pigeonpea", "Pigeonpea (Arhar)", "अरहर", 12.0, 25, 50, 30, {"loamy", "sandy"},
     (20, 32), (50, 75), (60, 100), True),
    ("tomato", "Tomato", "टमाटर", 300.0, 120, 80, 100, {"loamy", "sandy"},
     (18, 30), (50, 80), (40, 80), False),
    ("potato", "Potato", "आलू", 250.0, 150, 80, 100, {"loamy", "sandy"},
     (12, 22), (60, 85), (40, 80), False),
    ("onion", "Onion", "प्याज", 300.0, 100, 50, 80, {"loamy"},
     (13, 28), (50, 80), (40, 70), False),
    ("ragi", "Ragi (Finger millet)", "रागी", 20.0, 50, 40, 25, {"sandy", "loamy"},
     (20, 30), (40, 70), (45, 90), True),
]

CROP_INDEX = {c[0]: c for c in CROPS}


@dataclass
class YieldInput:
    crop: str          # one of CROP_INDEX keys
    area: float        # numeric area
    area_unit: str     # "ha" or "acre"
    soil_type: str
    nitrogen: float    # applied / available kg/ha
    phosphorous: float
    potassium: float
    temperature: float
    humidity: float
    rainfall: float    # mm per season
    irrigated: bool


def _band(value: float, lo: float, hi: float, half_width: float) -> float:
    if lo <= value <= hi:
        return 1.0
    miss = lo - value if value < lo else value - hi
    return max(0.0, 1.0 - miss / half_width)


def _clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _nutrient_factor(n: float, p: float, k: float, demand: tuple[int, int, int]) -> float:
    n_d, p_d, k_d = demand
    # sqrt for diminishing returns; weighted N(0.4) P(0.3) K(0.3); clip [0.4, 1.15]
    fn = (max(n, 0) / max(n_d, 1)) ** 0.5
    fp = (max(p, 0) / max(p_d, 1)) ** 0.5
    fk = (max(k, 0) / max(k_d, 1)) ** 0.5
    raw = 0.4 * fn + 0.3 * fp + 0.3 * fk
    return _clip(raw, 0.4, 1.15)


def _climate_factor(crop: tuple, inp: YieldInput) -> float:
    _k, _ne, _nh, _b, _nd, _pd, _kd, _soils, t, h, r, _rf = crop
    s_temp = _band(inp.temperature, t[0], t[1], 6.0)
    s_hum = _band(inp.humidity, h[0], h[1], 15.0)
    s_rain = _band(inp.rainfall, r[0], r[1], 50.0)
    env = 0.40 * s_temp + 0.20 * s_hum + 0.40 * s_rain
    return _clip(0.6 + 0.4 * env, 0.6, 1.0)


def _soil_factor(crop: tuple, inp: YieldInput) -> float:
    soils = crop[7]
    return 1.0 if inp.soil_type.lower() in soils else 0.85


def _irrigation_factor(crop: tuple, inp: YieldInput) -> float:
    rainfed_ok = bool(crop[11])
    if inp.irrigated:
        return 1.0
    return 0.85 if rainfed_ok else 0.70


def _to_ha(area: float, unit: str) -> float:
    u = (unit or "").lower()
    if u in ("acre", "acres"):
        return area * 0.404686
    return area  # default ha


def estimate(inp: YieldInput) -> dict:
    crop = CROP_INDEX.get((inp.crop or "").lower())
    if not crop:
        raise ValueError(f"Unknown crop key: {inp.crop!r}")
    base = float(crop[3])
    demand = (crop[4], crop[5], crop[6])
    f_nut = _nutrient_factor(inp.nitrogen, inp.phosphorous, inp.potassium, demand)
    f_cli = _climate_factor(crop, inp)
    f_soil = _soil_factor(crop, inp)
    f_irr = _irrigation_factor(crop, inp)
    yield_qtl_ha = base * f_nut * f_cli * f_soil * f_irr
    area_ha = _to_ha(inp.area, inp.area_unit)
    total_qtl = yield_qtl_ha * area_ha
    return {
        "cropKey": crop[0],
        "cropName": crop[1],
        "cropNameHi": crop[2],
        "areaHa": round(area_ha, 4),
        "baselineQtlPerHa": base,
        "estimateQtlPerHa": round(yield_qtl_ha, 1),
        "lowQtlPerHa": round(yield_qtl_ha * 0.85, 1),
        "highQtlPerHa": round(yield_qtl_ha * 1.15, 1),
        "totalQtl": round(total_qtl, 1),
        "totalTonnes": round(total_qtl / 10.0, 2),
        "factors": {
            "nutrient": round(f_nut, 3),
            "climate": round(f_cli, 3),
            "soil": round(f_soil, 3),
            "irrigation": round(f_irr, 3),
        },
    }



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


def _build_narrative_prompt(inp: YieldInput, est: dict, language: str) -> str:
    lang_dir = (
        "Reply in HINDI (Devanagari script)."
        if language == "hi"
        else "Reply in clear, simple English."
    )
    factors = est["factors"]
    return f"""You are an Indian agronomy assistant. {lang_dir}

Pre-computed yield estimate (do NOT recompute):
- Crop: {est['cropName']}
- Area: {est['areaHa']} ha
- Yield band: {est['lowQtlPerHa']}-{est['highQtlPerHa']} qtl/ha (central {est['estimateQtlPerHa']} qtl/ha)
- Total expected: {est['totalQtl']} qtl ({est['totalTonnes']} tonnes)
- Adjustment factors (1.0 = no change): nutrient={factors['nutrient']}, climate={factors['climate']}, soil={factors['soil']}, irrigation={factors['irrigation']}

Farmer inputs:
- Soil: {inp.soil_type}; Irrigation: {"yes" if inp.irrigated else "no"}
- Air temperature: {inp.temperature} C; Humidity: {inp.humidity}%; Seasonal rainfall: {inp.rainfall} mm
- Soil-test N: {inp.nitrogen}, P: {inp.phosphorous}, K: {inp.potassium} kg/ha

Output rules (follow strictly):
- DO NOT restate the numbers above; refer to them naturally.
- DO NOT add a preamble or disclaimer.
- Start with the heading "## What is helping" listing 2-3 bullets of the strongest positive factors.
- Then "## What is holding it back" with 2-3 bullets identifying the weakest factor(s) and why.
- Then "## Two simple changes" with 2 actionable, specific steps that could lift yield this season or next.
- Total length under 220 words. One line per bullet. Use simple words a small farmer can understand."""


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


def gemini_narrative(inp: YieldInput, est: dict, language: str) -> Optional[str]:
    if not _GEMINI_AVAILABLE or _gemini_model is None:
        return None
    try:
        prompt = _build_narrative_prompt(inp, est, language)
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
        print(f"yield_estimator gemini_narrative failed: {type(e).__name__}: {e}")
        return None


def _fallback_narrative(est: dict, language: str) -> str:
    f = est["factors"]
    weakest = min(f, key=lambda k: f[k])
    strongest = max(f, key=lambda k: f[k])
    if language == "hi":
        names = {"nutrient": "पोषक तत्व", "climate": "मौसम", "soil": "मिट्टी", "irrigation": "सिंचाई"}
        return (
            "## क्या मदद कर रहा है\n"
            f"- सबसे मज़बूत कारक: **{names[strongest]}** ({f[strongest]:.2f}).\n"
            "## क्या रोक रहा है\n"
            f"- सबसे कमज़ोर कारक: **{names[weakest]}** ({f[weakest]:.2f}).\n"
            "## दो आसान बदलाव\n"
            "- मिट्टी जाँच के अनुसार पोषक संतुलन सुधारें।\n"
            "- मौसम के अनुसार सिंचाई/कीट निगरानी बढ़ाएँ।"
        )
    names = {"nutrient": "nutrients", "climate": "climate", "soil": "soil", "irrigation": "irrigation"}
    return (
        "## What is helping\n"
        f"- Strongest factor: **{names[strongest]}** ({f[strongest]:.2f}).\n"
        "## What is holding it back\n"
        f"- Weakest factor: **{names[weakest]}** ({f[weakest]:.2f}). Address this first.\n"
        "## Two simple changes\n"
        "- Re-balance NPK against soil-test demand for this crop.\n"
        "- Tighten irrigation/scout schedule with current weather."
    )


def estimate_with_narrative(inp: YieldInput, language: str = "en") -> dict:
    est = estimate(inp)
    narrative = gemini_narrative(inp, est, language) or _fallback_narrative(est, language)
    est["narrative"] = narrative
    return est
