import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { parseJson } from '../lib/api'
import { persistWeatherCoords, readStoredWeatherCoords } from '../lib/weatherLocationStorage'

type CommodityRow = {
  commodity: string
  variety: string
  min_price: number
  max_price: number
  modal_price: number
  market: string
  unit: string
  arrival_date?: string | null
}

type OgdDiagnostics = {
  code: string
  detail: string | null
  fix_hint: string | null
}

type MarketSnapshot = {
  region: {
    country: string
    state: string
    district: string
    display_name: string
    lat: number
    lon: number
  }
  data_mode: 'live_ogd' | 'indicative'
  as_of_ist: string
  data_updated: string
  commodities: CommodityRow[]
  source_note: string
  analysis: { headline: string; bullets: string[]; links: { label: string; url: string }[] }
  ogd_configured: boolean
  ogd_diagnostics?: OgdDiagnostics
}

type SearchHit = {
  lat: number
  lon: number
  name: string
  state: string
  country: string
  display_name: string
}

function fmtInr(n: number) {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export function MarketAnalysisPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en'
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [label, setLabel] = useState<string>('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const applySaved = useCallback(() => {
    const c = readStoredWeatherCoords()
    if (c) {
      setLat(c.lat)
      setLon(c.lon)
      setLabel(t('market.labelSaved'))
    } else {
      toast.message(t('market.toastNoSaved'), { description: t('market.toastNoSavedHint') })
    }
  }, [t])

  useEffect(() => {
    const c = readStoredWeatherCoords()
    if (c) {
      setLat(c.lat)
      setLon(c.lon)
      setLabel(t('market.labelSaved'))
    }
  }, [t])

  const runPlaceSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      toast.error(t('market.searchShort'))
      return
    }
    setSearchLoading(true)
    setSearchHits(null)
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      const data = await parseJson<{ locations?: SearchHit[]; detail?: string }>(res)
      if (!res.ok) {
        throw new Error(
          typeof data === 'object' && data && 'detail' in data
            ? String((data as { detail?: string }).detail)
            : t('market.searchFailed'),
        )
      }
      const locs = data.locations ?? []
      if (locs.length === 0) {
        toast.message(t('market.noSearchHits'))
        setSearchHits([])
        return
      }
      setSearchHits(locs)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('market.searchFailed'))
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery, t])

  const selectSearchHit = useCallback(
    (h: SearchHit) => {
      setLat(h.lat)
      setLon(h.lon)
      setLabel(h.display_name)
      setSearchQuery(h.display_name)
      setSearchHits(null)
      persistWeatherCoords(h.lat, h.lon)
    },
    [],
  )

  const loadGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t('market.geoUnsupported'))
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude
        const lo = pos.coords.longitude
        setLat(la)
        setLon(lo)
        persistWeatherCoords(la, lo)
        setLabel(t('market.labelGps'))
        setGeoLoading(false)
      },
      () => {
        toast.error(t('market.geoFail'))
        setGeoLoading(false)
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    )
  }, [t])

  const enabled = lat != null && lon != null

  const q = useQuery({
    queryKey: ['market', 'snapshot', lat, lon, lang],
    queryFn: async () => {
      const p = new URLSearchParams({ lat: String(lat), lon: String(lon), lang })
      const res = await fetch(`/api/market/snapshot?${p.toString()}`, { credentials: 'include' })
      const body = await parseJson<MarketSnapshot & { detail?: string }>(res)
      if (!res.ok) {
        const msg =
          typeof body === 'object' && body && 'detail' in body
            ? String((body as { detail?: string }).detail)
            : res.statusText
        throw new Error(msg)
      }
      return body as MarketSnapshot
    },
    enabled,
  })

  const when = useMemo(() => {
    if (!q.data?.as_of_ist) return ''
    try {
      const d = new Date(q.data.as_of_ist)
      return d.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return q.data.as_of_ist
    }
  }, [q.data, i18n.language])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-gradient-hero">{t('market.title')}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">{t('market.subtitle')}</p>
        <p className="mt-1 text-sm text-amber-200/90">{t('market.indiaOnly')}</p>
      </header>

      <div className="av-card av-card-hover space-y-3 p-4 transition">
        <p className="text-sm font-medium text-ink">{t('market.setLocation')}</p>
        <p className="text-sm text-ink-muted">
          {t('market.searchIntro')}{' '}
          <Link to="/weather" className="font-medium text-indigo-cta-bright underline-offset-2 hover:underline">
            {t('market.weatherLink')}
          </Link>
          {t('market.searchIntroSuffix')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runPlaceSearch()}
            placeholder={t('market.searchPlaceholder')}
            className="ds-input min-w-0 flex-1 rounded-xl"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runPlaceSearch()}
              disabled={searchLoading}
              className="ds-btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            >
              {searchLoading ? t('market.searching') : t('market.search')}
            </button>
            <button type="button" onClick={applySaved} className="ds-btn-secondary rounded-xl px-3 py-2 text-sm">
              {t('market.useSaved')}
            </button>
            <button
              type="button"
              onClick={loadGps}
              disabled={geoLoading}
              className="ds-btn-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50"
            >
              {geoLoading ? t('market.geoWait') : t('market.useGps')}
            </button>
          </div>
        </div>
        {searchHits && searchHits.length > 0 ? (
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ds-border bg-void-2/50 p-2 text-sm">
            {searchHits.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectSearchHit(h)}
                  className="w-full rounded-md px-2 py-2 text-left text-ink transition hover:bg-surface-ds"
                >
                  <span className="block font-medium text-ink">{h.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searchHits && searchHits.length === 0 && !searchLoading ? (
          <p className="text-xs text-ink-faint">{t('market.noSearchHits')}</p>
        ) : null}
      </div>

      {label ? (
        <p className="text-xs text-ink-faint">
          {t('market.activeSource')}: {label} —{' '}
          {lat != null && lon != null
            ? `${lat.toFixed(4)}, ${lon.toFixed(4)}`
            : ''}
        </p>
      ) : null}

      {!enabled ? (
        <div className="av-card p-4 text-sm text-ink-muted">{t('market.noCoords')}</div>
      ) : q.isLoading ? (
        <div className="av-card p-6 text-sm text-ink-faint">{t('market.loading')}</div>
      ) : q.isError ? (
        <div className="av-card border-red-500/30 bg-red-950/30 p-6 text-sm text-red-200">
          {q.error instanceof Error ? q.error.message : t('market.error')}
        </div>
      ) : q.data ? (
        <div className="space-y-6">
          <div className="av-card av-card-hover p-4 transition">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-mono text-[0.7rem] uppercase tracking-widest text-ink-faint">
                  {t('market.region')}
                </p>
                <p className="text-lg font-semibold text-ink">
                  {q.data.region.district} · {q.data.region.state}
                </p>
                <p className="text-xs text-ink-faint">{q.data.region.display_name}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    q.data.data_mode === 'live_ogd'
                      ? 'rounded-full border border-ds-border-accent/40 bg-indigo-cta/20 px-3 py-1 text-xs font-medium text-ink'
                      : 'rounded-full border border-amber-500/20 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-100'
                  }
                >
                  {q.data.data_mode === 'live_ogd' ? t('market.modeLive') : t('market.modeIndicative')}
                </span>
                {when ? <span className="text-xs text-ink-faint">{t('market.asOf', { when })}</span> : null}
              </div>
            </div>
            {q.data.ogd_configured === false && q.data.data_mode === 'indicative' ? (
              <p className="mt-3 text-xs text-amber-100/90">{t('market.ogdHint')}</p>
            ) : null}
            {q.data.data_mode === 'indicative' && q.data.ogd_diagnostics?.fix_hint ? (
              <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-xs text-amber-50">
                <p className="font-medium text-ink">{t('market.ogdFixTitle')}</p>
                <p className="mt-1 text-amber-100/90">{q.data.ogd_diagnostics.fix_hint}</p>
                {q.data.ogd_diagnostics.detail ? (
                  <p className="mt-1 font-mono text-[0.7rem] text-amber-200/80">{q.data.ogd_diagnostics.detail}</p>
                ) : null}
                <a
                  href="https://www.data.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-medium text-indigo-cta-bright underline"
                >
                  data.gov.in ↗
                </a>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-ink-faint">{q.data.source_note}</p>
          </div>

          <div className="av-card av-card-hover overflow-x-auto p-0 transition">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead>
                <tr className="border-b border-ds-border bg-void-2/50 text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-medium">{t('market.col.commodity')}</th>
                  <th className="px-4 py-3 font-medium">{t('market.col.variety')}</th>
                  <th className="px-4 py-3 font-medium text-right tabular-nums">{t('market.col.min')}</th>
                  <th className="px-4 py-3 font-medium text-right tabular-nums">{t('market.col.modal')}</th>
                  <th className="px-4 py-3 font-medium text-right tabular-nums">{t('market.col.max')}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{t('market.col.arrival')}</th>
                  <th className="px-4 py-3 font-medium">{t('market.col.market')}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.commodities.map((r, i) => (
                  <tr key={i} className="border-b border-ds-border/80 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{r.commodity}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{r.variety}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink/90">{fmtInr(r.min_price)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-indigo-cta-bright">
                      {fmtInr(r.modal_price)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink/90">{fmtInr(r.max_price)}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-faint whitespace-nowrap">
                      {r.arrival_date || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{r.market}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-ds-border px-4 py-2 text-xs text-ink-faint">{t('market.unitNote')}</p>
          </div>

          <div className="av-card p-4">
            <h2 className="text-sm font-semibold text-ink">{q.data.analysis.headline}</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
              {q.data.analysis.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {q.data.analysis.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-ds-border bg-surface-ds px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-ds-hover"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-ink-faint">{t('market.disclaimer')}</p>
        </div>
      ) : null}
    </div>
  )
}
