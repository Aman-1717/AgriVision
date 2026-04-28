import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FieldFormModal, type FieldFormPayload, type FieldRecord } from '../components/FieldFormModal'
import { useApiFetch } from '../hooks/useApiFetch'
import { formatApiErrorBody, parseJson } from '../lib/api'

// Crops the calendar + irrigation engines support today.
const SUPPORTED_FIELD_CROPS = new Set(['rice', 'wheat', 'maize', 'cotton', 'tomato'])

function calendarLink(f: FieldRecord): string | null {
  const crop = (f.crop || '').trim().toLowerCase()
  if (!SUPPORTED_FIELD_CROPS.has(crop)) return null
  const params = new URLSearchParams({ crop, fieldId: String(f.id) })
  if (f.sowingDate) params.set('sowingDate', f.sowingDate)
  return `/calendar?${params.toString()}`
}

function irrigationLink(f: FieldRecord): string | null {
  const crop = (f.crop || '').trim().toLowerCase()
  if (!SUPPORTED_FIELD_CROPS.has(crop)) return null
  const params = new URLSearchParams({ crop, fieldId: String(f.id) })
  if (f.area > 0) params.set('area', String(f.area))
  if (f.areaUnit) params.set('areaUnit', f.areaUnit)
  if (f.soilType) params.set('soilType', f.soilType.toLowerCase())
  if (f.sowingDate) {
    const days = Math.floor((Date.now() - new Date(f.sowingDate).getTime()) / 86_400_000)
    if (Number.isFinite(days) && days >= 0) params.set('daysSinceSowing', String(days))
  }
  return `/irrigation?${params.toString()}`
}

type ListResponse = { fields: FieldRecord[] }
type SingleResponse = { field: FieldRecord; detail?: unknown; message?: string; error?: string }

export function FieldsPage() {
  const { t, i18n } = useTranslation()
  const { isSignedIn, isLoaded } = useAuth()
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FieldRecord | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const dateLocale = i18n.language.startsWith('hi') ? 'hi-IN' : 'en-IN'

  const fieldsQuery = useQuery({
    queryKey: ['fields'],
    enabled: !!isSignedIn,
    queryFn: async () => {
      const res = await apiFetch('/api/fields')
      const j = await parseJson<ListResponse>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('fields.errors.loadFailed')))
      return j.fields || []
    },
  })

  const createMut = useMutation({
    mutationFn: async (payload: FieldFormPayload) => {
      const res = await apiFetch('/api/fields', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await parseJson<SingleResponse>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('fields.errors.saveFailed')))
      return j.field
    },
    onSuccess: () => {
      toast.success(t('fields.toast.created'))
      setModalOpen(false); setEditing(null); setFormError(null)
      qc.invalidateQueries({ queryKey: ['fields'] })
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: FieldFormPayload }) => {
      const res = await apiFetch(`/api/fields/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await parseJson<SingleResponse>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('fields.errors.saveFailed')))
      return j.field
    },
    onSuccess: () => {
      toast.success(t('fields.toast.updated'))
      setModalOpen(false); setEditing(null); setFormError(null)
      qc.invalidateQueries({ queryKey: ['fields'] })
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/fields/${id}`, { method: 'DELETE' })
      const j = await parseJson<{ deleted?: number; message?: string; error?: string; detail?: unknown }>(res)
      if (!res.ok) throw new Error(formatApiErrorBody(j, t('fields.errors.deleteFailed')))
      return j.deleted
    },
    onSuccess: () => {
      toast.success(t('fields.toast.deleted'))
      qc.invalidateQueries({ queryKey: ['fields'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = (payload: FieldFormPayload) => {
    setFormError(null)
    if (editing) updateMut.mutate({ id: editing.id, payload })
    else createMut.mutate(payload)
  }

  const onDelete = (f: FieldRecord) => {
    if (!confirm(t('fields.deleteConfirm', { name: f.name }))) return
    deleteMut.mutate(f.id)
  }

  const openCreate = () => { setEditing(null); setFormError(null); setModalOpen(true) }
  const openEdit = (f: FieldRecord) => { setEditing(f); setFormError(null); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null); setFormError(null) }

  const fields = useMemo(() => fieldsQuery.data ?? [], [fieldsQuery.data])

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('fields.title')}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{t('fields.subtitle')}</p>
        </div>
        {isSignedIn && (
          <button type="button" onClick={openCreate} className="ds-btn-primary shrink-0 rounded-xl px-4 py-2 text-sm">
            + {t('fields.addField')}
          </button>
        )}
      </header>

      {!isLoaded ? null : !isSignedIn ? (
        <div className="av-card flex flex-wrap items-center gap-3 p-6">
          <span className="text-sm text-ink/85">{t('fields.signInRequired')}</span>
          <SignInButton mode="modal">
            <button type="button" className="ds-btn-primary rounded-lg px-3 py-1.5 text-sm">{t('auth.signIn')}</button>
          </SignInButton>
        </div>
      ) : fieldsQuery.isLoading ? (
        <div className="av-card p-6 text-sm text-ink-muted">{t('fields.loading')}</div>
      ) : fieldsQuery.isError ? (
        <div className="av-card p-6 text-sm text-red-200">{(fieldsQuery.error as Error).message}</div>
      ) : fields.length === 0 ? (
        <div className="av-card p-8 text-center">
          <p className="text-sm text-ink-muted">{t('fields.empty')}</p>
          <button type="button" onClick={openCreate} className="ds-btn-primary mt-3 rounded-xl px-4 py-2 text-sm">+ {t('fields.addField')}</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <article key={f.id} className="av-card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{f.name}</h3>
                <span className="rounded-md bg-indigo-cta/15 px-2 py-0.5 text-[11px] font-medium text-indigo-100">{f.area} {t(`fields.units.${f.areaUnit}`)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-xs text-ink-muted">
                {f.crop && (<><dt>{t('fields.fields.crop')}</dt><dd className="text-right text-ink/90">{f.crop}</dd></>)}
                {f.soilType && (<><dt>{t('fields.fields.soilType')}</dt><dd className="text-right text-ink/90">{t(`fields.soil.${f.soilType.toLowerCase()}`, { defaultValue: f.soilType })}</dd></>)}
                {f.sowingDate && (<><dt>{t('fields.fields.sowingDate')}</dt><dd className="text-right text-ink/90">{new Date(f.sowingDate).toLocaleDateString(dateLocale)}</dd></>)}
                {f.latitude != null && f.longitude != null && (<><dt>{t('fields.fields.location')}</dt><dd className="text-right font-mono text-ink/90">{f.latitude.toFixed(3)}, {f.longitude.toFixed(3)}</dd></>)}
              </dl>
              {f.notes && <p className="line-clamp-3 text-xs text-ink/80">{f.notes}</p>}
              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
                {calendarLink(f) && (
                  <Link to={calendarLink(f) as string} className="rounded-md px-2 py-1 text-xs text-emerald-200/90 transition hover:bg-emerald-500/15 hover:text-emerald-100">📅 {t('fields.openCalendar')}</Link>
                )}
                {irrigationLink(f) && (
                  <Link to={irrigationLink(f) as string} className="rounded-md px-2 py-1 text-xs text-sky-200/90 transition hover:bg-sky-500/15 hover:text-sky-100">💧 {t('fields.openIrrigation')}</Link>
                )}
                <button type="button" onClick={() => openEdit(f)} className="rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-surface-ds hover:text-ink">{t('fields.edit')}</button>
                <button type="button" onClick={() => onDelete(f)} className="rounded-md px-2 py-1 text-xs text-red-200/90 transition hover:bg-red-500/15 hover:text-red-100">{t('fields.delete')}</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <FieldFormModal
        open={modalOpen}
        initial={editing}
        submitting={createMut.isPending || updateMut.isPending}
        errorMessage={formError}
        onClose={closeModal}
        onSubmit={onSubmit}
      />
    </div>
  )
}
