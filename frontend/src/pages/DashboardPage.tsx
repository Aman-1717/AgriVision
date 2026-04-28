import { useAuth } from '@clerk/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { readStoredWeatherCoords } from '../lib/weatherLocationStorage'
import { loadDiseaseHistory, type DiseaseHistoryItem } from '../lib/diseaseHistory'
import { computeDiseaseRisks, countByLabel, historyTimeline } from '../lib/farmRisks'
import { useApiFetch } from '../hooks/useApiFetch'
import { parseJson } from '../lib/api'
import { cn } from '../lib/utils'

type ServerHistoryRow = {
  id: number
  kind: string
  summary: string
  language: string
  fieldId: number | null
  createdAt: string | null
}

// Server-side `disease` rows store summary as `"<label> (NN%)"` (see `_disease_summary` in
// backend/app_fastapi.py). We recover label + confidence from the string so the existing
// chart helpers (countByLabel, historyTimeline, computeDiseaseRisks) work unchanged.
function parseServerRow(row: ServerHistoryRow): DiseaseHistoryItem | null {
  const s = (row.summary || '').trim()
  if (!s) return null
  const m = s.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*%\)\s*$/)
  const label = (m ? m[1] : s).trim()
  const conf = m ? Number(m[2]) : 0
  return {
    id: `srv-${row.id}`,
    at: row.createdAt || new Date().toISOString(),
    label,
    confidence: Number.isFinite(conf) ? conf : 0,
  }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { isSignedIn, isLoaded } = useAuth()
  const apiFetch = useApiFetch()
  const [localHistory, setLocalHistory] = useState<DiseaseHistoryItem[]>(() => loadDiseaseHistory())

  useEffect(() => {
    const load = () => setLocalHistory(loadDiseaseHistory())
    const onVis = () => load()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agrivision:diseaseHistoryV1') load()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const serverQuery = useQuery({
    queryKey: ['dashboard-disease-history'],
    enabled: !!isSignedIn,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiFetch('/api/history?kind=disease&limit=200')
      const j = await parseJson<{ items: ServerHistoryRow[] }>(res)
      if (!res.ok) throw new Error('history_load_failed')
      return (j.items || []).map(parseServerRow).filter((x): x is DiseaseHistoryItem => !!x)
    },
  })

  const usingServer = !!isSignedIn && !serverQuery.isError
  const history: DiseaseHistoryItem[] = usingServer ? (serverQuery.data ?? []) : localHistory

  const byLabel = useMemo(() => countByLabel(history), [history])
  const timeline = useMemo(() => historyTimeline(history), [history])
  const risks = useMemo(() => computeDiseaseRisks(history), [history])
  const weatherPt = readStoredWeatherCoords()

  const barData = byLabel.map((d) => ({ name: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name, value: d.value }))

  const levelStyle =
    risks.level === 'elevated'
      ? 'border-amber-500/30 bg-amber-950/40 text-amber-100'
      : risks.level === 'moderate'
        ? 'border-ds-border-accent/30 bg-indigo-cta/12 text-ink'
        : 'border-ds-border bg-void-2/60 text-ink'

  const sourceBadge = !isLoaded
    ? null
    : usingServer
      ? serverQuery.isLoading
        ? { tone: 'border-ds-border bg-void-2/60 text-ink-muted', label: t('dashboard.source.loading') }
        : { tone: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100', label: t('dashboard.source.synced') }
      : { tone: 'border-amber-500/30 bg-amber-950/30 text-amber-100', label: t('dashboard.source.local') }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('dashboard.title')}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t('dashboard.subtitle')}</p>
        </div>
        {sourceBadge && (
          <span className={cn('shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium', sourceBadge.tone)}>
            {sourceBadge.label}
          </span>
        )}
      </header>

      <section className="av-card grid gap-4 p-5 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t('dashboard.monitoring')}</p>
          <p className="mt-1 text-sm text-ink/90">
            {weatherPt
              ? t('dashboard.locationSet', { lat: weatherPt.lat.toFixed(2), lon: weatherPt.lon.toFixed(2) })
              : t('dashboard.locationUnset')}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t('dashboard.checks')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{history.length}</p>
        </div>
        <div className={cn('rounded-xl border p-3', levelStyle)}>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{t('dashboard.risk.title')}</p>
          <p className="mt-1 text-sm font-semibold">{t(`dashboard.risk.level.${risks.level}`)}</p>
        </div>
      </section>

      {risks.flagKeys.length > 0 && (
        <ul className="av-card list-inside list-disc space-y-1 p-4 text-sm text-ink/90">
          {risks.flagKeys.map((k) => (
            <li key={k}>{t(`dashboard.risks.flags.${k}`)}</li>
          ))}
        </ul>
      )}

      {history.length === 0 ? (
        <div className="av-card p-8 text-center text-sm text-ink-muted">
          <p>{t('dashboard.empty')}</p>
          <Link to="/disease" className="ds-link-accent mt-3 inline-block text-sm">
            {t('dashboard.goDisease')}
          </Link>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="av-card min-w-0 p-4">
            <h2 className="text-sm font-semibold text-ink">{t('dashboard.chartLabels')}</h2>
            <div className="mt-4 h-64 w-full min-w-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                debounce={32}
                initialDimension={{ width: 400, height: 256 }}
              >
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#8A8F98' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10, fill: '#8A8F98' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0a0c',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="value" fill="#5e6ad2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="av-card min-w-0 p-4">
            <h2 className="text-sm font-semibold text-ink">{t('dashboard.chartTime')}</h2>
            <div className="mt-4 h-64 w-full min-w-0">
              <ResponsiveContainer
                width="100%"
                height="100%"
                debounce={32}
                initialDimension={{ width: 400, height: 256 }}
              >
                <LineChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8A8F98' }} />
                  <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10, fill: '#8A8F98' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0a0c',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                    }}
                  />
                  <Line type="monotone" dataKey="checks" stroke="#5e6ad2" strokeWidth={2} dot={{ fill: '#5e6ad2' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      <p className="text-xs text-ink-faint">{t('dashboard.footnote')}</p>
    </div>
  )
}
