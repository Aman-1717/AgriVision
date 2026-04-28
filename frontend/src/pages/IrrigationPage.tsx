import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useApiFetch } from '../hooks/useApiFetch'
import { formatApiErrorBody, parseJson } from '../lib/api'

type Advice = {
  crop: string; stage: string; stageLabel: string; kc: number
  et0MmDay: number; etcMmDay: number; rainfallMm: number
  netMmToday: number; grossMmToday: number
  intervalDays: number
  applicationEfficiency: number; rootDepthCm: number
  soilTawMm: number; soilRawMm: number
  areaHa: number; volumeTodayL: number; volumePerCycleL: number
  notes: string[]
}

const CROPS = ['rice', 'wheat', 'maize', 'cotton', 'tomato'] as const
const SOILS = ['sandy', 'sandy loam', 'loamy', 'clay loam', 'clay', 'silty', 'peaty', 'chalky'] as const
const METHODS = ['drip', 'sprinkler', 'furrow', 'flood', 'basin'] as const
const STAGES = ['', 'germination', 'nursery', 'tillering', 'vegetative', 'jointing', 'squaring', 'panicle', 'tasseling', 'flowering', 'fruit', 'boll', 'grain', 'maturity', 'harvest'] as const

const STORAGE_KEY = 'agrivision.irrigation.form'

export function IrrigationPage() {
  const { t, i18n } = useTranslation()
  const apiFetch = useApiFetch()
  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en'

  const [crop, setCrop] = useState<string>('wheat')
  const [stage, setStage] = useState<string>('')
  const [daysSinceSowing, setDaysSinceSowing] = useState<string>('60')
  const [soilType, setSoilType] = useState<string>('loamy')
  const [method, setMethod] = useState<string>('drip')
  const [area, setArea] = useState<string>('1')
  const [areaUnit, setAreaUnit] = useState<string>('ha')
  const [tempMaxC, setTempMaxC] = useState<string>('32')
  const [tempMinC, setTempMinC] = useState<string>('22')
  const [humidity, setHumidity] = useState<string>('60')
  const [rainfallMm, setRainfallMm] = useState<string>('0')
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [searchParams] = useSearchParams()
  const autoComputedRef = useRef(false)
  const prefilledFromUrlRef = useRef(false)

  useEffect(() => {
    const qsCrop = searchParams.get('crop')?.toLowerCase()
    if (qsCrop && (CROPS as readonly string[]).includes(qsCrop)) {
      prefilledFromUrlRef.current = true
      setCrop(qsCrop)
      const qsDays = searchParams.get('daysSinceSowing')
      if (qsDays) setDaysSinceSowing(qsDays)
      const qsSoil = searchParams.get('soilType')?.toLowerCase()
      if (qsSoil && (SOILS as readonly string[]).includes(qsSoil)) setSoilType(qsSoil)
      const qsArea = searchParams.get('area')
      if (qsArea) setArea(qsArea)
      const qsUnit = searchParams.get('areaUnit')
      if (qsUnit === 'ha' || qsUnit === 'acre') setAreaUnit(qsUnit)
      return  // skip session-storage restore when prefilling from URL
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const j = JSON.parse(raw)
      if (j.crop) setCrop(j.crop); if (j.stage != null) setStage(j.stage)
      if (j.daysSinceSowing != null) setDaysSinceSowing(j.daysSinceSowing)
      if (j.soilType) setSoilType(j.soilType); if (j.method) setMethod(j.method)
      if (j.area != null) setArea(j.area); if (j.areaUnit) setAreaUnit(j.areaUnit)
      if (j.tempMaxC != null) setTempMaxC(j.tempMaxC); if (j.tempMinC != null) setTempMinC(j.tempMinC)
      if (j.humidity != null) setHumidity(j.humidity); if (j.rainfallMm != null) setRainfallMm(j.rainfallMm)
    } catch { /* ignore */ }
  }, [searchParams])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        crop, stage, daysSinceSowing, soilType, method, area, areaUnit, tempMaxC, tempMinC, humidity, rainfallMm,
      }))
    } catch { /* ignore */ }
  }, [crop, stage, daysSinceSowing, soilType, method, area, areaUnit, tempMaxC, tempMinC, humidity, rainfallMm])

  const adviceMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/irrigation-advice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop, stage: stage || null, daysSinceSowing: daysSinceSowing.trim() ? parseInt(daysSinceSowing) : null,
          soilType, method, area: parseFloat(area || '0'), areaUnit,
          tempMaxC: parseFloat(tempMaxC || '0'), tempMinC: parseFloat(tempMinC || '0'),
          humidity: parseFloat(humidity || '0'), rainfallMm: parseFloat(rainfallMm || '0'),
          language: lang,
        }),
      })
      const j = await parseJson<{ advice: Advice; detail?: unknown; message?: string; error?: string }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('irrigation.errors.adviceFailed')))
      return j.advice
    },
    onSuccess: (a) => setAdvice(a),
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); adviceMut.mutate() }

  useEffect(() => {
    if (autoComputedRef.current) return
    if (!prefilledFromUrlRef.current) return
    const qsCrop = searchParams.get('crop')?.toLowerCase()
    if (!qsCrop || crop !== qsCrop) return
    autoComputedRef.current = true
    adviceMut.mutate()
  }, [crop, soilType, area, areaUnit, daysSinceSowing, searchParams, adviceMut])

  const inputCls = 'ds-input mt-1 w-full rounded-xl'

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('irrigation.title')}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">{t('irrigation.subtitle')}</p>
      </header>

      <form onSubmit={onSubmit} className="av-card grid gap-4 p-5 md:grid-cols-3">
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.crop')}</span>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className={inputCls}>
            {CROPS.map((c) => (<option key={c} value={c}>{t(`irrigation.crops.${c}`, { defaultValue: c })}</option>))}
          </select>
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.stage')}</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls}>
            {STAGES.map((s) => (<option key={s || 'auto'} value={s}>{s ? s : t('irrigation.stageAuto')}</option>))}
          </select>
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.daysSinceSowing')}</span>
          <input type="number" min={0} step={1} value={daysSinceSowing} onChange={(e) => setDaysSinceSowing(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.soilType')}</span>
          <select value={soilType} onChange={(e) => setSoilType(e.target.value)} className={inputCls}>
            {SOILS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.method')}</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {METHODS.map((m) => (<option key={m} value={m}>{t(`irrigation.methods.${m}`, { defaultValue: m })}</option>))}
          </select>
        </label>
        <div className="block">
          <label htmlFor="ir-area" className="text-sm font-medium text-ink/90">{t('irrigation.fields.area')}</label>
          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <input id="ir-area" type="number" step="0.01" min={0} value={area} onChange={(e) => setArea(e.target.value)} className="ds-input rounded-xl" />
            <select value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)} className="ds-input rounded-xl">
              <option value="ha">{t('irrigation.units.ha', { defaultValue: 'ha' })}</option>
              <option value="acre">{t('irrigation.units.acre', { defaultValue: 'acre' })}</option>
            </select>
          </div>
        </div>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.tempMaxC')}</span>
          <input type="number" step="0.1" value={tempMaxC} onChange={(e) => setTempMaxC(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.tempMinC')}</span>
          <input type="number" step="0.1" value={tempMinC} onChange={(e) => setTempMinC(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.humidity')}</span>
          <input type="number" step="1" min={0} max={100} value={humidity} onChange={(e) => setHumidity(e.target.value)} className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-ink/90">{t('irrigation.fields.rainfallMm')}</span>
          <input type="number" step="0.1" min={0} value={rainfallMm} onChange={(e) => setRainfallMm(e.target.value)} className={inputCls} />
        </label>
        <div className="self-end">
          <button type="submit" disabled={adviceMut.isPending} className="ds-btn-primary w-full rounded-xl px-4 py-2 text-sm disabled:opacity-50">
            {adviceMut.isPending ? t('irrigation.computing') : t('irrigation.compute')}
          </button>
        </div>
      </form>

      {advice && <AdviceCard advice={advice} />}
    </div>
  )
}

function AdviceCard({ advice }: { advice: Advice }) {
  const { t } = useTranslation()
  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="rounded-xl border border-ds-border bg-void-2/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="text-base font-semibold text-ink">{value}</div>
      {hint && <div className="text-[10px] text-ink-faint">{hint}</div>}
    </div>
  )
  return (
    <section className="space-y-4">
      <div className="av-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">{advice.stageLabel}</h2>
          <span className="text-xs text-ink-muted">Kc {advice.kc.toFixed(2)} · ET₀ {advice.et0MmDay} mm/d · ETc {advice.etcMmDay} mm/d</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('irrigation.stats.todayDepth')} value={`${advice.grossMmToday} mm`} hint={`${t('irrigation.stats.netMm')}: ${advice.netMmToday} mm`} />
          <Stat label={t('irrigation.stats.todayVolume')} value={`${advice.volumeTodayL.toLocaleString()} L`} hint={`${advice.areaHa} ha`} />
          <Stat label={t('irrigation.stats.interval')} value={`${advice.intervalDays} d`} hint={`${t('irrigation.stats.efficiency')}: ${(advice.applicationEfficiency * 100).toFixed(0)}%`} />
          <Stat label={t('irrigation.stats.cycleVolume')} value={`${advice.volumePerCycleL.toLocaleString()} L`} hint={`RAW ${advice.soilRawMm} mm of TAW ${advice.soilTawMm} mm`} />
        </div>
        {advice.notes.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-ink/85">
            {advice.notes.map((n, i) => (<li key={i}>{n}</li>))}
          </ul>
        )}
      </div>
    </section>
  )
}
