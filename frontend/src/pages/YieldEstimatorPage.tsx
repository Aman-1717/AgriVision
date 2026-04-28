import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatApiErrorBody, parseJson } from '../lib/api'
import { useApiFetch } from '../hooks/useApiFetch'

const SOIL_OPTIONS = ['Sandy', 'Clay', 'Loamy', 'Silty', 'Peaty', 'Chalky'] as const
const FORM_KEY = 'agrivision:yieldEstimatorFormV1'

type CropOption = { key: string; name: string; name_hi: string }

type Estimate = {
  cropKey: string
  cropName: string
  cropNameHi: string
  areaHa: number
  baselineQtlPerHa: number
  estimateQtlPerHa: number
  lowQtlPerHa: number
  highQtlPerHa: number
  totalQtl: number
  totalTonnes: number
  factors: { nutrient: number; climate: number; soil: number; irrigation: number }
  narrative: string
}

type Persisted = {
  crop: string; area: string; areaUnit: string; soilType: string
  nitrogen: string; phosphorous: string; potassium: string
  temperature: string; humidity: string; rainfall: string; irrigated: boolean
}

function loadPersisted(): Partial<Persisted> | null {
  try { const raw = sessionStorage.getItem(FORM_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function savePersisted(p: Persisted) { try { sessionStorage.setItem(FORM_KEY, JSON.stringify(p)) } catch { /* */ } }

const inputCls = 'ds-input mt-1 w-full rounded-xl'

export function YieldEstimatorPage() {
  const { t, i18n } = useTranslation()
  const apiFetch = useApiFetch()
  const formRef = useRef<HTMLFormElement>(null)
  const [crop, setCrop] = useState('')
  const [area, setArea] = useState('')
  const [areaUnit, setAreaUnit] = useState('ha')
  const [soilType, setSoilType] = useState('')
  const [nitrogen, setNitrogen] = useState('')
  const [phosphorous, setPhosphorous] = useState('')
  const [potassium, setPotassium] = useState('')
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [rainfall, setRainfall] = useState('')
  const [irrigated, setIrrigated] = useState(true)
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const cropsQuery = useQuery({
    queryKey: ['yield-crops'],
    queryFn: async () => {
      const res = await fetch('/api/yield-crops')
      const j = await parseJson<{ crops: CropOption[] }>(res)
      return j.crops || []
    },
    staleTime: 24 * 60 * 60 * 1000,
  })

  useEffect(() => {
    const p = loadPersisted(); if (!p) return
    if (p.crop != null) setCrop(String(p.crop))
    if (p.area != null) setArea(String(p.area))
    if (p.areaUnit != null) setAreaUnit(String(p.areaUnit))
    if (p.soilType != null) setSoilType(String(p.soilType))
    if (p.nitrogen != null) setNitrogen(String(p.nitrogen))
    if (p.phosphorous != null) setPhosphorous(String(p.phosphorous))
    if (p.potassium != null) setPotassium(String(p.potassium))
    if (p.temperature != null) setTemperature(String(p.temperature))
    if (p.humidity != null) setHumidity(String(p.humidity))
    if (p.rainfall != null) setRainfall(String(p.rainfall))
    if (typeof p.irrigated === 'boolean') setIrrigated(p.irrigated)
  }, [])

  const snapshot = (): Persisted => ({
    crop, area, areaUnit, soilType, nitrogen, phosphorous, potassium,
    temperature, humidity, rainfall, irrigated,
  })
  const clearSaved = () => {
    try { sessionStorage.removeItem(FORM_KEY) } catch { /* */ }
    setCrop(''); setArea(''); setAreaUnit('ha'); setSoilType('')
    setNitrogen(''); setPhosphorous(''); setPotassium('')
    setTemperature(''); setHumidity(''); setRainfall(''); setIrrigated(true)
    setEstimate(null); setFormError(null)
  }

  function validate(): string | null {
    if (!crop) return t('yield.errors.crop')
    if (!soilType) return t('yield.errors.soil')
    const nums = { area, nitrogen, phosphorous, potassium, temperature, humidity, rainfall }
    for (const [k, v] of Object.entries(nums)) {
      if (v === '' || Number.isNaN(parseFloat(v))) return t('yield.errors.numeric', { field: t(`yield.fields.${k}`) })
    }
    if (parseFloat(area) <= 0) return t('yield.errors.areaPositive')
    return null
  }

  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en'
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        crop, area: parseFloat(area), areaUnit, soilType,
        nitrogen: parseFloat(nitrogen),
        phosphorous: parseFloat(phosphorous),
        potassium: parseFloat(potassium),
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        rainfall: parseFloat(rainfall),
        irrigated, language: lang,
      }
      const res = await apiFetch('/api/yield-estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await parseJson<{ estimate?: Estimate; detail?: unknown; message?: string; error?: string }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('yield.errors.requestFailed')))
      if (!j.estimate) throw new Error(t('yield.errors.empty'))
      return j.estimate
    },
    onSuccess: (data) => {
      savePersisted(snapshot())
      setEstimate(data); setFormError(null)
      toast.success(t('yield.toast.ready'))
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null); setEstimate(null)
    const err = validate(); if (err) { setFormError(err); return }
    mutation.mutate()
  }


  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('yield.title')}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t('yield.subtitle')}</p>
        </div>
        <button type="button" onClick={clearSaved} className="ds-btn-secondary shrink-0 rounded-xl px-4 py-2 text-sm">
          {t('yield.clearSaved')}
        </button>
      </header>

      <form ref={formRef} onSubmit={onSubmit} className="av-card grid gap-6 p-6 md:grid-cols-2 md:p-8" noValidate>
        {formError && (
          <div role="alert" className="md:col-span-2 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            <p>{formError}</p>
            <button type="button" className="mt-2 text-sm font-semibold text-red-200 underline decoration-red-400/50 underline-offset-2 hover:no-underline" onClick={() => formRef.current?.requestSubmit()}>
              {t('yield.tryAgain')}
            </button>
          </div>
        )}

        <label htmlFor="yield-crop" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.crop')}</span>
          <select id="yield-crop" required value={crop} onChange={(e) => setCrop(e.target.value)} className={inputCls} disabled={cropsQuery.isLoading}>
            <option value="">{cropsQuery.isLoading ? t('yield.placeholder.loading') : t('yield.placeholder.choose')}</option>
            {(cropsQuery.data || []).map((c) => (
              <option key={c.key} value={c.key}>{lang === 'hi' ? `${c.name_hi} (${c.name})` : c.name}</option>
            ))}
          </select>
        </label>

        <label htmlFor="yield-soil" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.soilType')}</span>
          <select id="yield-soil" required value={soilType} onChange={(e) => setSoilType(e.target.value)} className={inputCls}>
            <option value="">{t('yield.placeholder.choose')}</option>
            {SOIL_OPTIONS.map((s) => (
              <option key={s} value={s}>{t(`yield.soil.${s.toLowerCase()}`)}</option>
            ))}
          </select>
        </label>

        <div className="block md:col-span-1">
          <label htmlFor="yield-area" className="text-sm font-medium text-ink/90">
            {t('yield.fields.area')}
          </label>
          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <input
              id="yield-area"
              required
              type="number"
              step="0.01"
              min={0}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="ds-input rounded-xl"
            />
            <select
              value={areaUnit}
              onChange={(e) => setAreaUnit(e.target.value)}
              className="ds-input rounded-xl"
              aria-label={t('yield.fields.areaUnit')}
            >
              <option value="ha">{t('yield.units.ha')}</option>
              <option value="acre">{t('yield.units.acre')}</option>
            </select>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ds-border bg-void-2/50 px-4 py-3">
          <input type="checkbox" checked={irrigated} onChange={(e) => setIrrigated(e.target.checked)} className="h-4 w-4 accent-indigo-cta" />
          <span className="text-sm text-ink/90">{t('yield.fields.irrigated')}</span>
        </label>

        <label htmlFor="yield-temp" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.temperature')}</span>
          <input id="yield-temp" required type="number" step="0.1" min={-10} max={55} value={temperature} onChange={(e) => setTemperature(e.target.value)} className={inputCls} />
        </label>
        <label htmlFor="yield-humidity" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.humidity')}</span>
          <input id="yield-humidity" required type="number" step="0.1" min={0} max={100} value={humidity} onChange={(e) => setHumidity(e.target.value)} className={inputCls} />
        </label>
        <label htmlFor="yield-rain" className="block md:col-span-2">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.rainfall')}</span>
          <span className="mt-0.5 block text-xs text-ink-faint">{t('yield.hints.rainfall')}</span>
          <input id="yield-rain" required type="number" step="1" min={0} max={5000} value={rainfall} onChange={(e) => setRainfall(e.target.value)} className={inputCls} />
        </label>

        <label htmlFor="yield-n" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.nitrogen')}</span>
          <input id="yield-n" required type="number" step="0.1" min={0} value={nitrogen} onChange={(e) => setNitrogen(e.target.value)} className={inputCls} />
        </label>
        <label htmlFor="yield-p" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.phosphorous')}</span>
          <input id="yield-p" required type="number" step="0.1" min={0} value={phosphorous} onChange={(e) => setPhosphorous(e.target.value)} className={inputCls} />
        </label>
        <label htmlFor="yield-k" className="block">
          <span className="text-sm font-medium text-ink/90">{t('yield.fields.potassium')}</span>
          <input id="yield-k" required type="number" step="0.1" min={0} value={potassium} onChange={(e) => setPotassium(e.target.value)} className={inputCls} />
        </label>

        <div className="md:col-span-2">
          <button type="submit" disabled={mutation.isPending} className="ds-btn-primary rounded-xl px-6 py-3 text-sm disabled:opacity-50">
            {mutation.isPending ? t('yield.submitting') : t('yield.submit')}
          </button>
        </div>
      </form>

      {estimate && <EstimateCard estimate={estimate} lang={lang} />}
    </div>
  )
}

function EstimateCard({ estimate, lang }: { estimate: Estimate; lang: 'en' | 'hi' }) {
  const { t } = useTranslation()
  const fkeys = ['nutrient', 'climate', 'soil', 'irrigation'] as const
  return (
    <section className="av-card p-6 md:p-8">
      <h2 className="text-lg font-semibold text-ink">{t('yield.result.title')}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-ds-border bg-void-2/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">{t('yield.result.perHectare')}</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{estimate.estimateQtlPerHa} {t('yield.units.qtlPerHa')}</div>
          <div className="mt-1 text-xs text-ink-muted">{t('yield.result.band', { lo: estimate.lowQtlPerHa, hi: estimate.highQtlPerHa })}</div>
        </div>
        <div className="rounded-xl border border-ds-border bg-void-2/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">{t('yield.result.totalProduction')}</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{estimate.totalQtl} {t('yield.units.qtl')}</div>
          <div className="mt-1 text-xs text-ink-muted">{estimate.totalTonnes} {t('yield.units.tonnes')} • {estimate.areaHa} {t('yield.units.ha')}</div>
        </div>
        <div className="rounded-xl border border-ds-border bg-void-2/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">{t('yield.result.crop')}</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{lang === 'hi' ? estimate.cropNameHi : estimate.cropName}</div>
          <div className="mt-1 text-xs text-ink-muted">{t('yield.result.baseline', { v: estimate.baselineQtlPerHa })}</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-[11px] uppercase tracking-wide text-ink-faint">{t('yield.result.factors')}</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {fkeys.map((k) => {
            const v = estimate.factors[k]
            const tone = v >= 0.95 ? 'text-emerald-200' : v >= 0.8 ? 'text-amber-200' : 'text-red-200'
            return (
              <div key={k} className="rounded-lg border border-ds-border bg-void-2/40 px-3 py-2">
                <div className="text-xs text-ink-muted">{t(`yield.factors.${k}`)}</div>
                <div className={`mt-0.5 text-base font-semibold ${tone}`}>×{v.toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{estimate.narrative}</div>
      <p className="mt-4 text-xs text-ink-faint">{t('yield.result.disclaimer')}</p>
    </section>
  )
}
