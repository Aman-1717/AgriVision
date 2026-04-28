import { SignIn } from '@clerk/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { AmbientBackground } from '../components/ambient/AmbientBackground'

export function LoginPage() {
  const { t } = useTranslation()
  return (
    <div className="relative min-h-dvh text-ink">
      <AmbientBackground />
      <div className="relative z-0 flex min-h-dvh flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border bg-void-1/55 px-6 py-4 backdrop-blur-xl">
          <Link to="/" className="text-sm font-medium text-ink-muted transition hover:text-ink">
            {t('login.back')}
          </Link>
          <LanguageSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="av-card w-full max-w-md p-6">
            <h1 className="text-center text-xl font-semibold text-gradient-hero">{t('login.title')}</h1>
            <p className="mt-1 text-center text-sm text-ink-faint">{t('login.subtitle')}</p>
            <div className="mt-6 flex justify-center">
              <SignIn
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none border border-ds-border bg-void-2/90 text-ink',
                    headerTitle: 'text-ink',
                    headerSubtitle: 'text-ink-faint',
                    formButtonPrimary:
                      'rounded-lg bg-indigo-cta text-white hover:bg-indigo-cta-bright shadow-[0_0_0_1px_rgba(94,106,210,0.5)]',
                    formFieldInput:
                      'rounded-lg border border-white/10 bg-input-void text-ink focus:border-indigo-cta',
                    footer: 'text-ink-faint',
                  },
                }}
                signUpUrl="/login"
                forceRedirectUrl="/"
                fallbackRedirectUrl="/"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
