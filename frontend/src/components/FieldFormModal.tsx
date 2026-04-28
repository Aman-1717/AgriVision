import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SOIL_OPTIONS = ['', 'Sandy', 'Clay', 'Loamy', 'Silty', 'Peaty', 'Chalky'] as const

export type FieldRecord = {
  id: number
  name: string
  area: number
  areaUnit: string
  soilType: string
  crop: string
  sowingDate: string | null
  latitude: number | null
  longitude: number | null
  notes: string
  createdAt: string | null
  updatedAt: string | null
}

export type FieldFormPayload = {
  name: string
  area: number
  areaUnit: string
  soilType: string
  crop: string
  sowingDate: string | null
  latitude: number | null
  longitude: number | null
  notes: string
}

type Props = {
  open: boolean
  initial?: FieldRecord | null
  submitting?: boolean
  errorMessage?: string | null
  onClose: () => void
  onSubmit: (payload: FieldFormPayload) => void
}

const inputCls = 'ds-input mt-1 w-full rounded-xl'

export function FieldFormModal({ open, initial, submitting, errorMessage, onClose, onSubmit }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [areaUnit, setAreaUnit] = useState('ha')
  const [soilType, setSoilType] = useState('')
  const [crop, setCrop] = useState('')
  const [sowingDate, setSowingDate] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setArea(initial?.area != null ? String(initial.area) : '')
    setAreaUnit(initial?.areaUnit ?? 'ha')
    setSoilType(initial?.soilType ?? '')
    setCrop(initial?.crop ?? '')
    setSowingDate(initial?.sowingDate ?? '')
    setLatitude(initial?.latitude != null ? String(initial.latitude) : '')
    setLongitude(initial?.longitude != null ? String(initial.longitude) : '')
    setNotes(initial?.notes ?? '')
    setLocalError(null)
  }, [open, initial])

  if (!open) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setLocalError(t('fields.errors.name')); return }
    const areaN = parseFloat(area)
    if (Number.isNaN(areaN) || areaN < 0) { setLocalError(t('fields.errors.area')); return }
    setLocalError(null)
    onSubmit({
      name: trimmed,
      area: areaN,
      areaUnit,
      soilType,
      crop: crop.trim(),
      sowingDate: sowingDate.trim() || null,
      latitude: latitude.trim() ? parseFloat(latitude) : null,
      longitude: longitude.trim() ? parseFloat(longitude) : null,
      notes: notes.trim(),
    })
  }

  const message = localError || errorMessage

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-2xl overflow-y-auto rounded-2xl border border-ds-border bg-void-1 p-6 shadow-xl md:p-8" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{initial ? t('fields.modal.editTitle') : t('fields.modal.createTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-sm text-ink-faint transition hover:bg-surface-ds hover:text-ink" aria-label={t('fields.modal.close')}>✕</button>
        </div>
        {message && <div role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">{message}</div>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={inputCls} />
          </label>
          <div className="block">
            <label htmlFor="ff-area" className="text-sm font-medium text-ink/90">{t('fields.fields.area')}</label>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <input id="ff-area" type="number" step="0.01" min={0} value={area} onChange={(e) => setArea(e.target.value)} required className="ds-input rounded-xl" />
              <select value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)} className="ds-input rounded-xl" aria-label={t('fields.fields.areaUnit')}>
                <option value="ha">{t('fields.units.ha')}</option>
                <option value="acre">{t('fields.units.acre')}</option>
              </select>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.soilType')}</span>
            <select value={soilType} onChange={(e) => setSoilType(e.target.value)} className={inputCls}>
              {SOIL_OPTIONS.map((s) => (
                <option key={s || 'none'} value={s}>
                  {s ? t(`fields.soil.${s.toLowerCase()}`) : t('fields.placeholder.choose')}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.crop')}</span>
            <input value={crop} onChange={(e) => setCrop(e.target.value)} maxLength={60} className={inputCls} placeholder={t('fields.placeholder.crop')} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.sowingDate')}</span>
            <input type="date" value={sowingDate} onChange={(e) => setSowingDate(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.latitude')}</span>
            <input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputCls} placeholder={t('fields.placeholder.lat')} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.longitude')}</span>
            <input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputCls} placeholder={t('fields.placeholder.lon')} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-ink/90">{t('fields.fields.notes')}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className={`${inputCls} resize-y`} placeholder={t('fields.placeholder.notes')} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ds-btn-secondary rounded-xl px-4 py-2 text-sm" disabled={submitting}>{t('fields.modal.cancel')}</button>
          <button type="submit" className="ds-btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50" disabled={submitting}>
            {submitting ? t('fields.modal.saving') : initial ? t('fields.modal.save') : t('fields.modal.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
