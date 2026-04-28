import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useApiFetch } from '../hooks/useApiFetch'
import { formatApiErrorBody, parseJson } from '../lib/api'

type HistoryItem = {
  id: number
  kind: 'disease' | 'crop_rec' | 'yield' | 'fertilizer' | 'calendar' | 'irrigation' | 'chat'
  summary: string
  language: string
  fieldId: number | null
  createdAt: string | null
}

type DetailItem = HistoryItem & { input?: unknown; output?: unknown }

const KIND_FILTERS = ['all', 'disease', 'crop_rec', 'yield', 'fertilizer', 'calendar', 'irrigation', 'chat'] as const
type KindFilter = (typeof KIND_FILTERS)[number]

const KIND_BADGE: Record<HistoryItem['kind'], string> = {
  disease: 'bg-emerald-500/15 text-emerald-100',
  crop_rec: 'bg-indigo-cta/15 text-indigo-100',
  yield: 'bg-amber-500/15 text-amber-100',
  fertilizer: 'bg-sky-500/15 text-sky-100',
  calendar: 'bg-fuchsia-500/15 text-fuchsia-100',
  irrigation: 'bg-cyan-500/15 text-cyan-100',
  chat: 'bg-violet-500/15 text-violet-100',
}

export function HistoryPage() {
  const { t, i18n } = useTranslation()
  const { isSignedIn, isLoaded } = useAuth()
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  const [kind, setKind] = useState<KindFilter>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const dateLocale = i18n.language.startsWith('hi') ? 'hi-IN' : 'en-IN'

  const listQuery = useQuery({
    queryKey: ['history', kind],
    enabled: !!isSignedIn,
    queryFn: async () => {
      const url = kind === 'all' ? '/api/history' : `/api/history?kind=${kind}`
      const res = await apiFetch(url)
      const j = await parseJson<{ items: HistoryItem[] }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('history.errors.loadFailed')))
      return j.items || []
    },
  })

  const detailQuery = useQuery({
    queryKey: ['history-detail', openId],
    enabled: openId != null,
    queryFn: async () => {
      const res = await apiFetch(`/api/history/${openId}`)
      const j = await parseJson<{ item: DetailItem }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('history.errors.loadFailed')))
      return j.item
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/history/${id}`, { method: 'DELETE' })
      const j = await parseJson<{ deleted?: number; detail?: unknown }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('history.errors.deleteFailed')))
      return j.deleted
    },
    onSuccess: () => {
      toast.success(t('history.toast.deleted'))
      setOpenId(null)
      qc.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clearMut = useMutation({
    mutationFn: async () => {
      const url = kind === 'all' ? '/api/history' : `/api/history?kind=${kind}`
      const res = await apiFetch(url, { method: 'DELETE' })
      const j = await parseJson<{ deleted?: number; detail?: unknown }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('history.errors.deleteFailed')))
      return j.deleted
    },
    onSuccess: (n) => {
      toast.success(t('history.toast.cleared', { count: n ?? 0 }))
      setOpenId(null)
      qc.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data])
  const onClear = () => {
    if (!items.length) return
    if (!confirm(t('history.clearConfirm', { count: items.length }))) return
    clearMut.mutate()
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('history.title')}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t('history.subtitle')}</p>
        </div>
        {isSignedIn && items.length > 0 && (
          <button type="button" onClick={onClear} disabled={clearMut.isPending} className="ds-btn-secondary shrink-0 rounded-xl px-3 py-1.5 text-xs disabled:opacity-50">
            {clearMut.isPending ? t('history.clearing') : t('history.clear')}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs transition ${kind === k ? 'border-indigo-cta bg-indigo-cta/15 text-ink' : 'border-ds-border bg-surface-ds text-ink-muted hover:text-ink'}`}>
            {t(`history.filters.${k}`)}
          </button>
        ))}
      </div>

      {!isLoaded ? null : !isSignedIn ? (
        <div className="av-card flex flex-wrap items-center gap-3 p-6">
          <span className="text-sm text-ink/85">{t('history.signInRequired')}</span>
          <SignInButton mode="modal">
            <button type="button" className="ds-btn-primary rounded-lg px-3 py-1.5 text-sm">{t('auth.signIn')}</button>
          </SignInButton>
        </div>
      ) : listQuery.isLoading ? (
        <div className="av-card p-6 text-sm text-ink-muted">{t('history.loading')}</div>
      ) : listQuery.isError ? (
        <div className="av-card p-6 text-sm text-red-200">{(listQuery.error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="av-card p-8 text-center text-sm text-ink-muted">{t('history.empty')}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="av-card overflow-hidden">
              <button type="button" onClick={() => setOpenId(openId === row.id ? null : row.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-ds/50">
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${KIND_BADGE[row.kind]}`}>{t(`history.filters.${row.kind}`)}</span>
                <span className="flex-1 truncate text-sm text-ink">{row.summary || t(`history.filters.${row.kind}`)}</span>
                <span className="shrink-0 text-[11px] text-ink-faint">{row.createdAt ? new Date(row.createdAt).toLocaleString(dateLocale) : ''}</span>
              </button>
              {openId === row.id && (
                <div className="border-t border-ds-border bg-void-2/40 p-4">
                  {detailQuery.isLoading ? (
                    <p className="text-xs text-ink-muted">{t('history.loadingDetail')}</p>
                  ) : detailQuery.isError ? (
                    <p className="text-xs text-red-200">{(detailQuery.error as Error).message}</p>
                  ) : detailQuery.data ? (
                    <div className="space-y-3">
                      <DetailBlock label={t('history.input')} value={detailQuery.data.input} />
                      <DetailBlock label={t('history.output')} value={detailQuery.data.output} />
                      <div className="flex justify-end">
                        <button type="button" onClick={() => deleteMut.mutate(row.id)} disabled={deleteMut.isPending} className="rounded-md px-2 py-1 text-xs text-red-200/90 transition hover:bg-red-500/15 hover:text-red-100 disabled:opacity-50">
                          {deleteMut.isPending ? t('history.deleting') : t('history.delete')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <pre className="max-h-72 overflow-auto rounded-lg border border-ds-border bg-void-1/60 p-3 text-[11px] leading-relaxed text-ink/85">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
