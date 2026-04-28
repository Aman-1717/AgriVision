import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatApiErrorBody, parseJson } from '../lib/api'
import { useApiFetch } from '../hooks/useApiFetch'

const SOIL_OPTIONS = ['Sandy', 'Clay', 'Loamy', 'Silty', 'Peaty', 'Chalky'] as const
const SEASON_OPTIONS = ['kharif', 'rabi', 'zaid'] as const
const FORM_KEY = 'agrivision:cropRecommendationFormV1'

type CropRow = {
  name: string
  name_hi: string
  score: number
  suitability: 'high' | 'medium' | 'low'
  reason: string
}

type RecommendationResponse = {
  recommendation?: { topCrops: CropRow[]; plan: string }
  detail?: unknown
  message?: string
  error?: string
}

type Persisted = {
  soilType: string
  ph: string
  temperature: string
  humidity: string
  rainfall: string
  nitrogen: string
  phosphorous: string
  potassium: string
  season: string
}

function loadPersisted(): Partial<Persisted> | null {
  try {
    const raw = sessionStorage.getItem(FORM_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

function savePersisted(p: Persisted) {
  try {
    sessionStorage.setItem(FORM_KEY, JSON.stringify(p))
  } catch {
    /* private mode */
  }
}

const inputCls = 'ds-input mt-1 w-full rounded-xl'

export function CropRecommendationPage() {
  const { t, i18n } = useTranslation()
  const apiFetch = useApiFetch()
  const formRef = useRef<HTMLFormElement>(null)
  const [soilType, setSoilType] = useState('')
  const [ph, setPh] = useState('')
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [rainfall, setRainfall] = useState('')
  const [nitrogen, setNitrogen] = useState('')
  const [phosphorous, setPhosphorous] = useState('')
  const [potassium, setPotassium] = useState('')
  const [season, setSeason] = useState('')
  const [result, setResult] = useState<{ topCrops: CropRow[]; plan: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const p = loadPersisted()
    if (!p) return
    if (p.soilType != null) setSoilType(String(p.soilType))
    if (p.ph != null) setPh(String(p.ph))
    if (p.temperature != null) setTemperature(String(p.temperature))
    if (p.humidity != null) setHumidity(String(p.humidity))
    if (p.rainfall != null) setRainfall(String(p.rainfall))
    if (p.nitrogen != null) setNitrogen(String(p.nitrogen))
    if (p.phosphorous != null) setPhosphorous(String(p.phosphorous))
    if (p.potassium != null) setPotassium(String(p.potassium))
    if (p.season != null) setSeason(String(p.season))
  }, [])

  const snapshot = (): Persisted => ({
    soilType, ph, temperature, humidity, rainfall, nitrogen, phosphorous, potassium, season,
  })

  const clearSaved = () => {
    try {
      sessionStorage.removeItem(FORM_KEY)
    } catch {
      /* no-op */
    }
    setSoilType(''); setPh(''); setTemperature(''); setHumidity(''); setRainfall('')
    setNitrogen(''); setPhosphorous(''); setPotassium(''); setSeason('')
    setResult(null); setFormError(null)
  }

  function validate(): string | null {
    if (!soilType) return t('crop.errors.soil')
    if (!season) return t('crop.errors.season')
    const nums = { ph, temperature, humidity, rainfall, nitrogen, phosphorous, potassium }
    for (const [k, v] of Object.entries(nums)) {
      if (v === '' || Number.isNaN(parseFloat(v))) return t('crop.errors.numeric', { field: t(`crop.fields.${k}`) })
    }
    const phN = parseFloat(ph)
    if (phN < 3 || phN > 10) return t('crop.errors.phRange')
    return null
  }

  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en'
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        soilType,
        ph: parseFloat(ph),
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        rainfall: parseFloat(rainfall),
        nitrogen: parseFloat(nitrogen),
        phosphorous: parseFloat(phosphorous),
        potassium: parseFloat(potassium),
        season,
        language: lang,
      }
      const res = await apiFetch('/api/crop-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await parseJson<RecommendationResponse>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('crop.errors.requestFailed')))
      if (!j.recommendation) throw new Error(t('crop.errors.empty'))
      return j.recommendation
    },
    onSuccess: (data) => {
      savePersisted(snapshot())
      setResult(data)
      setFormError(null)
      toast.success(t('crop.toast.ready'))
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null); setResult(null)
    const err = validate()
    if (err) { setFormError(err); return }
    mutation.mutate()
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('crop.title')}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t('crop.subtitle')}</p>
        </div>
        <button type="button" onClick={clearSaved} className="ds-btn-secondary shrink-0 rounded-xl px-4 py-2 text-sm">
          {t('crop.clearSaved')}
        </button>
      </header>

      <form ref={formRef} onSubmit={onSubmit} className="av-card grid gap-6 p-6 md:grid-cols-2 md:p-8" noValidate>
        {formError && (
          <div role="alert" className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <p>{formError}</p>
            <button type="button" className="mt-2 text-sm font-semibold text-red-200 underline decoration-red-400/50 underline-offset-2 hover:no-underline" onClick={() => formRef.current?.requestSubmit()}>
              {t('crop.tryAgain')}
            </button>
          </div>
        )}

        <label htmlFor="crop-soil" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.soilType')}</span>
          <select id="crop-soil" required value={soilType} onChange={(e) => setSoilType(e.target.value)} className={inputCls}>
            <option value="">{t('crop.placeholder.choose')}</option>
            {SOIL_OPTIONS.map((s) => (
              <option key={s} value={s}>{t(`crop.soil.${s.toLowerCase()}`)}</option>
            ))}
          </select>
        </label>

        <label htmlFor="crop-season" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.season')}</span>
          <select id="crop-season" required value={season} onChange={(e) => setSeason(e.target.value)} className={inputCls}>
            <option value="">{t('crop.placeholder.choose')}</option>
            {SEASON_OPTIONS.map((s) => (
              <option key={s} value={s}>{t(`crop.season.${s}`)}</option>
            ))}
          </select>
        </label>

        <label htmlFor="crop-ph" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.ph')}</span>
          <span className="mt-0.5 block text-xs text-ink-faint">{t('crop.hints.ph')}</span>
          <input id="crop-ph" required type="number" step="0.1" min={3} max={10} value={ph} onChange={(e) => setPh(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="crop-rainfall" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.rainfall')}</span>
          <span className="mt-0.5 block text-xs text-ink-faint">{t('crop.hints.rainfall')}</span>
          <input id="crop-rainfall" required type="number" step="1" min={0} max={5000} value={rainfall} onChange={(e) => setRainfall(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="crop-temp" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.temperature')}</span>
          <input id="crop-temp" required type="number" step="0.1" min={-10} max={55} value={temperature} onChange={(e) => setTemperature(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="crop-humidity" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.humidity')}</span>
          <input id="crop-humidity" required type="number" step="0.1" min={0} max={100} value={humidity} onChange={(e) => setHumidity(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="crop-n" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.nitrogen')}</span>
          <input id="crop-n" required type="number" step="0.1" min={0} value={nitrogen} onChange={(e) => setNitrogen(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="crop-p" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.phosphorous')}</span>
          <input id="crop-p" required type="number" step="0.1" min={0} value={phosphorous} onChange={(e) => setPhosphorous(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="crop-k" className="block">
          <span className="text-sm font-medium text-ink/90">{t('crop.fields.potassium')}</span>
          <input id="crop-k" required type="number" step="0.1" min={0} value={potassium} onChange={(e) => setPotassium(e.target.value)} className={inputCls} />
        </label>

        <div className="md:col-span-2">
          <button type="submit" disabled={mutation.isPending} className="ds-btn-primary rounded-xl px-6 py-3 text-sm disabled:opacity-50">
            {mutation.isPending ? t('crop.submitting') : t('crop.submit')}
          </button>
        </div>
      </form>

      {result && (
        <section className="av-card p-6 md:p-8">
          <h2 className="text-lg font-semibold text-ink">{t('crop.result.title')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.topCrops.map((c) => (
              <div key={c.name} className="rounded-xl border border-ds-border bg-void-2/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-ink">{lang === 'hi' ? c.name_hi : c.name}</div>
                  <span className={
                    c.suitability === 'high'
                      ? 'rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200'
                      : c.suitability === 'medium'
                        ? 'rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200'
                        : 'rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-200'
                  }>
                    {t(`crop.suitability.${c.suitability}`)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-faint">
                  {t('crop.result.fitScore', { score: c.score.toFixed(2) })}
                </div>
                <p className="mt-2 text-sm text-ink/85">{c.reason}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{result.plan}</div>
          <p className="mt-4 text-xs text-ink-faint">{t('crop.result.disclaimer')}</p>
        </section>
      )}
    </div>
  )
}
