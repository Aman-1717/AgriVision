# backend/weather_api.py
from fastapi import APIRouter, HTTPException, Query
from typing import Any, Optional
from datetime import datetime
from zoneinfo import ZoneInfo
import os
import ssl
import httpx

router = APIRouter(prefix="/api/weather", tags=["weather"])


def _httpx_verify() -> bool | str | ssl.SSLContext:
    """
    TLS verification for outbound weather HTTP calls.

    Order: optional SSL_CERT_FILE / REQUESTS_CA_BUNDLE, then truststore (OS keychain /
    store — fixes many macOS python.org installs), then certifi.
    Set HTTPX_VERIFY_SSL=false only for local debugging (insecure).
    """
    flag = (os.getenv("HTTPX_VERIFY_SSL") or "true").strip().lower()
    if flag in ("0", "false", "no"):
        return False
    for env in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE"):
        path = os.getenv(env)
        if path and os.path.isfile(path):
            return path
    try:
        import truststore

        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except ImportError:
        pass
    try:
        import certifi

        return certifi.where()
    except ImportError:
        return True

WEATHERAPI_API_KEY = (os.getenv("WEATHERAPI_API_KEY") or "").strip()
OPENWEATHER_API_KEY = (os.getenv("OPENWEATHER_API_KEY") or "").strip()
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"
WEATHERAPI_BASE_URL = "https://api.weatherapi.com/v1"

# Base temperature for GDD calculation (typically 10°C or 50°F for most crops)
BASE_TEMP_C = 10.0
BASE_TEMP_F = 50.0


def _provider() -> str:
    if WEATHERAPI_API_KEY:
        return "weatherapi"
    if OPENWEATHER_API_KEY:
        return "openweather"
    return ""


def _weatherapi_icon_url(icon: str) -> Optional[str]:
    if not icon:
        return None
    if icon.startswith("//"):
        return f"https:{icon}"
    if icon.startswith("http"):
        return icon
    return None


async def _weatherapi_request(path: str, params: dict[str, Any]) -> dict:
    q = params.get("q")
    if not q:
        raise HTTPException(status_code=400, detail="Missing location")
    try:
        async with httpx.AsyncClient(timeout=12.0, verify=_httpx_verify()) as client:
            response = await client.get(
                f"{WEATHERAPI_BASE_URL}/{path}",
                params={"key": WEATHERAPI_API_KEY, **params},
            )
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid WeatherAPI.com API key")
            if response.status_code == 403:
                raise HTTPException(status_code=403, detail="WeatherAPI.com quota exceeded or plan limit")
            if response.status_code != 200:
                try:
                    err = response.json()
                    msg = err.get("error", {}).get("message", response.text)
                except Exception:
                    msg = response.text
                raise HTTPException(status_code=response.status_code, detail=f"Weather API error: {msg}")
            return response.json()
    except httpx.ConnectError as e:
        if "CERTIFICATE_VERIFY_FAILED" in str(e) or "certificate verify failed" in str(e).lower():
            raise HTTPException(
                status_code=502,
                detail=(
                    "HTTPS certificate verify failed. From project root run: pip install -r requirements.txt "
                    "(uses truststore + certifi). On macOS you can also run “Install Certificates.command” "
                    "next to the python.org Python app. Last resort for local dev only: HTTPX_VERIFY_SSL=false in .env."
                ),
            ) from e
        raise HTTPException(status_code=502, detail=f"Weather API connection error: {e}") from e
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Weather API request timeout")


def _wa_to_owm_current_from_forecast_bundle(data: dict) -> dict:
    """Map WeatherAPI forecast.json (includes current) to OpenWeather-shaped dict."""
    loc = data.get("location") or {}
    cur = data.get("current") or {}
    cond = cur.get("condition") or {}
    icon_url = _weatherapi_icon_url(cond.get("icon", ""))
    precip = float(cur.get("precip_mm") or 0)

    tz_id = loc.get("tz_id") or "UTC"
    try:
        tz = ZoneInfo(tz_id)
    except Exception:
        tz = ZoneInfo("UTC")

    sunrise_epoch: Optional[int] = None
    sunset_epoch: Optional[int] = None
    try:
        days = (data.get("forecast") or {}).get("forecastday") or []
        if days:
            fd = days[0]
            astro = fd.get("astro") or {}
            d = fd.get("date", "")
            if d and astro.get("sunrise"):
                sr = datetime.strptime(f"{d} {astro['sunrise']}", "%Y-%m-%d %I:%M %p").replace(
                    tzinfo=tz
                )
                sunrise_epoch = int(sr.timestamp())
            if d and astro.get("sunset"):
                ss = datetime.strptime(f"{d} {astro['sunset']}", "%Y-%m-%d %I:%M %p").replace(
                    tzinfo=tz
                )
                sunset_epoch = int(ss.timestamp())
    except (ValueError, KeyError, TypeError):
        pass

    if sunrise_epoch is None:
        sunrise_epoch = int(datetime.now(tz).timestamp())
    if sunset_epoch is None:
        sunset_epoch = sunrise_epoch

    rain: dict[str, float] = {}
    if precip > 0:
        rain["1h"] = precip

    return {
        "_provider": "weatherapi",
        "_icon_url": icon_url,
        "name": loc.get("name", "Unknown"),
        "sys": {
            "country": loc.get("country", ""),
            "sunrise": sunrise_epoch,
            "sunset": sunset_epoch,
        },
        "main": {
            "temp": cur.get("temp_c", 0),
            "feels_like": cur.get("feelslike_c", cur.get("temp_c", 0)),
            "humidity": cur.get("humidity", 0),
            "pressure": cur.get("pressure_mb", 1013),
        },
        "wind": {
            "speed": (cur.get("wind_kph") or 0) / 3.6,
            "deg": cur.get("wind_degree", 0),
        },
        "clouds": {"all": cur.get("cloud", 0)},
        "visibility": int((cur.get("vis_km") or 10) * 1000),
        "rain": rain,
        "weather": [
            {
                "description": (cond.get("text") or "").lower(),
                "icon": cond.get("code", ""),
            }
        ],
    }


def _wa_to_owm_forecast(data: dict, forecast_days: int) -> dict:
    """Build OpenWeather list/city shape from WeatherAPI forecast.json."""
    loc = data.get("location") or {}
    out_list: list[dict] = []
    for fd in (data.get("forecast") or {}).get("forecastday") or []:
        if len(out_list) >= forecast_days * 24:
            break
        for h in fd.get("hour") or []:
            cond = h.get("condition") or {}
            precip = float(h.get("precip_mm") or 0)
            rain = {"3h": precip} if precip > 0 else {}
            out_list.append(
                {
                    "dt": h.get("time_epoch", 0),
                    "main": {
                        "temp": h.get("temp_c", 0),
                        "temp_min": h.get("temp_c", 0),
                        "temp_max": h.get("temp_c", 0),
                        "humidity": h.get("humidity", 0),
                    },
                    "weather": [
                        {
                            "description": (cond.get("text") or "").lower(),
                            "icon": cond.get("code", ""),
                            "_icon_url": _weatherapi_icon_url(cond.get("icon", "")),
                        }
                    ],
                    "wind": {"speed": (h.get("wind_kph") or 0) / 3.6},
                    "rain": rain,
                }
            )

    return {
        "_provider": "weatherapi",
        "list": out_list,
        "city": {
            "name": loc.get("name", "Unknown"),
            "country": loc.get("country", ""),
        },
    }


async def get_weather_data(
    lat: float,
    lon: float,
    endpoint: str = "weather",
    *,
    forecast_days: int = 5,
) -> dict:
    """Fetch weather; prefers WeatherAPI when WEATHERAPI_API_KEY is set."""
    prov = _provider()
    if not prov:
        raise HTTPException(
            status_code=503,
            detail="No weather provider configured. Add WEATHERAPI_API_KEY or OPENWEATHER_API_KEY to .env",
        )

    if prov == "weatherapi":
        q = f"{lat},{lon}"
        if endpoint == "weather":
            raw = await _weatherapi_request("forecast.json", {"q": q, "days": 1})
            return _wa_to_owm_current_from_forecast_bundle(raw)
        if endpoint == "forecast":
            days = max(1, min(forecast_days, 14))
            raw = await _weatherapi_request("forecast.json", {"q": q, "days": days})
            return _wa_to_owm_forecast(raw, days)

    # OpenWeatherMap
    if not OPENWEATHER_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenWeatherMap API key not configured. Please add OPENWEATHER_API_KEY to your .env file",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=_httpx_verify()) as client:
            url = f"{OPENWEATHER_BASE_URL}/{endpoint}"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": OPENWEATHER_API_KEY,
                "units": "metric",
            }

            response = await client.get(url, params=params)

            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid OpenWeatherMap API key")
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail="Location not found")
            elif response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Weather API error: {response.text}",
                )

            data = response.json()
            data["_provider"] = "openweather"
            return data
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Weather API request timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching weather data: {str(e)}")


def calculate_gdd(temp_min: float, temp_max: float, base_temp: float = BASE_TEMP_C) -> float:
    """
    Calculate Growing Degree Days (GDD)
    GDD = (T_max + T_min) / 2 - T_base
    If result is negative, GDD = 0
    """
    avg_temp = (temp_max + temp_min) / 2
    gdd = avg_temp - base_temp
    return max(0, gdd)


def get_weather_alerts(weather_data: dict, forecast_data: dict = None) -> list:
    """Generate agricultural weather alerts"""
    alerts = []

    if "main" in weather_data:
        temp = weather_data["main"].get("temp", 0)
        feels_like = weather_data["main"].get("feels_like", temp)
        humidity = weather_data["main"].get("humidity", 0)
        rain = weather_data.get("rain", {}).get("1h", 0) or weather_data.get("rain", {}).get("3h", 0)

        if temp < 0 or feels_like < 0:
            alerts.append(
                {
                    "type": "frost",
                    "severity": "high",
                    "message": "⚠️ Frost Warning: Freezing temperatures detected. Protect sensitive crops.",
                    "icon": "❄️",
                }
            )
        elif temp < 5:
            alerts.append(
                {
                    "type": "cold",
                    "severity": "medium",
                    "message": "🌡️ Cold Weather: Low temperatures may affect crop growth.",
                    "icon": "🌡️",
                }
            )

        if humidity < 30:
            alerts.append(
                {
                    "type": "drought",
                    "severity": "medium",
                    "message": "🌵 Low Humidity: Consider irrigation to prevent drought stress.",
                    "icon": "🌵",
                }
            )

        if rain > 20:
            alerts.append(
                {
                    "type": "excessive_rain",
                    "severity": "high",
                    "message": "🌧️ Heavy Rainfall: Risk of waterlogging. Ensure proper drainage.",
                    "icon": "🌧️",
                }
            )
        elif rain > 10:
            alerts.append(
                {
                    "type": "rain",
                    "severity": "medium",
                    "message": "🌦️ Moderate Rainfall: Monitor soil moisture levels.",
                    "icon": "🌦️",
                }
            )

    if forecast_data and "list" in forecast_data:
        for forecast in forecast_data["list"][:8]:
            temp_min = forecast["main"].get("temp_min", 0)
            if temp_min < 0:
                alerts.append(
                    {
                        "type": "frost_forecast",
                        "severity": "high",
                        "message": "❄️ Frost Forecast: Freezing temperatures expected in the next 24 hours.",
                        "icon": "❄️",
                    }
                )
                break

    return alerts


def get_agricultural_insights(weather_data: dict, forecast_data: dict = None) -> dict:
    """Generate agricultural insights from weather data"""
    insights = {
        "planting_conditions": "good",
        "irrigation_needed": False,
        "harvest_conditions": "good",
        "recommendations": [],
    }

    if "main" in weather_data:
        temp = weather_data["main"].get("temp", 20)
        humidity = weather_data["main"].get("humidity", 50)
        pressure = weather_data["main"].get("pressure", 1013)
        wind_speed = weather_data.get("wind", {}).get("speed", 0)
        rain = weather_data.get("rain", {}).get("1h", 0) or weather_data.get("rain", {}).get("3h", 0)

        if 15 <= temp <= 30 and humidity >= 40 and rain < 5:
            insights["planting_conditions"] = "excellent"
            insights["recommendations"].append("✅ Ideal conditions for planting")
        elif temp < 10 or temp > 35:
            insights["planting_conditions"] = "poor"
            insights["recommendations"].append("⚠️ Extreme temperatures - delay planting if possible")
        else:
            insights["planting_conditions"] = "moderate"

        if humidity < 40 and rain < 1:
            insights["irrigation_needed"] = True
            insights["recommendations"].append("💧 Low humidity and no rain - irrigation recommended")

        if rain < 2 and wind_speed < 15:
            insights["harvest_conditions"] = "excellent"
            insights["recommendations"].append("🌾 Good conditions for harvesting")
        elif rain > 10:
            insights["harvest_conditions"] = "poor"
            insights["recommendations"].append("🌧️ Heavy rain - avoid harvesting")

        if wind_speed > 20:
            insights["recommendations"].append("💨 Strong winds - protect crops and structures")

    return insights


@router.get("/current")
async def get_current_weather(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
):
    """Get current weather conditions"""
    weather_data = await get_weather_data(lat, lon, "weather")

    alerts = get_weather_alerts(weather_data)
    insights = get_agricultural_insights(weather_data)

    w0 = (weather_data.get("weather") or [{}])[0]
    icon_url = weather_data.get("_icon_url") or w0.get("_icon_url")

    return {
        "location": {
            "name": weather_data.get("name", "Unknown"),
            "country": weather_data.get("sys", {}).get("country", ""),
            "lat": lat,
            "lon": lon,
        },
        "current": {
            "temp": round(weather_data["main"]["temp"], 1),
            "feels_like": round(weather_data["main"]["feels_like"], 1),
            "humidity": weather_data["main"]["humidity"],
            "pressure": weather_data["main"]["pressure"],
            "wind_speed": round(weather_data.get("wind", {}).get("speed", 0) * 3.6, 1),
            "wind_direction": weather_data.get("wind", {}).get("deg", 0),
            "clouds": weather_data.get("clouds", {}).get("all", 0),
            "visibility": weather_data.get("visibility", 0) / 1000 if weather_data.get("visibility") else None,
            "rain": weather_data.get("rain", {}).get("1h", 0) or weather_data.get("rain", {}).get("3h", 0),
            "description": w0.get("description", "").title(),
            "icon": str(w0.get("icon", "")),
            "icon_url": icon_url,
            "sunrise": datetime.fromtimestamp(weather_data["sys"]["sunrise"]).isoformat(),
            "sunset": datetime.fromtimestamp(weather_data["sys"]["sunset"]).isoformat(),
        },
        "alerts": alerts,
        "insights": insights,
    }


@router.get("/forecast")
async def get_weather_forecast(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    days: int = Query(3, ge=1, le=7, description="Number of days (1-7; free WeatherAPI shows up to 3)"),
):
    """Get weather forecast for specified days"""
    forecast_data = await get_weather_data(lat, lon, "forecast", forecast_days=days)

    current_weather = await get_weather_data(lat, lon, "weather")
    alerts = get_weather_alerts(current_weather, forecast_data)

    forecast_list = []
    daily_data = {}

    for item in forecast_data.get("list", []):
        dt = datetime.fromtimestamp(item["dt"])
        date_key = dt.date()

        if date_key not in daily_data:
            daily_data[date_key] = {
                "date": date_key.isoformat(),
                "temp_min": item["main"]["temp_min"],
                "temp_max": item["main"]["temp_max"],
                "humidity": [],
                "rain": 0,
                "wind_speed": [],
                "conditions": [],
            }

        daily_data[date_key]["temp_min"] = min(daily_data[date_key]["temp_min"], item["main"]["temp_min"])
        daily_data[date_key]["temp_max"] = max(daily_data[date_key]["temp_max"], item["main"]["temp_max"])

        daily_data[date_key]["humidity"].append(item["main"]["humidity"])
        daily_data[date_key]["wind_speed"].append(item.get("wind", {}).get("speed", 0) * 3.6)

        rain = item.get("rain", {}).get("3h", 0)
        if rain:
            daily_data[date_key]["rain"] += rain

        w = (item.get("weather") or [{}])[0]
        daily_data[date_key]["conditions"].append(
            {
                "time": dt.isoformat(),
                "description": w.get("description", "").title(),
                "icon": str(w.get("icon", "")),
                "icon_url": w.get("_icon_url"),
                "temp": round(item["main"]["temp"], 1),
            }
        )

    for date_key in sorted(daily_data.keys())[:days]:
        day = daily_data[date_key]
        day["temp_avg"] = round((day["temp_min"] + day["temp_max"]) / 2, 1)
        day["humidity_avg"] = (
            round(sum(day["humidity"]) / len(day["humidity"]), 1) if day["humidity"] else 0
        )
        day["wind_speed_avg"] = (
            round(sum(day["wind_speed"]) / len(day["wind_speed"]), 1) if day["wind_speed"] else 0
        )
        day["gdd"] = round(calculate_gdd(day["temp_min"], day["temp_max"]), 1)

        if day["conditions"]:
            mid = day["conditions"][len(day["conditions"]) // 2]
            day["description"] = mid["description"]
            day["icon"] = mid["icon"]
            day["icon_url"] = mid.get("icon_url")

        del day["humidity"]
        del day["wind_speed"]

        forecast_list.append(day)

    cumulative_gdd = sum(day["gdd"] for day in forecast_list)

    city = forecast_data.get("city") or {}

    return {
        "location": {
            "name": city.get("name", "Unknown"),
            "country": city.get("country", ""),
            "lat": lat,
            "lon": lon,
        },
        "forecast": forecast_list,
        "cumulative_gdd": round(cumulative_gdd, 1),
        "alerts": alerts,
    }


@router.get("/gdd")
async def calculate_gdd_for_period(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    days: int = Query(7, ge=1, le=30, description="Number of days"),
    base_temp: float = Query(BASE_TEMP_C, description="Base temperature in Celsius"),
):
    """Calculate Growing Degree Days for a period"""
    forecast_data = await get_weather_data(lat, lon, "forecast", forecast_days=min(days, 14))

    daily_gdd = []
    cumulative_gdd = 0

    daily_data = {}
    for item in forecast_data.get("list", []):
        dt = datetime.fromtimestamp(item["dt"])
        date_key = dt.date()

        if date_key not in daily_data:
            daily_data[date_key] = {
                "temp_min": item["main"]["temp_min"],
                "temp_max": item["main"]["temp_max"],
            }
        else:
            daily_data[date_key]["temp_min"] = min(
                daily_data[date_key]["temp_min"], item["main"]["temp_min"]
            )
            daily_data[date_key]["temp_max"] = max(
                daily_data[date_key]["temp_max"], item["main"]["temp_max"]
            )

    for date_key in sorted(daily_data.keys())[:days]:
        gdd = calculate_gdd(daily_data[date_key]["temp_min"], daily_data[date_key]["temp_max"], base_temp)
        cumulative_gdd += gdd
        daily_gdd.append(
            {
                "date": date_key.isoformat(),
                "temp_min": round(daily_data[date_key]["temp_min"], 1),
                "temp_max": round(daily_data[date_key]["temp_max"], 1),
                "gdd": round(gdd, 1),
                "cumulative_gdd": round(cumulative_gdd, 1),
            }
        )

    return {
        "base_temp": base_temp,
        "period_days": days,
        "daily_gdd": daily_gdd,
        "total_gdd": round(cumulative_gdd, 1),
    }


@router.get("/search")
async def search_location(
    q: str = Query(..., description="Location name or coordinates"),
):
    """Search for location coordinates"""
    prov = _provider()
    if not prov:
        raise HTTPException(status_code=503, detail="No weather API key configured")

    if prov == "weatherapi":
        try:
            raw = await _weatherapi_request("search.json", {"q": q})
            if not isinstance(raw, list):
                raw = []
            return {
                "locations": [
                    {
                        "name": loc.get("name", ""),
                        "country": loc.get("country", ""),
                        "state": loc.get("region", ""),
                        "lat": loc.get("lat", 0),
                        "lon": loc.get("lon", 0),
                        "display_name": ", ".join(
                            p for p in [loc.get("name"), loc.get("region"), loc.get("country")] if p
                        ),
                    }
                    for loc in raw[:8]
                ]
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error searching location: {str(e)}")

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=_httpx_verify()) as client:
            url = "http://api.openweathermap.org/geo/1.0/direct"
            params = {
                "q": q,
                "limit": 5,
                "appid": OPENWEATHER_API_KEY,
            }

            response = await client.get(url, params=params)

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Error searching location",
                )

            locations = response.json()

            return {
                "locations": [
                    {
                        "name": loc.get("name", ""),
                        "country": loc.get("country", ""),
                        "state": loc.get("state", ""),
                        "lat": loc.get("lat", 0),
                        "lon": loc.get("lon", 0),
                        "display_name": f"{loc.get('name', '')}, {loc.get('state', '')}, {loc.get('country', '')}".strip(
                            ", "
                        ),
                    }
                    for loc in locations
                ]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching location: {str(e)}")
