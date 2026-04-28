import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useApiFetch } from '../hooks/useApiFetch'
import { formatApiErrorBody, parseJson } from '../lib/api'

const SUPPORTED_CROPS = new Set(['rice', 'wheat', 'maize', 'cotton', 'tomato'])

type CalendarStage = {
  key: string
  label: string
  startDay: number; endDay: number
  startDate: string; endDate: string
  kc: number
  activities: string[]
  isCurrent: boolean
  isPast: boolean
}

type Timeline = {
  crop: string
  sowingDate: string
  harvestDate: string
  durationDays: number
  daysSinceSowing: number
  daysToHarvest: number
  currentStageKey: string | null
  stages: CalendarStage[]
}

type CropOption = { key: string; name: string; duration: number }

const STORAGE_KEY = 'agrivision.calendar.form'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CropCalendarPage() {
  const { t, i18n } = useTranslation()
  const apiFetch = useApiFetch()
  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en'
  const dateLocale = lang === 'hi' ? 'hi-IN' : 'en-IN'
  const [crop, setCrop] = useState('rice')
  const [sowingDate, setSowingDate] = useState(todayIso())
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [searchParams] = useSearchParams()
  const autoBuiltRef = useRef(false)

  useEffect(() => {
    const qsCrop = searchParams.get('crop')?.toLowerCase()
    const qsDate = searchParams.get('sowingDate') || ''
    if (qsCrop && SUPPORTED_CROPS.has(qsCrop)) {
      setCrop(qsCrop)
      if (qsDate) setSowingDate(qsDate)
      return  // skip session-storage restore when prefilling from URL
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const j = JSON.parse(raw)
      if (j.crop) setCrop(j.crop)
      if (j.sowingDate) setSowingDate(j.sowingDate)
    } catch { /* ignore */ }
  }, [searchParams])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ crop, sowingDate })) } catch { /* ignore */ }
  }, [crop, sowingDate])

  const cropsQuery = useQuery({
    queryKey: ['calendar-crops', lang],
    queryFn: async () => {
      const res = await fetch(`/api/crop-calendar/crops?language=${lang}`)
      const j = await parseJson<{ crops: CropOption[] }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('calendar.errors.loadCropsFailed')))
      return j.crops || []
    },
  })

  const buildMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/crop-calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop, sowingDate, language: lang }),
      })
      const j = await parseJson<{ timeline: Timeline; detail?: unknown; message?: string; error?: string }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('calendar.errors.buildFailed')))
      return j.timeline
    },
    onSuccess: (tl) => setTimeline(tl),
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); buildMut.mutate() }

  useEffect(() => {
    if (autoBuiltRef.current) return
    const qsCrop = searchParams.get('crop')?.toLowerCase()
    if (!qsCrop || !SUPPORTED_CROPS.has(qsCrop)) return
    if (crop !== qsCrop) return
    autoBuiltRef.current = true
    buildMut.mutate()
  }, [crop, sowingDate, searchParams, buildMut])

  const progress = useMemo(() => {
    if (!timeline) return 0
    const pct = (timeline.daysSinceSowing / Math.max(1, timeline.durationDays)) * 100
    return Math.max(0, Math.min(100, pct))
  }, [timeline])

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('calendar.title')}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">{t('calendar.subtitle')}</p>
      </header>

      <form onSubmit={onSubmit} className="av-card grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="text-sm font-medium text-ink/90">{t('calendar.fields.crop')}</span>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className="ds-input mt-1 w-full rounded-xl">
            {(cropsQuery.data ?? []).map((c) => (
              <option key={c.key} value={c.key}>{c.name} · {c.duration}d</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink/90">{t('calendar.fields.sowingDate')}</span>
          <input type="date" value={sowingDate} onChange={(e) => setSowingDate(e.target.value)} className="ds-input mt-1 w-full rounded-xl" />
        </label>
        <button type="submit" disabled={buildMut.isPending} className="ds-btn-primary self-end rounded-xl px-4 py-2 text-sm disabled:opacity-50">
          {buildMut.isPending ? t('calendar.building') : t('calendar.build')}
        </button>
      </form>

      {timeline && (
        <section className="space-y-4">
          <div className="av-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-faint">{t('calendar.season')}</div>
                <div className="text-lg font-semibold text-ink">
                  {fmtDate(timeline.sowingDate)} → {fmtDate(timeline.harvestDate)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-ink-faint">{t('calendar.daysToHarvest')}</div>
                <div className="text-lg font-semibold text-ink">{timeline.daysToHarvest}d</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-ds">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-ink-faint">
              <span>{t('calendar.daysSinceSowing', { count: timeline.daysSinceSowing })}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          <ol className="space-y-3">
            {timeline.stages.map((s, idx) => (
              <li key={s.key} className={`av-card p-4 ${s.isCurrent ? 'border-emerald-400/60 ring-1 ring-emerald-400/40' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${s.isCurrent ? 'bg-emerald-500 text-void-1' : s.isPast ? 'bg-surface-ds text-ink-muted line-through' : 'bg-indigo-cta/20 text-indigo-100'}`}>{idx + 1}</span>
                    <h3 className="text-sm font-semibold text-ink">{s.label}</h3>
                    {s.isCurrent && <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-100">{t('calendar.current')}</span>}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {fmtDate(s.startDate)} → {fmtDate(s.endDate)} · Kc {s.kc.toFixed(2)}
                  </div>
                </div>
                <ul className="mt-2 ml-8 list-disc space-y-1 text-xs text-ink/85">
                  {s.activities.map((a, i) => (<li key={i}>{a}</li>))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
