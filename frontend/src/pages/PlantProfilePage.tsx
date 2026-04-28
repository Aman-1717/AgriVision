import { plantProfiles } from '../data/plants'

export function PlantProfilePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Plant profile</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Compact profiles for a few common crops — pair with your climate, variety, and certified seed guidance.
        </p>
      </header>
      <ul className="grid gap-4 lg:grid-cols-2">
        {plantProfiles.map((p) => (
          <li key={p.commonName} className="av-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-ink">{p.commonName}</h2>
              <span className="text-xs text-ink-faint">{p.category}</span>
            </div>
            <p className="mt-1 text-sm italic text-ink-faint">{p.scientificName}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-ink">Water</dt>
                <dd className="mt-0.5 text-ink-muted">{p.water}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Light</dt>
                <dd className="mt-0.5 text-ink-muted">{p.light}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Soil pH (general)</dt>
                <dd className="mt-0.5 text-ink-muted">{p.soilPh}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-ink-faint">Field notes</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-ink/90">
                {p.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase text-ink-faint">Scout for</p>
              <p className="mt-1 text-sm text-ink-muted">{p.pests.join(', ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
