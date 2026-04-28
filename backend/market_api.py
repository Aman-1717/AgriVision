# /api/market — India-only mandi / wholesale reference using location (lat/lon).
# 1) Reverse-geocode to state & district (OpenStreetMap Nominatim; use-policy compliant).
# 2) Optional live rows from data.gov.in (AGMARKNET-style) when DATA_GOV_IN_API_KEY + resource id are set.
# 3) Otherwise state-wise indicative Rs./Quintal bands (reference only; verify at mandi / Agmarknet / e-NAM).
import logging
import os
import re
import unicodedata
from datetime import date, datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException, Query

from .weather_api import _httpx_verify

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/market", tags=["market"])

# OpenStreetMap Nominatim: https://operations.osmfoundation.org/policies/nominatim/ — one request per use + User-Agent
_NOMINATIM = "https://nominatim.openstreetmap.org"
_IST = ZoneInfo("Asia/Kolkata")
_USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "AgriVision/1.0 (+https://github.com/; farm advisory app, India)",
)

# data.gov.in — "Variety-wise Daily Market Prices" (OAS 2.0)
# Set DATA_GOV_IN_API_KEY and DATA_GOV_IN_MANDI_RESOURCE in .env (no keys or resource ids in code).
# Optional: DATA_GOV_IN_QUERY_LIMIT (default 500), DATA_GOV_IN_CKAN_LIMIT (default 100) for request sizes.
# Optional: DATA_GOV_IN_DATASTORE_BASE (default https://data.gov.in) for legacy /api/datastore/resource.json fallback.


def _data_gov_key() -> str:
    """Read on each use so edits to .env apply after reload / without editing code."""
    k = os.getenv("DATA_GOV_IN_API_KEY")
    return k.strip() if k else ""


def _data_gov_resource() -> str:
    r = os.getenv("DATA_GOV_IN_MANDI_RESOURCE")
    return r.strip() if r else ""


def _ogd_query_limit() -> int:
    try:
        v = int((os.getenv("DATA_GOV_IN_QUERY_LIMIT") or "500").strip())
        return max(1, min(5000, v))
    except ValueError:
        return 500


def _ogd_ckan_limit() -> int:
    try:
        v = int((os.getenv("DATA_GOV_IN_CKAN_LIMIT") or "100").strip())
        return max(1, min(5000, v))
    except ValueError:
        return 100


def _norm_state(s: str) -> str:
    t = "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )
    t = t.lower().strip()
    t = re.sub(r"\s+", " ", t)
    return t


def _in_india_bounds(lat: float, lon: float) -> bool:
    return 6.2 <= lat <= 37.4 and 67.0 <= lon <= 98.5


# Indicative weekly-style bands (₹/Quintal) for major items — not live trades; for UX when OGD is not configured.
# Sources public domain reporting / MSP order-of-magnitude; always verify locally.
_INRICATIVE: dict[str, list[dict[str, Any]]] = {
    "default": [
        {
            "commodity": "Rice (common)",
            "variety": "—",
            "min_price": 1800,
            "max_price": 2600,
            "modal_price": 2200,
            "market": "All-India ref.",
        },
        {
            "commodity": "Wheat",
            "variety": "—",
            "min_price": 1900,
            "max_price": 2500,
            "modal_price": 2200,
            "market": "All-India ref.",
        },
        {
            "commodity": "Onion",
            "variety": "—",
            "min_price": 800,
            "max_price": 2200,
            "modal_price": 1400,
            "market": "All-India ref.",
        },
        {
            "commodity": "Potato",
            "variety": "—",
            "min_price": 500,
            "max_price": 1400,
            "modal_price": 900,
            "market": "All-India ref.",
        },
        {
            "commodity": "Tomato",
            "variety": "—",
            "min_price": 600,
            "max_price": 5000,
            "modal_price": 1800,
            "market": "All-India ref.",
        },
        {
            "commodity": "Tur (Arhar) dal",
            "variety": "—",
            "min_price": 5800,
            "max_price": 8000,
            "modal_price": 6800,
            "market": "All-India ref.",
        },
    ],
    "karnataka": [
        {
            "commodity": "Onion",
            "variety": "Local",
            "min_price": 900,
            "max_price": 2100,
            "modal_price": 1400,
            "market": "Bengaluru (ref.)",
        },
        {
            "commodity": "Tomato",
            "variety": "Local",
            "min_price": 500,
            "max_price": 3500,
            "modal_price": 1600,
            "market": "Hubli / Dharwad (ref.)",
        },
        {
            "commodity": "Maize",
            "variety": "—",
            "min_price": 1600,
            "max_price": 2100,
            "modal_price": 1850,
            "market": "Karnataka (ref.)",
        },
        {
            "commodity": "Rice",
            "variety": "Sona Masuri (ref.)",
            "min_price": 2400,
            "max_price": 3400,
            "modal_price": 2900,
            "market": "Mysuru region (ref.)",
        },
    ],
    "maharashtra": [
        {
            "commodity": "Onion",
            "variety": "Local",
            "min_price": 800,
            "max_price": 2200,
            "modal_price": 1500,
            "market": "Nashik belt (ref.)",
        },
        {
            "commodity": "Soybean",
            "variety": "—",
            "min_price": 3800,
            "max_price": 5000,
            "modal_price": 4400,
            "market": "Marathwada (ref.)",
        },
        {
            "commodity": "Cotton",
            "variety": "—",
            "min_price": 6500,
            "max_price": 8200,
            "modal_price": 7400,
            "market": "Vidarbha (ref.)",
        },
        {
            "commodity": "Tur (Arhar)",
            "variety": "—",
            "min_price": 6000,
            "max_price": 8200,
            "modal_price": 7000,
            "market": "Maharashtra (ref.)",
        },
    ],
    "uttar pradesh": [
        {
            "commodity": "Wheat",
            "variety": "—",
            "min_price": 2000,
            "max_price": 2600,
            "modal_price": 2300,
            "market": "W UP / NCR hinterland (ref.)",
        },
        {
            "commodity": "Potato",
            "variety": "—",
            "min_price": 450,
            "max_price": 1200,
            "modal_price": 750,
            "market": "Agra / Farrukhabad (ref.)",
        },
        {
            "commodity": "Sugarcane (Gur ref.)",
            "variety": "—",
            "min_price": 3200,
            "max_price": 4000,
            "modal_price": 3600,
            "market": "West UP (ref.)",
        },
    ],
    "punjab": [
        {
            "commodity": "Wheat",
            "variety": "—",
            "min_price": 2000,
            "max_price": 2600,
            "modal_price": 2300,
            "market": "Mandi board ref.",
        },
        {
            "commodity": "Basmati rice",
            "variety": "—",
            "min_price": 3600,
            "max_price": 5200,
            "modal_price": 4200,
            "market": "Mandi system (ref.)",
        },
    ],
    "haryana": [
        {
            "commodity": "Wheat",
            "variety": "—",
            "min_price": 2000,
            "max_price": 2550,
            "modal_price": 2280,
            "market": "Haryana (ref.)",
        },
        {
            "commodity": "Mustard",
            "variety": "—",
            "min_price": 5000,
            "max_price": 6200,
            "modal_price": 5600,
            "market": "Haryana (ref.)",
        },
    ],
    "gujarat": [
        {
            "commodity": "Cotton",
            "variety": "—",
            "min_price": 7000,
            "max_price": 8600,
            "modal_price": 7800,
            "market": "Saurashtra (ref.)",
        },
        {
            "commodity": "Groundnut",
            "variety": "—",
            "min_price": 5200,
            "max_price": 6400,
            "modal_price": 5800,
            "market": "Gujarat (ref.)",
        },
    ],
    "west bengal": [
        {
            "commodity": "Rice",
            "variety": "—",
            "min_price": 2000,
            "max_price": 2800,
            "modal_price": 2400,
            "market": "Burdwan / Medinipur (ref.)",
        },
        {
            "commodity": "Potato",
            "variety": "—",
            "min_price": 500,
            "max_price": 1200,
            "modal_price": 850,
            "market": "WB (ref.)",
        },
    ],
    "bihar": [
        {
            "commodity": "Maize",
            "variety": "—",
            "min_price": 1500,
            "max_price": 2000,
            "modal_price": 1750,
            "market": "Bihar (ref.)",
        },
        {
            "commodity": "Lentils (masur)",
            "variety": "—",
            "min_price": 5200,
            "max_price": 7000,
            "modal_price": 6000,
            "market": "Bihar (ref.)",
        },
    ],
    "madhya pradesh": [
        {
            "commodity": "Soybean",
            "variety": "—",
            "min_price": 4000,
            "max_price": 5200,
            "modal_price": 4600,
            "market": "Mandi network (ref.)",
        },
        {
            "commodity": "Wheat",
            "variety": "—",
            "min_price": 1980,
            "max_price": 2500,
            "modal_price": 2250,
            "market": "M.P. (ref.)",
        },
    ],
    "telangana": [
        {
            "commodity": "Cotton",
            "variety": "—",
            "min_price": 6800,
            "max_price": 8000,
            "modal_price": 7400,
            "market": "TS (ref.)",
        },
        {
            "commodity": "Turmeric",
            "variety": "—",
            "min_price": 12000,
            "max_price": 18000,
            "modal_price": 15000,
            "market": "Nizamabad belt (ref.)",
        },
    ],
    "tamil nadu": [
        {
            "commodity": "Rice",
            "variety": "—",
            "min_price": 2000,
            "max_price": 2800,
            "modal_price": 2400,
            "market": "Delta region (ref.)",
        },
        {
            "commodity": "Banana",
            "variety": "—",
            "min_price": 1500,
            "max_price": 3500,
            "modal_price": 2200,
            "market": "TN (ref.)",
        },
    ],
    "kerala": [
        {
            "commodity": "Coconut (copra ref.)",
            "variety": "—",
            "min_price": 10000,
            "max_price": 14000,
            "modal_price": 12000,
            "market": "Kerala (ref.)",
        },
        {
            "commodity": "Black pepper",
            "variety": "—",
            "min_price": 42000,
            "max_price": 62000,
            "modal_price": 50000,
            "market": "Wayanad (ref.)",
        },
    ],
    "andhra pradesh": [
        {
            "commodity": "Chilli (dry ref.)",
            "variety": "—",
            "min_price": 16000,
            "max_price": 24000,
            "modal_price": 20000,
            "market": "Guntur belt (ref.)",
        },
        {
            "commodity": "Rice",
            "variety": "—",
            "min_price": 2200,
            "max_price": 3000,
            "modal_price": 2600,
            "market": "AP (ref.)",
        },
    ],
    "rajasthan": [
        {
            "commodity": "Guar seed",
            "variety": "—",
            "min_price": 5000,
            "max_price": 7000,
            "modal_price": 6000,
            "market": "Jodhpur side (ref.)",
        },
        {
            "commodity": "Mustard",
            "variety": "—",
            "min_price": 4800,
            "max_price": 6000,
            "modal_price": 5400,
            "market": "Rajasthan (ref.)",
        },
    ],
    "odisha": [
        {
            "commodity": "Paddy (ref. rice chain)",
            "variety": "—",
            "min_price": 1500,
            "max_price": 2100,
            "modal_price": 1800,
            "market": "Coastal Odisha (ref.)",
        },
    ],
    "assam": [
        {
            "commodity": "Rice",
            "variety": "—",
            "min_price": 1900,
            "max_price": 2800,
            "modal_price": 2300,
            "market": "Brahmaputra valley (ref.)",
        },
    ],
}


async def _nominatim_reverse_in(lat: float, lon: float) -> dict[str, Any]:
    if not _in_india_bounds(lat, lon):
        raise HTTPException(
            status_code=400,
            detail="Location appears outside the India service area. Use coordinates within India for mandi context.",
        )
    try:
        async with httpx.AsyncClient(timeout=12.0, verify=_httpx_verify()) as client:
            r = await client.get(
                f"{_NOMINATIM}/reverse",
                params={
                    "lat": lat,
                    "lon": lon,
                    "format": "json",
                    "addressdetails": 1,
                    "accept-language": "en",
                },
                headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
            )
    except httpx.RequestError as e:
        log.warning("Nominatim request failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not resolve location. Try again shortly.") from e
    if r.status_code != 200:
        raise HTTPException(
            status_code=502, detail="Location lookup failed. Try a different point or use Weather page to refresh GPS."
        )
    return r.json()


def _parse_in_region(data: dict[str, Any]) -> dict[str, str]:
    ad = data.get("address") or {}
    cc = (ad.get("country_code") or "").lower()
    if cc != "in":
        raise HTTPException(
            status_code=400,
            detail="Market analysis (India) is only available for locations inside India. Set an Indian location on the Weather page or pick GPS within India.",
        )
    state = (ad.get("state") or ad.get("region") or "").strip() or "—"
    district = (
        ad.get("state_district")
        or ad.get("county")
        or ad.get("city_district")
        or ad.get("county_district")
        or ad.get("city")
        or ad.get("town")
        or ad.get("village")
        or "—"
    )
    if isinstance(district, str):
        district = district.strip() or "—"
    name = (data.get("display_name") or "").strip() or f"{state}, India"
    return {
        "state": state,
        "district": str(district),
        "display_name": name,
    }


def _get_indicative_rows(state_key: str) -> list[dict[str, Any]]:
    sk = _norm_state(state_key)
    if sk in _INRICATIVE and sk != "default":
        return [dict(x, unit="Rs./Quintal", arrival_date=None) for x in _INRICATIVE[sk]]
    return [dict(x, unit="Rs./Quintal", arrival_date=None) for x in _INRICATIVE["default"]]


def _g(row: dict[str, Any], *cands: str) -> Any:
    """Match common AGMARK/OGD column spellings (case-insensitive, substring)."""
    lk = {k.lower().strip().replace(" ", "_"): v for k, v in row.items() if isinstance(k, str)}
    for c in cands:
        cl = c.lower()
        for k, v in lk.items():
            if cl in k or k.startswith(cl):
                return v
    return None


def _parse_ogd_arrival(s: str | None) -> Optional[date]:
    if s is None:
        return None
    t = str(s).strip()
    if not t:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%y"):
        for chunk in (t[:10], t):
            try:
                return datetime.strptime(chunk, fmt).date()
            except ValueError:
                continue
    return None


def _arrival_sort_key(arv: str | None) -> int:
    d = _parse_ogd_arrival(arv)
    return d.toordinal() if d is not None else 0


def _state_row_matches(s_low: str, st: str) -> bool:
    st_l = st.lower()
    if not s_low or not st_l:
        return True
    if s_low in st_l or st_l in s_low:
        return True
    a = set(s_low.split())
    b = set(st_l.split())
    return bool(a and b and (a & b))


def _district_row_matches(user_d: str, row_d: str) -> bool:
    if not user_d or user_d == "—":
        return True
    u = re.sub(r"\s+", " ", user_d).strip().lower()
    r = re.sub(r"\s+", " ", str(row_d or "")).strip().lower()
    if not r:
        return True
    if u in r or r in u:
        return True
    du = {x for x in u.split() if len(x) > 2}
    dr = {x for x in r.split() if len(x) > 2}
    if len(du) >= 2 and (du & dr) and len(du & dr) >= min(2, len(du)):
        return True
    return any(tok in r for tok in u.split() if len(tok) > 3)


# Max source rows to scan to build a de-duplicated, diverse set (after geo filters).
_OGD_MAX_SCAN = 5000
_OGD_MAX_OUT = 32


def _pick_ogd_records(
    records: list[dict[str, Any]],
    state_name: str,
    district: str,
    *,
    require_district: bool = False,
) -> list[dict[str, Any]]:
    """
    Map OGD/Agmarknet-shaped rows, filter by state (always) and optionally district, then
    de-duplicate on (commodity, variety) keeping the most recent Arrival_Date.
    Scans a large window so the API can return 500+ rows in one order without listing one commodity 24x.
    """
    out: list[dict[str, Any]] = []
    s_low = _norm_state(state_name)
    d_sub = (district or "").strip() if district and district != "—" else ""

    n = 0
    for row in records:
        n += 1
        if n > _OGD_MAX_SCAN:
            break
        st = str(_g(row, "state", "State_Name", "State") or "")
        if s_low and st and not _state_row_matches(s_low, st):
            continue
        dis = str(_g(row, "district", "dist", "District_Name") or "")
        d_part = dis.strip() if dis else ""
        if d_sub and require_district:
            if not d_part or not _district_row_matches(d_sub, d_part):
                continue
        com = _g(row, "commodity", "Commodity", "commodity_name", "Commodity_Name")
        if com is None or str(com).strip() == "":
            continue
        try:
            min_v = _g(row, "min", "min_price", "min_price_rs", "Min_Price")
            max_v = _g(row, "max", "max_price", "max_price_rs", "Max_Price")
            min_p = float(min_v) if min_v is not None and str(min_v).strip() != "" else 0.0
            max_p = float(max_v) if max_v is not None and str(max_v).strip() != "" else 0.0
            mod = _g(row, "modal", "modal_price", "modal_price_rs", "Modal_Price", "MP")
            modal = float(mod) if mod is not None and str(mod).strip() != "" else (min_p + max_p) / 2 if max_p or min_p else 0.0
        except (TypeError, ValueError):
            continue
        mkt = str(
            _g(row, "market", "mandi", "mkt", "apmc", "Market", "MktName", "market_name", "Market_Name")
            or "—"
        )
        var_ = str(_g(row, "variety", "Variety") or "—")
        ad = _g(row, "arrival", "arrival_date", "Arrival_Date", "arrivaldate")
        ad_s = str(ad).strip() if ad is not None and str(ad).strip() != "" else None
        out.append(
            {
                "commodity": str(com).strip(),
                "variety": var_,
                "min_price": round(min_p, 2),
                "max_price": round(max_p, 2),
                "modal_price": round(modal, 2),
                "market": mkt,
                "arrival_date": ad_s,
                "unit": "Rs./Quintal",
            }
        )
    if not out:
        return []
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for r in out:
        k = (r["commodity"].lower().strip(), (r.get("variety") or "—").lower().strip())
        prev = by_key.get(k)
        if prev is None or _arrival_sort_key(r.get("arrival_date")) >= _arrival_sort_key(prev.get("arrival_date")):
            by_key[k] = r
    deduped = list(by_key.values())
    deduped.sort(key=lambda x: (x.get("commodity") or "").lower())
    return deduped[:_OGD_MAX_OUT]


def _is_invalid_resource_err(msg: str) -> bool:
    m = (msg or "").lower()
    return "invalid resource" in m or "invalid resource id" in m


def _is_ogd_rate_limited(msg: str) -> bool:
    return "rate limit" in (msg or "").lower()


async def _ckan_datastore_search_rows(
    state_name: str, district: str
) -> tuple[list[dict[str, Any]], Optional[str], Optional[str]]:
    """
    Fallback when api.data.gov.in/resource/{id}.json rejects the resource id (OGP/Ckan mirror).
    """
    key = _data_gov_key()
    resource = _data_gov_resource()
    if not key or not resource:
        return [], None, None
    ckan_url = (os.getenv("DATA_GOV_IN_CKAN_ACTION_URL") or "").strip() or "https://data.gov.in/api/3/action/datastore_search"
    body: dict[str, Any] = {
        "resource_id": resource,
        "limit": _ogd_ckan_limit(),
    }
    st = state_name.strip()
    dist = (district or "").strip() if district and district != "—" else ""
    body["filters"] = {"State": st, "District": dist} if dist else {"State": st}
    err: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=25.0, verify=_httpx_verify()) as client:
            r = await client.post(
                ckan_url,
                params={"api-key": key},
                json=body,
                headers={
                    "User-Agent": _USER_AGENT,
                    "Accept": "application/json",
                },
            )
    except httpx.RequestError as e:
        return [], None, str(e)
    if r.status_code != 200:
        return [], None, f"CKAN HTTP {r.status_code}"
    try:
        data = r.json()
    except Exception as e:  # noqa: BLE001
        return [], None, str(e)
    if not isinstance(data, dict):
        return [], None, "CKAN: non-object response"
    if data.get("success") is False:
        emsg = str(data.get("error") or data.get("message") or data)
        return [], None, f"CKAN: {emsg}"
    res = data.get("result") or {}
    rec = res.get("records") or []
    u = res.get("resource_id")
    ustr: Optional[str] = str(u) if u else None
    return rec, ustr, err


def _ist_date_today() -> str:
    """Arrival date format on OGD is often DD/MM/YYYY; filter is optional."""
    return datetime.now(_IST).strftime("%d/%m/%Y")


async def _fetch_data_gov_rows(state_name: str, district: str) -> tuple[list[dict[str, Any]], Optional[str], Optional[str]]:
    key = _data_gov_key()
    resource = _data_gov_resource()
    if not key or not resource:
        return [], None, None
    # OGD 2.2+ docs use: .../resource/{id}?api-key=...&format=json — not .../resource/{id}.json (wrong handler → "Invalid Resource id")
    base = f"https://api.data.gov.in/resource/{resource}"
    ds_base = (os.getenv("DATA_GOV_IN_DATASTORE_BASE") or "https://data.gov.in").rstrip("/")
    datastore_url = f"{ds_base}/api/datastore/resource.json"
    st_title = state_name.strip()
    dist = (district or "").strip() if district and district != "—" else ""
    err: Optional[str] = None
    updated: Optional[str] = None

    async def _get(url: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], Optional[str], Optional[str]]:
        try:
            async with httpx.AsyncClient(timeout=24.0, verify=_httpx_verify()) as client:
                r = await client.get(
                    url,
                    params=params,
                    headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
                )
        except httpx.RequestError as e:
            return [], None, str(e)
        if r.status_code != 200:
            return [], None, f"HTTP {r.status_code}"
        try:
            data = r.json()
        except Exception as e:  # noqa: BLE001
            return [], None, str(e)
        if isinstance(data, dict) and data.get("error"):
            return [], None, f"data.gov.in: {data.get('error')}"
        if isinstance(data, dict) and (data.get("status") or "").lower() in ("error", "errors"):
            ve = data.get("validation_errors") or data.get("message") or data
            return [], None, f"data.gov.in: {ve}"
        rec = data.get("records") or []
        if not rec and "record" in data:
            rec = [data["record"]]
        u = data.get("updated")
        ustr: Optional[str] = u if isinstance(u, str) else None
        return rec, ustr, None

    async def _get_datastore_merged(p: dict[str, Any]) -> tuple[list[dict[str, Any]], Optional[str], Optional[str]]:
        """Legacy portal URL from https://data.gov.in/help/how-use-datasets-apis (resource.json query API)."""
        merged = {**p, "resource_id": resource}
        return await _get(datastore_url, merged)

    # OAS: filters[State], filters[District] (capital S, D) — not filters[state]
    limit_cap = _ogd_query_limit()
    base_params: dict[str, Any] = {
        "api-key": key,
        "format": "json",
        "limit": limit_cap,
    }

    # 1) State + District (if we have a district label from Nominatim)
    if dist:
        p = {
            **base_params,
            "filters[State]": st_title,
            "filters[District]": dist,
        }
        records, u, e = await _get(base, p)
        if e:
            err = e
        if u:
            updated = u
        rows = _pick_ogd_records(records, state_name, district, require_district=True)
        if not rows and records:
            rows = _pick_ogd_records(records, state_name, district, require_district=False)
        if rows:
            return rows, updated, err

    # 2) State only
    p2 = {**base_params, "filters[State]": st_title}
    records2, u2, e2 = await _get(base, p2)
    if e2 and not err:
        err = e2
    if u2:
        updated = u2
    rows2 = _pick_ogd_records(records2, state_name, district, require_district=False)
    if rows2:
        return rows2, updated, err

    # 3) Today’s Arrival_Date (IST) + State — helps when the portal expects today’s file
    p3 = {**p2, "filters[Arrival_Date]": _ist_date_today()}
    records3, u3, e3 = await _get(base, p3)
    if e3 and not err:
        err = e3
    if u3:
        updated = u3
    rows3 = _pick_ogd_records(records3, state_name, district, require_district=False)
    if rows3:
        return rows3, updated, err

    # 4) Unfiltered slice — filter in code
    p4 = dict(base_params)
    records4, u4, e4 = await _get(base, p4)
    if e4 and not err:
        err = e4
    if u4:
        updated = u4
    rows4 = _pick_ogd_records(records4, state_name, district, require_district=False)
    if rows4:
        return rows4, updated, err

    # 4b) CKAN-style GET on data.gov.in (older docs: …/api/datastore/resource.json?resource_id=…)
    if not rows4:
        ds_order: list[dict[str, Any]] = [p2, p4]
        if dist:
            ds_order.insert(0, p)
        for p_ds in ds_order:
            rds, uds, e_ds = await _get_datastore_merged(p_ds)
            if e_ds and not err:
                err = e_ds
            if uds and not updated:
                updated = uds
            req_d = "filters[District]" in p_ds
            rxd = _pick_ogd_records(rds, state_name, district, require_district=req_d)
            if not rxd and rds:
                rxd = _pick_ogd_records(rds, state_name, district, require_district=False)
            if rxd:
                return rxd, updated, err

    # 5) CKAN action API (JSON POST) — some datasets only work via this mirror
    if err and _is_invalid_resource_err(str(err)):
        log.info("data.gov.in resource API rejected id; trying CKAN datastore_search")
    rec5, u5, e5 = await _ckan_datastore_search_rows(state_name, district)
    if e5 and not err:
        err = f"{err or ''} | CKAN: {e5}".strip(" |")
    if u5 and not updated:
        updated = u5
    ckan_strict = bool(dist and dist != "—")
    rows5 = _pick_ogd_records(rec5, state_name, district, require_district=ckan_strict)
    if not rows5 and rec5:
        rows5 = _pick_ogd_records(rec5, state_name, district, require_district=False)
    if rows5:
        return rows5, updated, err

    # 6) CKAN without State filter (column names can differ)
    if not rec5 and _is_invalid_resource_err(str(err or "")):
        try:
            async with httpx.AsyncClient(timeout=25.0, verify=_httpx_verify()) as client:
                ckan_url = (os.getenv("DATA_GOV_IN_CKAN_ACTION_URL") or "").strip() or "https://data.gov.in/api/3/action/datastore_search"
                r6 = await client.post(
                    ckan_url,
                    params={"api-key": key},
                    json={"resource_id": resource, "limit": _ogd_ckan_limit()},
                    headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
                )
            if r6.status_code == 200:
                d6 = r6.json()
                if d6.get("success") and (d6.get("result") or {}).get("records"):
                    rec6 = d6["result"]["records"]
                    rows6 = _pick_ogd_records(rec6, state_name, district, require_district=False)
                    if rows6:
                        return rows6, updated, err
        except (httpx.RequestError, KeyError, TypeError, ValueError) as e6:
            log.info("CKAN unfiltered try: %s", e6)

    return rows4, updated, err


def _volatility_bullet(rows: list[dict[str, Any]], lang: str) -> str:
    if not rows:
        return ""
    w = 0.0
    m = 0.0
    for r in rows[:8]:
        lo = float(r.get("min_price") or 0)
        hi = float(r.get("max_price") or 0)
        if hi > 0 and hi >= lo:
            w = max(w, (hi - lo) / max(hi, 1) * 100)
    if lang.startswith("hi"):
        if w > 35:
            return "कुछ कमोडिटी में मूल्य स्प्रेड अधिक दिख रहा है—स्थानीय मांडी में पुष्टि करें।"
        return "तुलनात्मक रूप से मूल्य सीमाएँ नियंत्रित दिख रही हैं; फिर भी मांडी काउंटर पर सत्यापित करें।"
    if w > 35:
        return "Wide min–max spreads for some items — confirm the modal rate at your mandi before you sell."
    return "Min–max bands look relatively stable for the selected rows; still verify at the mandi counter."


def _build_analysis(
    state: str,
    district: str,
    mode: str,
    rows: list[dict[str, Any]],
    lang: str,
) -> dict[str, Any]:
    top: list[str] = []
    _seen_c: set[str] = set()
    for r in rows:
        c = (r.get("commodity") or "").strip()
        if not c:
            continue
        key = c.lower()
        if key in _seen_c:
            continue
        _seen_c.add(key)
        top.append(c)
        if len(top) >= 3:
            break
    headline = ""
    if lang.startswith("hi"):
        headline = f"{state} — {district}: आज का केंद्रित रुझान"
        if mode == "live_ogd":
            sub = f"ऊपर दी गई पंक्तियाँ OGD/Agmarknet श्रृंखला पर आधारित उद्धरण दिखा रही हैं।"
        else:
            sub = f"ऊपर के आंकड़े संकेतक बैंड हैं (लाइव नहीं)। वास्तविक मूल्य मांडी/पोर्टल पर।"
        bullets = [sub, _volatility_bullet(rows, lang)]
    else:
        headline = f"{state} — {district}: market snapshot (India)"
        if mode == "live_ogd":
            sub = "Rows above reflect the latest published wholesale quotes linked through data.gov.in (source fields may vary by dataset version)."
        else:
            sub = "Rows above are indicative reference bands (not live). Always verify against your mandi display board and e-NAM/Agmarknet."
        bullets = [sub, _volatility_bullet(rows, lang)]
    if top and not lang.startswith("hi"):
        bullets.insert(0, f"Heavy-traded context (sample): {', '.join(top[:3])}.")
    if top and lang.startswith("hi"):
        bullets.insert(0, f"नमूना संदर्भ: {', '.join(top[:3])}।")
    return {
        "headline": headline,
        "bullets": [b for b in bullets if b],
        "links": [
            {
                "label": "e-NAM (GOI)",
                "url": "https://www.enam.gov.in",
            },
            {
                "label": "Agmarknet",
                "url": "https://agmarknet.gov.in",
            },
            {
                "label": "PIB (scheme notices)",
                "url": "https://www.pib.gov.in",
            },
        ],
    }


@router.get("/search")
async def market_search(
    q: str = Query(..., min_length=1, max_length=200, description="Place name in India (Nominatim)"),
) -> dict[str, Any]:
    """Forward geocode to lat/lon; only returns points inside India bounds."""
    q = q.strip()
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    try:
        async with httpx.AsyncClient(timeout=14.0, verify=_httpx_verify()) as client:
            r = await client.get(
                f"{_NOMINATIM}/search",
                params={
                    "q": q,
                    "format": "json",
                    "countrycodes": "in",
                    "limit": 10,
                    "addressdetails": 1,
                    "accept-language": "en",
                },
                headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
            )
    except httpx.RequestError as e:
        log.warning("Nominatim search failed: %s", e)
        raise HTTPException(status_code=502, detail="Location search failed. Try again.") from e
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Location search failed.")
    try:
        raw = r.json()
    except Exception:  # noqa: BLE001
        raw = []
    if not isinstance(raw, list):
        raw = []
    locations: list[dict[str, Any]] = []
    for item in raw:
        try:
            la = float(item.get("lat", 0))
            lo = float(item.get("lon", 0))
        except (TypeError, ValueError):
            continue
        if not _in_india_bounds(la, lo):
            continue
        ad = item.get("address") or {}
        name = (ad.get("city") or ad.get("town") or ad.get("village") or ad.get("county") or item.get("name") or "")
        if isinstance(name, str):
            name = name.strip()
        locations.append(
            {
                "lat": la,
                "lon": lo,
                "name": name,
                "state": (ad.get("state") or ad.get("region") or "") if isinstance(ad, dict) else "",
                "country": "IN",
                "display_name": (item.get("display_name") or f"{name}, India").strip(),
            }
        )
    return {"locations": locations[:8]}


@router.get("/snapshot")
async def market_snapshot(
    lat: float = Query(..., ge=-90, le=90, description="Latitude (WGS84), India only"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude (WGS84)"),
    lang: str = Query("en", min_length=2, max_length=8, description="en or hi for analysis strings"),
) -> dict[str, Any]:
    raw = await _nominatim_reverse_in(lat, lon)
    region = _parse_in_region(raw)
    district = region["district"]

    dgk = _data_gov_key()
    dgr = _data_gov_resource()

    rows_ogd, ogd_updated, ogd_err = await _fetch_data_gov_rows(region["state"], district)
    as_of = datetime.now(_IST)
    as_of_iso = as_of.isoformat()

    ogd_code: str = "ok"
    fix_hint: Optional[str] = None
    if not rows_ogd and dgk and dgr:
        if ogd_err and _is_ogd_rate_limited(str(ogd_err)):
            ogd_code = "rate_limited"
            fix_hint = (
                "data.gov.in is rate-limiting this API key. Wait some minutes, lower `DATA_GOV_IN_QUERY_LIMIT` in `.env`, "
                "or request a dedicated key; then retry."
            )
        elif ogd_err and _is_invalid_resource_err(str(ogd_err)):
            ogd_code = "invalid_resource_id"
            fix_hint = (
                "The server calls `https://api.data.gov.in/resource/<UUID>?format=json` (the UUID in **Try it out** on the dataset, "
                "not a stale id from old blog posts). If the portal 404s that dataset, search data.gov.in for *Variety-wise Daily "
                "Market Prices* and set `DATA_GOV_IN_MANDI_RESOURCE` to the new resource id, keep `DATA_GOV_IN_API_KEY` from **My account**, "
                "restart the API."
            )
        elif ogd_err:
            ogd_code = "fetch_failed"
            fix_hint = "Check DATA_GOV_IN_API_KEY, network, and that filters match dataset column names (State / District)."
        else:
            ogd_code = "no_rows"
            fix_hint = "No rows for this state/district/arrival date in the current extract — try a nearby district or another date in the OGD console."
    elif not rows_ogd and (not dgk or not dgr):
        ogd_code = "ogd_not_configured"
        fix_hint = "Optional: set DATA_GOV_IN_API_KEY and DATA_GOV_IN_MANDI_RESOURCE in .env for live government data."

    if rows_ogd:
        mode = "live_ogd"
        source_note = (
            "data.gov.in — variety-wise / mandi price rows for India. "
            f"Resource `{dgr}`. "
            "Figures are as published; verify on Agmarknet / e-NAM before trading."
        )
        rows = rows_ogd
        updated_label = ogd_updated or as_of.date().isoformat()
    else:
        mode = "indicative"
        rows = _get_indicative_rows(region["state"])
        source_note = "Indicative Rs./Quintal bands (reference only, not a live OGD row set). See ogd_diagnostics in the response for the live API status."
        if ogd_err and dgk and ogd_code not in ("invalid_resource_id",):
            source_note = f"Live OGD: {ogd_err}. " + source_note
        elif ogd_code == "invalid_resource_id" and fix_hint:
            source_note = f"Live OGD: resource id rejected by data.gov.in index. {fix_hint} " + source_note
        updated_label = as_of.date().isoformat()

    analysis = _build_analysis(region["state"], district, mode, rows, lang)
    return {
        "region": {
            "country": "IN",
            "state": region["state"],
            "district": district,
            "display_name": region["display_name"],
            "lat": round(lat, 5),
            "lon": round(lon, 5),
        },
        "data_mode": mode,
        "as_of_ist": as_of_iso,
        "data_updated": updated_label,
        "commodities": rows,
        "source_note": source_note,
        "analysis": analysis,
        "ogd_configured": bool(dgk and dgr),
        "ogd_diagnostics": {
            "code": ogd_code if mode == "indicative" else "ok",
            "detail": (ogd_err or None) if mode == "indicative" else None,
            "fix_hint": fix_hint if mode == "indicative" else None,
        },
    }


@router.get("/india-bounds")
async def india_bounds() -> dict[str, float]:
    """Client-side hint: validate GPS before calling snapshot."""
    return {"lat_min": 6.2, "lat_max": 37.4, "lon_min": 67.0, "lon_max": 98.5}
