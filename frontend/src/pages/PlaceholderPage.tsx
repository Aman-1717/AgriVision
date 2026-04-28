import { Link } from 'react-router-dom'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ds-border bg-void-2/40 px-8 py-20 text-center">
      <span className="ds-badge-neutral">Coming soon</span>
      <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 max-w-md text-ink-muted">{description}</p>
      <Link to="/" className="ds-link-accent mt-6 text-sm">
        Back to home
      </Link>
    </div>
  )
}
