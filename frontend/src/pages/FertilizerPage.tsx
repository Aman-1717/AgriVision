import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { formatApiErrorBody, parseJson } from '../lib/api'
import { useApiFetch } from '../hooks/useApiFetch'
import { persistWeatherCoords, readStoredWeatherCoords } from '../lib/weatherLocationStorage'

const SOIL_OPTIONS = ['Sandy', 'Clay', 'Loamy', 'Silty', 'Peaty', 'Chalky'] as const
const FERT_FORM_KEY = 'agrivision:fertilizerFormV2'

type PersistedFertilizer = {
  temperature: string
  humidity: string
  moisture: string
  soilType: string
  cropType: string
  nitrogen: string
  phosphorous: string
  potassium: string
}

type WeatherCurrentResponse = {
  current: { temp: number; humidity: number }
}

function loadPersistedForm(): Partial<PersistedFertilizer> | null {
  try {
    const raw = sessionStorage.getItem(FERT_FORM_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedFertilizer
  } catch {
    return null
  }
}

function savePersistedForm(p: PersistedFertilizer) {
  try {
    sessionStorage.setItem(FERT_FORM_KEY, JSON.stringify(p))
  } catch {
    /* private mode */
  }
}

function geolocationPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 300_000,
    })
  })
}

const inputCls = 'ds-input mt-1 w-full rounded-xl'

export function FertilizerPage() {
  const apiFetch = useApiFetch()
  const formRef = useRef<HTMLFormElement>(null)
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [moisture, setMoisture] = useState('')
  const [soilType, setSoilType] = useState('')
  const [cropType, setCropType] = useState('')
  const [nitrogen, setNitrogen] = useState('')
  const [phosphorous, setPhosphorous] = useState('')
  const [potassium, setPotassium] = useState('')
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [weatherFillLoading, setWeatherFillLoading] = useState(false)

  useEffect(() => {
    const p = loadPersistedForm()
    if (!p) return
    if (p.temperature != null) setTemperature(String(p.temperature))
    if (p.humidity != null) setHumidity(String(p.humidity))
    if (p.moisture != null) setMoisture(String(p.moisture))
    if (p.soilType != null) setSoilType(String(p.soilType))
    if (p.cropType != null) setCropType(String(p.cropType))
    if (p.nitrogen != null) setNitrogen(String(p.nitrogen))
    if (p.phosphorous != null) setPhosphorous(String(p.phosphorous))
    if (p.potassium != null) setPotassium(String(p.potassium))
  }, [])

  const persistSnapshot = (): PersistedFertilizer => ({
    temperature,
    humidity,
    moisture,
    soilType,
    cropType,
    nitrogen,
    phosphorous,
    potassium,
  })

  const clearSavedForm = () => {
    try {
      sessionStorage.removeItem(FERT_FORM_KEY)
    } catch {
      /* ignore */
    }
    setTemperature('')
    setHumidity('')
    setMoisture('')
    setSoilType('')
    setCropType('')
    setNitrogen('')
    setPhosphorous('')
    setPotassium('')
    setRecommendation(null)
    setFormError(null)
    toast.message('Saved inputs cleared')
  }

  const fillFromWeather = async () => {
    setWeatherFillLoading(true)
    setFormError(null)
    try {
      let coords = readStoredWeatherCoords()
      if (!coords) {
        const pos = await geolocationPosition()
        coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        persistWeatherCoords(coords.lat, coords.lon)
      }
      const res = await fetch(`/api/weather/current?lat=${coords.lat}&lon=${coords.lon}`)
      const j = await parseJson<WeatherCurrentResponse & Record<string, unknown>>(res)
      if (!res.ok) {
        throw new Error(formatApiErrorBody(j, 'Could not load weather'))
      }
      setTemperature(String(j.current.temp))
      setHumidity(String(j.current.humidity))
      toast.success('Temperature and humidity filled from weather')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not use weather for this location'
      toast.error(msg)
    } finally {
      setWeatherFillLoading(false)
    }
  }

  const validateForm = (): string | null => {
    if (!cropType.trim()) return 'Crop type is required.'
    if (!soilType.trim()) return 'Soil type is required.'

    const t = parseFloat(temperature)
    if (Number.isNaN(t)) return 'Enter a valid temperature.'
    if (t < -80 || t > 70) return 'Temperature should be between -80°C and 70°C.'

    const h = parseFloat(humidity)
    if (Number.isNaN(h)) return 'Enter a valid humidity.'
    if (h < 0 || h > 100) return 'Humidity must be between 0 and 100%.'

    const m = parseFloat(moisture)
    if (Number.isNaN(m)) return 'Enter a valid soil moisture.'
    if (m < 0 || m > 100) return 'Soil moisture must be between 0 and 100%.'

    const n = parseFloat(nitrogen)
    if (Number.isNaN(n) || n < 0) return 'Nitrogen must be zero or a positive number.'
    const p = parseFloat(phosphorous)
    if (Number.isNaN(p) || p < 0) return 'Phosphorous must be zero or a positive number.'
    const k = parseFloat(potassium)
    if (Number.isNaN(k) || k < 0) return 'Potassium must be zero or a positive number.'

    return null
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        moisture: parseFloat(moisture),
        soilType,
        cropType: cropType.trim(),
        nitrogen: parseFloat(nitrogen),
        phosphorous: parseFloat(phosphorous),
        potassium: parseFloat(potassium),
      }
      const res = await apiFetch('/api/fertilizer-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await parseJson<{ recommendation?: string; detail?: unknown; message?: string; error?: string }>(
        res,
      )
      if (!res.ok) throw new Error(formatApiErrorBody(j, 'Recommendation failed'))
      if (!j.recommendation) throw new Error('No recommendation returned from the server')
      return j.recommendation
    },
    onSuccess: (text) => {
      savePersistedForm(persistSnapshot())
      setRecommendation(text)
      setFormError(null)
      toast.success('Recommendation ready')
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setRecommendation(null)
    const err = validateForm()
    if (err) {
      setFormError(err)
      return
    }
    mutation.mutate()
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Fertilizer guide</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Practical fertilizer guidance from your soil readings and crop type.
          </p>
        </div>
        <button
          type="button"
          onClick={clearSavedForm}
          className="ds-btn-secondary shrink-0 rounded-xl px-4 py-2 text-sm"
        >
          Clear saved inputs
        </button>
      </header>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="av-card grid gap-6 p-6 md:grid-cols-2 md:p-8"
        noValidate
      >
        {formError && (
          <div
            role="alert"
            className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100"
          >
            <p>{formError}</p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-red-200 underline decoration-red-400/50 underline-offset-2 hover:no-underline"
              onClick={() => formRef.current?.requestSubmit()}
            >
              Try again
            </button>
          </div>
        )}

        <div className="md:col-span-2 flex flex-col gap-4 rounded-xl border border-ds-border bg-void-2/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">From weather</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label htmlFor="fertilizer-temperature" className="min-w-0 flex-1">
              <span className="text-sm font-medium text-ink/90">Temperature (°C)</span>
              <span id="fertilizer-temperature-hint" className="mt-0.5 block text-xs text-ink-faint">
                Air temperature; typical range about -10 to 45 for field use
              </span>
              <input
                id="fertilizer-temperature"
                aria-describedby="fertilizer-temperature-hint"
                required
                type="number"
                step="0.1"
                min={-80}
                max={70}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className={inputCls}
              />
            </label>
            <label htmlFor="fertilizer-humidity" className="min-w-0 flex-1">
              <span className="text-sm font-medium text-ink/90">Humidity (%)</span>
              <span id="fertilizer-humidity-hint" className="mt-0.5 block text-xs text-ink-faint">
                Relative humidity 0–100%
              </span>
              <input
                id="fertilizer-humidity"
                aria-describedby="fertilizer-humidity-hint"
                required
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                className={inputCls}
              />
            </label>
            <button
              type="button"
              disabled={weatherFillLoading}
              onClick={() => void fillFromWeather()}
              className="ds-btn-secondary shrink-0 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 lg:mb-[2px]"
            >
              {weatherFillLoading ? 'Loading weather…' : 'Use current weather'}
            </button>
          </div>
        </div>

        <label htmlFor="fertilizer-moisture" className="block md:col-span-1">
          <span className="text-sm font-medium text-ink/90">Soil moisture (%)</span>
          <span id="fertilizer-moisture-hint" className="mt-0.5 block text-xs text-ink-faint">
            Volumetric or estimated field moisture, 0–100%
          </span>
          <input
            id="fertilizer-moisture"
            aria-describedby="fertilizer-moisture-hint"
            required
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={moisture}
            onChange={(e) => setMoisture(e.target.value)}
            className={inputCls}
          />
        </label>

        <label htmlFor="fertilizer-soil" className="block md:col-span-1">
          <span className="text-sm font-medium text-ink/90">Soil type</span>
          <select
            id="fertilizer-soil"
            required
            value={soilType}
            onChange={(e) => setSoilType(e.target.value)}
            className={inputCls}
          >
            <option value="">Select soil type</option>
            {SOIL_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="fertilizer-crop" className="block md:col-span-2">
          <span className="text-sm font-medium text-ink/90">Crop type</span>
          <span id="fertilizer-crop-hint" className="mt-0.5 block text-xs text-ink-faint">
            e.g. Tomato, Wheat, Maize
          </span>
          <input
            id="fertilizer-crop"
            aria-describedby="fertilizer-crop-hint"
            required
            type="text"
            autoComplete="off"
            placeholder="e.g. Tomato"
            value={cropType}
            onChange={(e) => setCropType(e.target.value)}
            className={inputCls}
          />
        </label>

        <label htmlFor="fertilizer-n" className="block md:col-span-1">
          <span className="text-sm font-medium text-ink/90">Nitrogen N (kg/ha)</span>
          <span id="fertilizer-n-hint" className="mt-0.5 block text-xs text-ink-faint">
            Soil test or applied N basis
          </span>
          <input
            id="fertilizer-n"
            aria-describedby="fertilizer-n-hint"
            required
            type="number"
            step="0.1"
            min={0}
            value={nitrogen}
            onChange={(e) => setNitrogen(e.target.value)}
            className={inputCls}
          />
        </label>

        <label htmlFor="fertilizer-p" className="block md:col-span-1">
          <span className="text-sm font-medium text-ink/90">Phosphorous P (kg/ha)</span>
          <span id="fertilizer-p-hint" className="mt-0.5 block text-xs text-ink-faint">
            As P₂O₅ basis if your lab reports that way
          </span>
          <input
            id="fertilizer-p"
            aria-describedby="fertilizer-p-hint"
            required
            type="number"
            step="0.1"
            min={0}
            value={phosphorous}
            onChange={(e) => setPhosphorous(e.target.value)}
            className={inputCls}
          />
        </label>

        <label htmlFor="fertilizer-k" className="block md:col-span-1 md:col-start-1">
          <span className="text-sm font-medium text-ink/90">Potassium K (kg/ha K₂O)</span>
          <span id="fertilizer-k-hint" className="mt-0.5 block text-xs text-ink-faint">
            Enter as K₂O equivalent to match common soil reports
          </span>
          <input
            id="fertilizer-k"
            aria-describedby="fertilizer-k-hint"
            required
            type="number"
            step="0.1"
            min={0}
            value={potassium}
            onChange={(e) => setPotassium(e.target.value)}
            className={inputCls}
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="ds-btn-primary rounded-xl px-6 py-3 text-sm disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting…' : 'Get recommendations'}
          </button>
        </div>
      </form>

      {recommendation && (
        <div className="av-card p-6 md:p-8">
          <h2 className="text-lg font-semibold text-ink">Recommendation</h2>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{recommendation}</div>
        </div>
      )}
    </div>
  )
}
