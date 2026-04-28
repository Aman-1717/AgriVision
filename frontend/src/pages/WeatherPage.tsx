import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { parseJson } from '../lib/api'
import { persistWeatherCoords } from '../lib/weatherLocationStorage'

type LocationHit = {
  name: string
  country: string
  state?: string
  lat: number
  lon: number
  display_name: string
}

function weatherConditionImageSrc(icon: string, iconUrl?: string | null) {
  if (iconUrl) {
    const u = iconUrl.startsWith('//') ? `https:${iconUrl}` : iconUrl
    if (u.startsWith('http')) return u
  }
  return `https://openweathermap.org/img/wn/${icon}@2x.png`
}

type CurrentWeather = {
  location: { name: string; country: string }
  current: {
    temp: number
    feels_like: number
    humidity: number
    pressure: number
    wind_speed: number
    description: string
    icon: string
    icon_url?: string | null
  }
  alerts: { severity: string; message: string; icon: string }[]
  insights: {
    planting_conditions: string
    harvest_conditions: string
    irrigation_needed: boolean
    recommendations: string[]
  }
}

type ForecastPayload = {
  forecast: {
    date: string
    temp_min: number
    temp_max: number
    description: string
    icon: string
    icon_url?: string | null
    humidity_avg: number
    rain: number
    gdd: number
  }[]
  cumulative_gdd: number
}

const GDD_BASE_KEY = 'agrivision:gddBaseC'

function readGddBaseC(): number {
  try {
    const v = sessionStorage.getItem(GDD_BASE_KEY)
    if (v == null) return 10
    const n = parseFloat(v)
    if (!Number.isFinite(n)) return 10
    return Math.min(40, Math.max(0, n))
  } catch {
    return 10
  }
}

function gddForDay(tempMin: number, tempMax: number, baseC: number) {
  return Math.max(0, (tempMin + tempMax) / 2 - baseC)
}

export function WeatherPage() {
  const [query, setQuery] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [hits, setHits] = useState<LocationHit[] | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [gddBaseC, setGddBaseC] = useState(() => readGddBaseC())

  const enabled = lat != null && lon != null

  const loadMyLocation = useCallback((opts?: { quiet?: boolean }) => {
    if (!navigator.geolocation) {
      if (!opts?.quiet) toast.error('Geolocation not supported')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLon(pos.coords.longitude)
        setLabel('Current location')
        setHits(null)
        setGeoLoading(false)
      },
      () => {
        if (!opts?.quiet) toast.error('Could not read location')
        setGeoLoading(false)
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    )
  }, [])

  useEffect(() => {
    loadMyLocation({ quiet: true })
  }, [loadMyLocation])

  useEffect(() => {
    if (lat != null && lon != null) persistWeatherCoords(lat, lon)
  }, [lat, lon])

  const currentQ = useQuery({
    queryKey: ['weather', 'current', lat, lon],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Failed to load weather')
      }
      return parseJson<CurrentWeather>(res)
    },
  })

  const forecastQ = useQuery({
    queryKey: ['weather', 'forecast', lat, lon],
    enabled,
    queryFn: async () => {
      const res = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}&days=3`)
      if (!res.ok) throw new Error('Forecast unavailable')
      return parseJson<ForecastPayload>(res)
    },
  })

  const displayForecast = useMemo(() => {
    const days = forecastQ.data?.forecast
    if (!days?.length) return null
    const perDay = days.map((d) => ({
      ...d,
      gdd: Math.round(gddForDay(d.temp_min, d.temp_max, gddBaseC) * 10) / 10,
    }))
    const cumulative = Math.round(perDay.reduce((s, d) => s + d.gdd, 0) * 10) / 10
    return { perDay, cumulative }
  }, [forecastQ.data?.forecast, gddBaseC])

  const setGddBaseAndPersist = (raw: string) => {
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return
    const clamped = Math.min(40, Math.max(0, n))
    setGddBaseC(clamped)
    try {
      sessionStorage.setItem(GDD_BASE_KEY, String(clamped))
    } catch {
      /* ignore */
    }
  }

  const search = async () => {
    const q = query.trim()
    if (!q) {
      toast.error('Enter a location')
      return
    }
    try {
      const res = await fetch(`/api/weather/search?q=${encodeURIComponent(q)}`)
      const data = await parseJson<{ locations?: LocationHit[] }>(res)
      if (!data.locations?.length) {
        toast.message('No locations found')
        setHits([])
        return
      }
      setHits(data.locations)
    } catch {
      toast.error('Search failed')
    }
  }

  const selectHit = (h: LocationHit) => {
    setLat(h.lat)
    setLon(h.lon)
    setLabel(h.display_name)
    setQuery(h.display_name)
    setHits(null)
  }

  useEffect(() => {
    if (currentQ.isError) toast.error((currentQ.error as Error).message)
  }, [currentQ.isError, currentQ.error])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Weather lens</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Location-aware conditions, simple agronomic cues, and a 3-day outlook. Your area loads automatically when
          location access is allowed.
        </p>
      </header>

      <div className="av-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search city or region"
          className="ds-input min-w-0 flex-1 rounded-xl"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={search}
            className="ds-btn-primary rounded-xl px-4 py-2 text-sm"
          >
            Search
          </button>
          <button
            type="button"
            disabled={geoLoading}
            onClick={() => loadMyLocation()}
            className="ds-btn-secondary rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          >
            {geoLoading ? 'Locating…' : 'My location'}
          </button>
        </div>
      </div>

      {hits && hits.length > 0 && (
        <ul className="divide-y divide-ds-border overflow-hidden rounded-xl border border-ds-border bg-void-2/50 backdrop-blur-sm">
          {hits.map((h) => (
            <li key={`${h.lat}-${h.lon}-${h.display_name}`}>
              <button
                type="button"
                onClick={() => selectHit(h)}
                className="flex w-full px-4 py-3 text-left text-sm text-ink hover:bg-surface-ds"
              >
                {h.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!enabled && (
        <p className="text-sm text-ink-faint">
          {geoLoading
            ? 'Detecting your location…'
            : 'Allow location access to load weather here, or search for a place.'}
        </p>
      )}

      {enabled && (currentQ.isLoading || forecastQ.isLoading) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-void-2/80" />
          ))}
        </div>
      )}

      {enabled && currentQ.data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="av-card p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">{label || currentQ.data.location.name}</h2>
                <p className="text-sm text-ink-faint">
                  {currentQ.data.location.name}, {currentQ.data.location.country}
                </p>
              </div>
              <img
                src={weatherConditionImageSrc(
                  currentQ.data.current.icon,
                  currentQ.data.current.icon_url,
                )}
                alt=""
                className="h-16 w-16"
              />
            </div>
            <p className="mt-6 text-5xl font-semibold tracking-tight text-ink">
              {Math.round(currentQ.data.current.temp)}°C
            </p>
            <p className="text-sm capitalize text-ink-muted">{currentQ.data.current.description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-ink-faint">Feels like</dt>
                <dd className="font-medium text-ink">{Math.round(currentQ.data.current.feels_like)}°C</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Humidity</dt>
                <dd className="font-medium text-ink">{currentQ.data.current.humidity}%</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Wind</dt>
                <dd className="font-medium text-ink">{currentQ.data.current.wind_speed} km/h</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Pressure</dt>
                <dd className="font-medium text-ink">{currentQ.data.current.pressure} hPa</dd>
              </div>
            </dl>
          </div>
          <div className="av-card space-y-4 p-6">
            <h3 className="text-sm font-semibold text-ink">Field signals</h3>
            <ul className="space-y-2 text-sm text-ink/90">
              <li>Planting: {currentQ.data.insights.planting_conditions}</li>
              <li>Harvest: {currentQ.data.insights.harvest_conditions}</li>
              <li>Irrigation: {currentQ.data.insights.irrigation_needed ? 'Consider watering' : 'Likely sufficient'}</li>
            </ul>
            {currentQ.data.insights.recommendations.length > 0 && (
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-ink-muted">
                {currentQ.data.insights.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {enabled && currentQ.data && currentQ.data.alerts.length > 0 && (
        <div className="space-y-2">
          {currentQ.data.alerts.map((a, i) => (
            <div
              key={i}
              className="flex w-full gap-3 rounded-xl border border-amber-500/25 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
            >
              <span aria-hidden>{a.icon}</span>
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {enabled && forecastQ.data && displayForecast && (
        <div className="av-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <h3 className="text-lg font-semibold text-ink">3-day outlook</h3>
            <div className="flex flex-col gap-2 sm:items-end">
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <span>GDD base (°C)</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.5}
                  value={gddBaseC}
                  onChange={(e) => setGddBaseAndPersist(e.target.value)}
                  className="ds-input w-24 rounded-lg px-2 py-1 text-sm tabular-nums"
                />
              </label>
              <p className="text-sm text-ink-faint">
                Cumulative GDD:{' '}
                <span className="font-medium text-ink">{displayForecast.cumulative}</span>
                <span className="text-ink-faint"> (base {gddBaseC}°C)</span>
              </p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-ds-border">
            {displayForecast.perDay.map((day) => {
              const d = new Date(day.date)
              return (
                <div key={day.date} className="flex flex-wrap items-center gap-4 py-3">
                  <div className="w-24 text-sm text-ink-muted">
                    {d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })}
                  </div>
                  <img
                    src={weatherConditionImageSrc(day.icon, day.icon_url)}
                    alt=""
                    className="h-10 w-10"
                  />
                  <div className="text-sm text-ink/90">
                    {Math.round(day.temp_max)}° / {Math.round(day.temp_min)}° · {day.description}
                  </div>
                  <div className="ml-auto text-xs text-ink-faint">
                    Rain {day.rain.toFixed(1)}mm · GDD {day.gdd}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Daily GDD uses the average of min and max temperature minus your base (common default for cereals is 10°C).
            Adjust the base to match your crop model; the value is stored in this browser session only and updates the
            numbers above immediately.
          </p>
        </div>
      )}
    </div>
  )
}
