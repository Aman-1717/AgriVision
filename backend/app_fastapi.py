# backend/app_fastapi.py
import os
import shutil
from pathlib import Path

# Load repo-root .env for every entrypoint (uvicorn, tests, gunicorn)
try:
    from dotenv import load_dotenv

    _env = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(_env)
except ImportError:
    pass
from fastapi import FastAPI, UploadFile, File, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .predict import predict, get_fertilizer_recommendation
from .crop_recommendation import CropInput, recommend as recommend_crops
from .yield_estimator import (
    CROPS as YIELD_CROPS,
    YieldInput,
    estimate_with_narrative as estimate_yield_with_narrative,
)
from .crop_calendar import (
    CalendarRequest,
    available_crops as calendar_crops,
    build_timeline as build_crop_timeline,
    list_crops as list_calendar_crops,
)
from .irrigation_advisor import IrrigationInput, advise as advise_irrigation
from .database import init_db, get_db
from .community_api import router as community_router
from .weather_api import router as weather_router
from .market_api import router as market_router
from .advisory_chat_api import router as advisory_chat_router
from .fields_api import router as fields_router
from .history_api import router as history_router, maybe_log_activity

app = FastAPI(title="AgriVision")

# Comma-separated URLs, e.g. https://app.vercel.app,https://www.example.com
# If unset, local Vite dev origins only.
_cors_env = (os.getenv("CORS_ALLOW_ORIGINS") or "").strip()
if _cors_env:
    _cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    _cors_origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# backend/ directory (this file lives here)
BACKEND_DIR = Path(__file__).resolve().parent
# repository root (parent of backend/)
REPO_ROOT = BACKEND_DIR.parent
_REACT_DIST = REPO_ROOT / "frontend" / "dist"


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/", include_in_schema=False)
async def root():
    if _REACT_DIST.is_dir() and (_REACT_DIST / "index.html").is_file():
        return RedirectResponse(url="/react/", status_code=302)
    return JSONResponse({"service": "AgriVision", "docs": "/docs"})


app.include_router(community_router)
app.include_router(weather_router)
app.include_router(market_router)
app.include_router(advisory_chat_router)
app.include_router(fields_router)
app.include_router(history_router)


def _disease_summary(result: dict) -> str:
    label = (result or {}).get("predicted_class") or (result or {}).get("class") or ""
    conf = (result or {}).get("confidence")
    if isinstance(conf, (int, float)):
        return f"{label} ({conf*100:.0f}%)" if conf <= 1 else f"{label} ({conf:.0f}%)"
    return str(label or "Disease scan")


@app.post("/api/predict")
async def api_predict(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    tmp_path = BACKEND_DIR / "temp_upload.jpg"
    with open(tmp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        result = predict(str(tmp_path))
    except Exception as e:
        return JSONResponse({"error": "prediction_failed", "message": str(e)}, status_code=500)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    await maybe_log_activity(
        request, db,
        kind="disease",
        summary=_disease_summary(result if isinstance(result, dict) else {}),
        input_data={"filename": file.filename},
        output_data=result,
    )
    return JSONResponse({"result": result})


class FertilizerRequest(BaseModel):
    temperature: float
    humidity: float
    moisture: float
    soilType: str
    cropType: str
    nitrogen: float
    phosphorous: float
    potassium: float


@app.post("/api/fertilizer-recommendation")
async def api_fertilizer_recommendation(
    payload: FertilizerRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        recommendation = get_fertilizer_recommendation(
            temperature=payload.temperature,
            humidity=payload.humidity,
            moisture=payload.moisture,
            soil_type=payload.soilType,
            crop_type=payload.cropType,
            nitrogen=payload.nitrogen,
            phosphorous=payload.phosphorous,
            potassium=payload.potassium,
        )
        if recommendation:
            await maybe_log_activity(
                request, db,
                kind="fertilizer",
                summary=f"{payload.cropType} on {payload.soilType}",
                input_data=payload.model_dump(),
                output_data={"recommendation": recommendation},
            )
            return JSONResponse({"recommendation": recommendation})
        return JSONResponse(
            {"error": "recommendation_failed", "message": "Failed to get fertilizer recommendation"},
            status_code=500,
        )
    except Exception as e:
        return JSONResponse(
            {"error": "recommendation_failed", "message": str(e)},
            status_code=500,
        )


class CropRecommendationRequest(BaseModel):
    soilType: str
    nitrogen: float
    phosphorous: float
    potassium: float
    ph: float
    temperature: float
    humidity: float
    rainfall: float
    season: str
    language: str | None = "en"


@app.post("/api/crop-recommendation")
async def api_crop_recommendation(
    payload: CropRecommendationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        lang = "hi" if (payload.language or "").lower().startswith("hi") else "en"
        result = recommend_crops(
            CropInput(
                soil_type=payload.soilType,
                nitrogen=payload.nitrogen,
                phosphorous=payload.phosphorous,
                potassium=payload.potassium,
                ph=payload.ph,
                temperature=payload.temperature,
                humidity=payload.humidity,
                rainfall=payload.rainfall,
                season=payload.season,
            ),
            language=lang,
        )
        top_names = []
        if isinstance(result, dict):
            for c in (result.get("recommendations") or [])[:3]:
                if isinstance(c, dict):
                    top_names.append(c.get("name") or c.get("crop") or "")
        await maybe_log_activity(
            request, db,
            kind="crop_rec",
            summary=", ".join([n for n in top_names if n]) or f"{payload.soilType} / {payload.season}",
            input_data=payload.model_dump(),
            output_data=result,
            language=lang,
        )
        return JSONResponse({"recommendation": result})
    except Exception as e:
        return JSONResponse(
            {"error": "recommendation_failed", "message": str(e)},
            status_code=500,
        )


class YieldEstimateRequest(BaseModel):
    crop: str
    area: float
    areaUnit: str = "ha"  # "ha" | "acre"
    soilType: str
    nitrogen: float
    phosphorous: float
    potassium: float
    temperature: float
    humidity: float
    rainfall: float
    irrigated: bool = True
    language: str | None = "en"


@app.get("/api/yield-crops")
async def api_yield_crops():
    return JSONResponse({
        "crops": [
            {"key": c[0], "name": c[1], "name_hi": c[2]}
            for c in YIELD_CROPS
        ]
    })


@app.post("/api/yield-estimate")
async def api_yield_estimate(
    payload: YieldEstimateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        lang = "hi" if (payload.language or "").lower().startswith("hi") else "en"
        result = estimate_yield_with_narrative(
            YieldInput(
                crop=payload.crop,
                area=payload.area,
                area_unit=payload.areaUnit,
                soil_type=payload.soilType,
                nitrogen=payload.nitrogen,
                phosphorous=payload.phosphorous,
                potassium=payload.potassium,
                temperature=payload.temperature,
                humidity=payload.humidity,
                rainfall=payload.rainfall,
                irrigated=payload.irrigated,
            ),
            language=lang,
        )
        summary = f"{payload.crop} {payload.area}{payload.areaUnit}"
        if isinstance(result, dict):
            qph = result.get("yield_qtl_ha") or result.get("yieldQtlHa")
            if qph:
                summary = f"{payload.crop}: {qph} qtl/ha"
        await maybe_log_activity(
            request, db,
            kind="yield",
            summary=summary,
            input_data=payload.model_dump(),
            output_data=result,
            language=lang,
        )
        return JSONResponse({"estimate": result})
    except ValueError as e:
        return JSONResponse(
            {"error": "invalid_input", "message": str(e)},
            status_code=400,
        )
    except Exception as e:
        return JSONResponse(
            {"error": "estimate_failed", "message": str(e)},
            status_code=500,
        )


@app.get("/api/crop-calendar/crops")
async def api_calendar_crops(language: str = "en"):
    return JSONResponse({"crops": list_calendar_crops(language)})


@app.post("/api/irrigation-advice")
async def api_irrigation_advice(
    payload: IrrigationInput,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        advice = advise_irrigation(payload)
        lang = "hi" if (payload.language or "").lower().startswith("hi") else "en"
        stage_label = (advice or {}).get("stageLabel") or (advice or {}).get("stage") or ""
        gross_mm = (advice or {}).get("grossMmToday")
        interval = (advice or {}).get("intervalDays")
        bits = [payload.crop]
        if stage_label: bits.append(stage_label)
        if gross_mm is not None: bits.append(f"{gross_mm} mm")
        if interval is not None: bits.append(f"next {interval}d")
        await maybe_log_activity(
            request, db,
            kind="irrigation",
            summary=" · ".join([str(b) for b in bits if b]),
            input_data=payload.model_dump(),
            output_data=advice,
            language=lang,
        )
        return JSONResponse({"advice": advice})
    except ValueError as e:
        return JSONResponse({"error": "invalid_input", "message": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse({"error": "advice_failed", "message": str(e)}, status_code=500)


@app.post("/api/crop-calendar")
async def api_crop_calendar(
    payload: CalendarRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        from datetime import date as _date, datetime as _dt
        sowing = _date.today()
        if payload.sowingDate:
            try:
                sowing = _dt.fromisoformat(payload.sowingDate).date()
            except ValueError:
                pass
        lang = "hi" if (payload.language or "").lower().startswith("hi") else "en"
        timeline = build_crop_timeline(payload.crop, sowing, language=lang)
        cur = (timeline or {}).get("currentStageKey") or ""
        d_in = (timeline or {}).get("daysSinceSowing")
        d_to = (timeline or {}).get("daysToHarvest")
        bits = [payload.crop]
        if cur: bits.append(cur)
        if d_in is not None: bits.append(f"{d_in}d in")
        if d_to is not None: bits.append(f"{d_to}d to harvest")
        await maybe_log_activity(
            request, db,
            kind="calendar",
            summary=" · ".join([str(b) for b in bits if b]),
            input_data=payload.model_dump(),
            output_data=timeline,
            language=lang,
        )
        return JSONResponse({"timeline": timeline})
    except ValueError as e:
        return JSONResponse(
            {"error": "invalid_input", "message": str(e), "available": calendar_crops()},
            status_code=400,
        )
    except Exception as e:
        return JSONResponse({"error": "calendar_failed", "message": str(e)}, status_code=500)


if _REACT_DIST.is_dir() and (_REACT_DIST / "index.html").is_file():
    app.mount(
        "/react",
        StaticFiles(directory=str(_REACT_DIST), html=True),
        name="react_spa",
    )
