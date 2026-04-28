import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { schemeUrls } from '../data/governmentSchemes'

const SCHEMES = [
  { key: 'pmkisan' as const, url: schemeUrls.pmkisan },
  { key: 'kcc' as const, url: schemeUrls.kccRbi },
  { key: 'soilhealth' as const, url: schemeUrls.soilhealth },
  { key: 'enam' as const, url: schemeUrls.enam },
  { key: 'icarAwd' as const, url: schemeUrls.icarAwd },
]

export function ResourceManagementPage() {
  const { t } = useTranslation()
  const sections = [
    { key: 'water' as const, to: '/weather' },
    { key: 'fertilizer' as const, to: '/fertilizer' },
    { key: 'cost' as const, to: '/dashboard' },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('resources.title')}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">{t('resources.subtitle')}</p>
      </header>

      <ul className="grid gap-4 md:grid-cols-3">
        {sections.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className="av-card flex h-full flex-col p-5 transition hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-ink">{t(`resources.${s.key}.title`)}</h2>
              <p className="mt-2 flex-1 text-sm text-ink-muted">{t(`resources.${s.key}.body`)}</p>
              <span className="mt-4 text-sm font-medium text-indigo-cta-bright">{t('resources.open')} →</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="av-card p-6">
        <h2 className="text-lg font-semibold text-ink">{t('resources.schedule.title')}</h2>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-ink/90">
          <li>{t('resources.schedule.s1')}</li>
          <li>{t('resources.schedule.s2')}</li>
          <li>{t('resources.schedule.s3')}</li>
        </ol>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold text-ink">{t('resources.schemes.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('resources.schemes.subtitle')}</p>
        </header>
        <ul className="grid gap-4 md:grid-cols-2">
          {SCHEMES.map((s) => (
            <li key={s.key} className="av-card flex h-full flex-col p-5">
              <h3 className="text-base font-semibold text-ink">{t(`resources.schemes.${s.key}.name`)}</h3>
              <p className="mt-2 flex-1 text-sm text-ink-muted">{t(`resources.schemes.${s.key}.summary`)}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-fit items-center gap-1 text-sm font-medium text-indigo-cta-bright transition hover:underline"
              >
                {t('resources.schemes.open')}
                <span aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-faint">{t('resources.schemes.disclaimer')}</p>
      </section>
    </div>
  )
}
