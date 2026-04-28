import { Link } from 'react-router-dom'

export function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">About AgriVision</h1>
        <p className="mt-2 text-ink-muted">
          AgriVision brings together plant health checks, weather context, fertilizer guidance, and community tools in
          one place. Features evolve; always cross-check decisions in the field with trusted agronomic support.
        </p>
      </header>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/30 p-6 text-sm text-amber-50">
        <h2 className="text-base font-semibold text-ink">Disclaimer</h2>
        <ul className="mt-3 space-y-2 list-disc pl-5 text-amber-100/90">
          <li>
            Outputs (including disease labels, weather-driven cues, and fertilizer text) are <strong>informational</strong>,
            not professional agronomic, legal, or medical advice.
          </li>
          <li>
            They are <strong>not a substitute</strong> for a qualified agronomist, plant pathologist, soil laboratory,
            or local extension recommendations.
          </li>
          <li>
            Always follow label directions for crop protection products and comply with regulations in your jurisdiction.
          </li>
          <li>
            Image-based models can be wrong — confirm suspicious diagnoses with lab testing or expert scouting when stakes
            are high.
          </li>
        </ul>
      </section>

      <section className="av-card p-6 text-sm text-ink/90">
        <h2 className="text-base font-semibold text-ink">Privacy note</h2>
        <p className="mt-2">
          Recent disease checks may be stored <strong>only in your browser</strong> (local storage) unless you use
          features that explicitly sync to a server. Clearing site data removes that history.
        </p>
      </section>

      <p className="text-sm">
        <Link to="/" className="ds-link-accent text-sm">
          ← Back to home
        </Link>
      </p>
    </div>
  )
}
