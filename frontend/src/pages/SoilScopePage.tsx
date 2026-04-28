import { soilTips } from '../data/soilTips'

export function SoilScopePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Soil scope</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Static reference cards for common textures and field considerations — not a substitute for a lab report or
          local extension advice.
        </p>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {soilTips.map((s) => (
          <li key={s.title} className="av-card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{s.texture}</p>
            <h2 className="mt-2 text-lg font-semibold text-ink">{s.title}</h2>
            <p className="mt-2 text-sm text-ink-muted">{s.summary}</p>
            <ul className="mt-4 list-inside list-disc space-y-1.5 text-sm text-ink/90">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-faint">{s.tags.join(' · ')}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
