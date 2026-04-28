import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

/* Unified tool / surface styling (indigo + void — matches app shell) */
const toolCard = {
  border: 'border-ds-border hover:border-ds-border-hover',
  accent: 'from-indigo-500/15 via-indigo-500/5 to-transparent',
  iconBg: 'border border-ds-border-accent/30 bg-indigo-cta/20 text-indigo-cta-bright',
} as const

const primaryMeta = [
  { to: '/disease', toolKey: 'disease' as const, icon: LeafIcon, ...toolCard },
  { to: '/weather', toolKey: 'weather' as const, icon: CloudIcon, ...toolCard },
  { to: '/fertilizer', toolKey: 'fertilizer' as const, icon: BeakerIcon, ...toolCard },
] as const

const secondaryMeta = [
  { to: '/community', key: 'community' as const, icon: UsersIcon, tint: 'hover:bg-surface-ds' },
  { to: '/soil', key: 'soil' as const, icon: LayersIcon, tint: 'hover:bg-surface-ds' },
  { to: '/plants', key: 'plants' as const, icon: PlantIcon, tint: 'hover:bg-surface-ds' },
] as const

const stepKeys = [
  { n: '01', titleKey: 'step1Title' as const, bodyKey: 'step1Body' as const },
  { n: '02', titleKey: 'step2Title' as const, bodyKey: 'step2Body' as const },
  { n: '03', titleKey: 'step3Title' as const, bodyKey: 'step3Body' as const },
] as const

const workspaceItems = [
  { key: 'latest' as const, subKey: 'latestSub' as const, bar: 'bg-indigo-cta' },
  { key: 'field' as const, subKey: 'fieldSub' as const, bar: 'bg-indigo-cta/55' },
  { key: 'npk' as const, subKey: 'npkSub' as const, bar: 'bg-indigo-400/50' },
] as const

export function HomePage() {
  const { t } = useTranslation()

  const benefits = useMemo(
    () => [t('home.benefits.local'), t('home.benefits.weather'), t('home.benefits.guidance')],
    [t],
  )

  return (
    <div className="space-y-14 md:space-y-20">
      <section className="ds-hero">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-10 px-6 py-12 md:px-10 md:py-14 xl:grid-cols-[1fr_min(340px,100%)] xl:items-center xl:gap-14">
          <div>
            <p className="ds-kicker text-indigo-cta-bright/80">{t('home.hero.kicker')}</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-gradient-hero md:text-5xl lg:text-[2.75rem] lg:leading-[1.1]">
              {t('home.hero.title')}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted md:text-lg">
              {t('home.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/disease"
                className="ds-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
              >
                {t('home.hero.ctaDisease')}
                <ChevronIcon className="h-4 w-4 opacity-90" />
              </Link>
              <Link
                to="/weather"
                className="ds-btn-secondary inline-flex items-center rounded-xl px-5 py-2.5 text-sm"
              >
                {t('home.hero.ctaWeather')}
              </Link>
              <Link
                to="/fertilizer"
                className="ds-btn-secondary inline-flex items-center rounded-xl border-ds-border/80 px-5 py-2.5 text-sm"
              >
                {t('home.hero.ctaFertilizer')}
              </Link>
            </div>
            <ul className="mt-10 flex flex-col gap-2.5 text-sm text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
              {benefits.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-cta"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <WorkspacePreview />
        </div>
      </section>

      <section aria-labelledby="core-tools-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="core-tools-heading" className="text-xl font-semibold tracking-tight text-ink">
            {t('home.coreTools')}
          </h2>
          <p className="max-w-md text-sm text-ink-faint">{t('home.coreToolsHint')}</p>
        </div>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {primaryMeta.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className={cn(
                  'av-card av-card-hover group relative flex h-full flex-col overflow-hidden p-6 transition duration-200 hover:-translate-y-0.5',
                  c.border,
                )}
              >
                <div
                  className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80', c.accent)}
                  aria-hidden
                />
                <div className="relative flex flex-1 flex-col">
                  <span
                    className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', c.iconBg)}
                  >
                    <c.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-ink group-hover:text-ink">
                    {t(`home.tools.${c.toolKey}.title`)}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">
                    {t(`home.tools.${c.toolKey}.desc`)}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-indigo-cta-bright">
                    {t('home.open')}
                    <ChevronIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="av-card p-6 md:p-8" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-lg font-semibold text-ink">
          {t('home.how.title')}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('home.how.subtitle')}</p>
        <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
          {stepKeys.map((s, i) => (
            <li key={s.n} className="relative flex gap-4">
              {i < stepKeys.length - 1 ? (
                <div
                  className="absolute left-[1.125rem] top-12 hidden h-[calc(100%+0.5rem)] w-px bg-gradient-to-b from-indigo-cta/30 to-transparent md:block"
                  aria-hidden
                />
              ) : null}
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-cta text-xs font-bold text-white shadow-[0_0_0_1px_rgba(94,106,210,0.4)]"
                aria-hidden
              >
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold text-ink">{t(`home.how.${s.titleKey}`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{t(`home.how.${s.bodyKey}`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-xl font-semibold tracking-tight text-ink">
          {t('home.also.title')}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {secondaryMeta.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className={cn(
                  'av-card av-card-hover group flex gap-4 p-4 transition hover:-translate-y-px',
                  c.tint,
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ds-border bg-void-2/50 text-ink/90 transition group-hover:bg-surface-ds group-hover:text-indigo-cta-bright">
                  <c.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink">{t(`home.also.${c.key}.title`)}</h3>
                  <p className="mt-0.5 text-sm text-ink-muted">{t(`home.also.${c.key}.desc`)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="av-card flex flex-col items-start justify-between gap-4 px-5 py-4 text-sm text-ink-muted sm:flex-row sm:items-center">
        <p>
          <span className="font-medium text-ink">{t('home.disclaimer.line1')}</span> {t('home.disclaimer.line2')}
        </p>
        <Link
          to="/about"
          className="ds-btn-secondary shrink-0 rounded-lg px-3 py-1.5 text-sm"
        >
          {t('home.disclaimerCta')}
        </Link>
      </footer>
    </div>
  )
}

function WorkspacePreview() {
  const { t } = useTranslation()
  return (
    <div className="relative mx-auto w-full max-w-sm xl:mx-0 xl:max-w-none">
      <div
        className="pointer-events-none absolute inset-2 rounded-3xl bg-gradient-to-br from-indigo-500/15 via-transparent to-indigo-400/5 blur-xl"
        aria-hidden
      />
      <div className="relative rotate-1 space-y-3 rounded-2xl border border-ds-border bg-void-2/60 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-transform duration-300 xl:rotate-0">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-ink-faint">
          {t('home.workspace.title')}
        </p>
        {workspaceItems.map((item, i) => (
          <div
            key={item.key}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-ds-border bg-void-2/50 px-3 py-3',
              i === 1 && '-translate-x-1',
              i === 2 && 'translate-x-1',
            )}
          >
            <span className={cn('h-10 w-1 shrink-0 rounded-full', item.bar)} aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-faint">{t(`home.workspace.${item.key}`)}</p>
              <p className="truncate text-sm font-medium text-ink">
                {t(`home.workspace.${item.subKey}`)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const iconStroke = { width: 1.75 as const, cap: 'round' as const, join: 'round' as const }

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
      aria-hidden
    >
      <path d="M12 3c6 4 8 10 6 15a7 7 0 01-12 0c-2-5 0-11 6-15z" />
      <path d="M12 8v13" />
    </svg>
  )
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
      aria-hidden
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <circle cx="17" cy="7.5" r="2.5" />
      <path d="M17 3.5v1M17 11.5v1M13.8 7.5h-1M21.2 7.5h-1" />
    </svg>
  )
}

function BeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
      aria-hidden
    >
      <path d="M10 2v7.31" />
      <path d="M14 9.3V2" />
      <path d="M8.5 2h7" />
      <path d="M14 9.3a6 6 0 1 1-4 0" />
      <path d="M5.52 16h12.96" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
      aria-hidden
    >
      <circle cx="9" cy="7" r="3.25" />
      <path d="M3 19v-.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v.5" />
      <circle cx="17" cy="8.5" r="2.75" />
      <path d="M21 19v-.4a4 4 0 0 0-3-3.7" />
    </svg>
  )
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
      aria-hidden
    >
      <path d="M12.83 3.18a2 2 0 0 0-1.66 0L3.6 7.08a1 1 0 0 0 0 1.84l7.57 3.45a2 2 0 0 0 1.65 0l7.58-3.45a1 1 0 0 0 0-1.84L12.83 3.18z" />
      <path d="m21 12-8.58 3.91a2 2 0 0 1-1.66 0L3 12" />
      <path d="m21 17-8.58 3.91a2 2 0 0 1-1.66 0L3 17" />
    </svg>
  )
}

function PlantIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
      aria-hidden
    >
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5 8-6 4-10" />
      <path d="M9.5 9.5c-3 3-1.5 6.5-3 10" />
    </svg>
  )
}
