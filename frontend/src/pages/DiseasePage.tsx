import { useMutation } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import { parseJson } from '../lib/api'
import { useApiFetch } from '../hooks/useApiFetch'
import {
  clearDiseaseHistory,
  imageFileToThumbDataUrl,
  loadDiseaseHistory,
  pushDiseaseHistory,
  type DiseaseHistoryItem,
} from '../lib/diseaseHistory'

type PredictResult = {
  class?: string
  confidence?: number
  description?: string
  treatment?: string
}

function formatConditionName(className: string) {
  return className.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function stripMdBold(s: string) {
  return s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
}

function TreatmentContent({ text }: { text: string }) {
  const numberedPattern = /\d+\.\s+/
  let items: string[] = []

  if (numberedPattern.test(text)) {
    items = text.split(/(?=\d+\.\s+)/).filter((item) => item.trim() && numberedPattern.test(item.trim()))
  } else if (/^[-*•]\s/m.test(text)) {
    items = text.split(/(?=^[-*•]\s)/m).filter((i) => i.trim())
  } else {
    const lines = text.split(/\n/).filter((l) => l.trim())
    if (lines.length > 1) {
      const looksLikeList = lines.some((line) => /^\d+\.|^[-*•]|^\*\s/.test(line.trim()))
      if (looksLikeList) {
        items = lines.filter((line) => /^\d+\.|^[-*•]|^\*\s/.test(line.trim()))
      }
    }
  }

  if (items.length > 0) {
    return (
      <ul className="list-inside list-disc space-y-2 text-sm text-ink/90">
        {items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {stripMdBold(item.trim().replace(/^\d+\.\s*/, '').replace(/^[-*•]\s*/, '').replace(/^\*\s*/, ''))}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
      {stripMdBold(text || 'No treatment information available.')}
    </p>
  )
}

export function DiseasePage() {
  const apiFetch = useApiFetch()
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<File | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [drag, setDrag] = useState(false)
  const [history, setHistory] = useState<DiseaseHistoryItem[]>(() => loadDiseaseHistory())

  const revoke = useCallback(() => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const pickFile = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    revoke()
    const url = URL.createObjectURL(f)
    fileRef.current = f
    setFile(f)
    setPreviewUrl(url)
    setResult(null)
  }

  const clear = () => {
    revoke()
    fileRef.current = null
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const mutation = useMutation({
    mutationFn: async (body: FormData) => {
      const res = await apiFetch('/api/predict', { method: 'POST', body: body })
      const j = await parseJson<{ result?: PredictResult; error?: string; message?: string }>(res)
      if (!res.ok) throw new Error(j.message || j.error || 'Prediction failed')
      if (!j.result) throw new Error('No result')
      return j.result
    },
    onSuccess: async (data) => {
      setResult(data)
      toast.success('Analysis complete')
      const f = fileRef.current
      if (!f) return
      let thumb: string | undefined
      try {
        thumb = await imageFileToThumbDataUrl(f)
      } catch {
        /* thumbnail optional */
      }
      pushDiseaseHistory({
        at: new Date().toISOString(),
        label: formatConditionName(data.class ?? 'Unknown'),
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        thumbDataUrl: thumb,
      })
      setHistory(loadDiseaseHistory())
    },
    onError: (e: Error) => toast.error(e.message || 'Request failed'),
  })

  const analyze = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    mutation.mutate(fd)
  }

  const className = result?.class ?? ''
  const confidence =
    typeof result?.confidence === 'number' ? result.confidence.toFixed(1) : String(result?.confidence ?? '0')
  const confNum = parseFloat(confidence)
  const isHealthy = /healthy/i.test(className)
  let confLabel = 'Low'
  let confColor = 'text-red-300'
  if (confNum >= 80) {
    confLabel = 'High'
    confColor = 'text-indigo-cta-bright'
  } else if (confNum >= 60) {
    confLabel = 'Medium'
    confColor = 'text-amber-200'
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Plant disease detection</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Upload a clear leaf photo. Results include confidence, context, and care-oriented suggestions.
        </p>
      </header>

      {history.length > 0 && (
        <section className="av-card p-4" aria-label="Recent disease checks">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Recent checks</h2>
            <button
              type="button"
              onClick={() => {
                clearDiseaseHistory()
                setHistory([])
              }}
              className="text-xs font-medium text-ink-muted underline decoration-ds-border-accent/40 underline-offset-2 hover:text-ink"
            >
              Clear all
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-faint">Stored only in this browser (local storage).</p>
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {history.map((h) => (
              <li
                key={h.id}
                className="w-28 shrink-0 overflow-hidden rounded-xl border border-ds-border bg-void-2/50"
              >
                {h.thumbDataUrl ? (
                  <img src={h.thumbDataUrl} alt="" className="h-16 w-full object-cover" />
                ) : (
                  <div className="flex h-16 items-center justify-center text-[10px] text-ink-faint">No image</div>
                )}
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-ink">{h.label}</p>
                  <p className="text-[11px] text-ink-faint">{h.confidence.toFixed(0)}%</p>
                  <p className="text-[10px] text-ink-faint">
                    {new Date(h.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!previewUrl && (
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            pickFile(e.dataTransfer.files[0])
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ds-border bg-void-2/40 px-6 py-14 transition hover:border-ds-border-hover hover:bg-surface-ds',
            drag && 'border-indigo-cta/50 bg-indigo-cta/10',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <span className="rounded-full border border-ds-border-accent/20 bg-indigo-cta/15 p-4 text-indigo-cta-bright">
            <UploadIcon className="h-10 w-10" />
          </span>
          <p className="mt-4 text-sm font-medium text-ink">Drag and drop or click to upload</p>
          <p className="mt-1 text-sm text-ink-faint">PNG, JPG — one leaf, good light</p>
        </button>
      )}

      {previewUrl && !result && (
        <div className="av-card overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <img src={previewUrl} alt="Preview" className="max-h-80 w-full rounded-xl object-contain" />
            <div className="flex flex-col justify-center gap-3">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={analyze}
                className="ds-btn-primary rounded-xl px-4 py-3 text-sm disabled:opacity-50"
              >
                {mutation.isPending ? 'Analyzing…' : 'Run analysis'}
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={clear}
                className="ds-btn-secondary rounded-xl px-4 py-3 text-sm"
              >
                Remove image
              </button>
            </div>
          </div>
        </div>
      )}

      {mutation.isPending && (
        <div className="av-card flex items-center gap-4 p-6">
          <div className="ds-spinner" />
          <div>
            <p className="font-medium text-ink">Running model</p>
            <p className="text-sm text-ink-faint">This usually takes a few seconds.</p>
          </div>
        </div>
      )}

      {result && previewUrl && (
        <div className="av-card space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 border-b border-ds-border pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Diagnosis</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">{formatConditionName(className)}</h2>
            </div>
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold',
                isHealthy
                  ? 'border-ds-border-accent/30 bg-indigo-cta/20 text-ink'
                  : 'border-amber-500/30 bg-amber-950/40 text-amber-100',
              )}
            >
              {isHealthy ? 'Healthy' : 'Condition flagged'}
            </span>
          </div>
          <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
            <div className="space-y-4">
              <img src={previewUrl} alt="Analyzed" className="w-full rounded-xl border border-ds-border object-contain" />
              <div className="rounded-xl border border-ds-border bg-void-2/50 p-4 text-center">
                <p className="text-xs font-medium uppercase text-ink-faint">Confidence</p>
                <p className={cn('mt-1 text-3xl font-semibold tabular-nums', confColor)}>{confidence}%</p>
                <p className="text-sm text-ink-muted">{confLabel}</p>
              </div>
            </div>
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-ink">Description</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/90">
                  {result.description || 'No description available.'}
                </p>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-ink">Treatment and recommendations</h3>
                <div className="mt-2">
                  <TreatmentContent text={result.treatment || ''} />
                </div>
              </section>
            </div>
          </div>
          <button
            type="button"
            onClick={clear}
            className="ds-btn-primary w-full rounded-xl py-3 text-sm md:w-auto md:px-6"
          >
            Analyze another image
          </button>
        </div>
      )}
    </div>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  )
}
