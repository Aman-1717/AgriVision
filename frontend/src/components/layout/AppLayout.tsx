import { Link, Outlet, useLocation } from 'react-router-dom'
import { Show, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { FarmChatDock } from '../FarmChatDock'
import { AmbientBackground } from '../ambient/AmbientBackground'
import { cn } from '../../lib/utils'

const nav = [
  { to: '/', labelKey: 'nav.home', icon: HomeIcon },
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: DashboardIcon },
  { to: '/disease', labelKey: 'nav.disease', icon: LeafIcon },
  { to: '/weather', labelKey: 'nav.weather', icon: CloudIcon },
  { to: '/market', labelKey: 'nav.market', icon: MarketChartIcon },
  { to: '/fertilizer', labelKey: 'nav.fertilizer', icon: FertilizerIcon },
  { to: '/crop-recommendation', labelKey: 'nav.cropRecommendation', icon: CropIcon },
  { to: '/yield', labelKey: 'nav.yield', icon: YieldIcon },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarIcon },
  { to: '/irrigation', labelKey: 'nav.irrigation', icon: DropletIcon },
  { to: '/fields', labelKey: 'nav.fields', icon: FieldsIcon },
  { to: '/history', labelKey: 'nav.history', icon: HistoryIcon },
  { to: '/resources', labelKey: 'nav.resources', icon: WaterEfficiencyIcon },
  { to: '/community', labelKey: 'nav.community', icon: UsersIcon },
  { to: '/soil', labelKey: 'nav.soil', icon: SoilLayersIcon },
  { to: '/plants', labelKey: 'nav.plants', icon: PlantIcon },
] as const

function NavList({
  onNavigate,
  className,
}: {
  onNavigate?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const location = useLocation()
  return (
    <nav className={cn('flex flex-col gap-0.5', className)}>
      {nav.map((item) => {
        const active =
          item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn('ds-nav-item', active && 'ds-nav-item-active')}
          >
            <item.icon className="h-5 w-5 shrink-0 text-ink/90" />
            <span className="flex-1">{t(item.labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <div className="relative min-h-dvh text-ink">
      <AmbientBackground />
      <div className="relative z-0 flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ds-border bg-void-2/40 backdrop-blur-xl md:flex">
          <Link
            to="/"
            className="flex items-center gap-2 border-b border-ds-border px-4 py-4 text-lg font-semibold tracking-tight"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ds-border bg-surface-ds text-indigo-cta shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <LeafIcon className="h-5 w-5" />
            </span>
            {t('brand')}
          </Link>
          <div className="flex flex-1 flex-col p-2">
            <NavList />
          </div>
          <div className="border-t border-ds-border p-2">
            <Link
              to="/about"
              className={cn(
                'ds-nav-item text-xs',
                location.pathname === '/about' && 'ds-nav-item-active',
              )}
            >
              {t('aboutLink')}
            </Link>
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-[3.5rem] flex-wrap items-center justify-between gap-2 border-b border-ds-border bg-void-1/55 px-3 py-2.5 backdrop-blur-xl md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ds-border bg-surface-ds text-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition hover:bg-surface-ds-hover md:hidden"
                aria-expanded={mobileOpen}
                aria-controls="av-mobile-nav"
                aria-label={t('nav.openMenu')}
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <span className="min-w-0 truncate font-semibold tracking-tight text-ink md:hidden">
                {t('brand')}
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <ClerkHeader />
              <LanguageSwitcher />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
          <FarmChatDock />
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" id="av-mobile-nav" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-void-0/75 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-dvh w-[min(20rem,88vw)] flex-col border-r border-ds-border bg-void-2/90 shadow-[4px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-ds-border px-3 py-3">
              <span className="text-sm font-semibold tracking-tight text-ink">{t('brand')}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ds-border bg-surface-ds text-ink"
                aria-label="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-ds-border p-2">
              <Link
                to="/about"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'ds-nav-item text-xs',
                  location.pathname === '/about' && 'ds-nav-item-active',
                )}
              >
                {t('aboutLink')}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ClerkHeader() {
  const { t } = useTranslation()
  const { isLoaded } = useAuth()
  if (!isLoaded) {
    return <div className="h-8 w-20 animate-pulse rounded-lg border border-ds-border bg-surface-ds" />
  }
  return (
    <>
      <Show when="signed-out">
        <div className="flex flex-wrap items-center gap-2">
          <SignInButton mode="modal">
            <button type="button" className="ds-btn-primary px-3 py-1.5 text-sm">
              {t('auth.signIn')}
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="ds-btn-secondary px-3 py-1.5 text-sm text-ink-muted">
              {t('auth.signUp')}
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{ elements: { avatarBox: 'h-9 w-9 ring-1 ring-ds-border' } }}
        />
      </Show>
    </>
  )
}

const iconStroke = {
  width: 1.75 as const,
  cap: 'round' as const,
  join: 'round' as const,
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M3 3h8v8H3V3zM13 3h8v4h-8V3zM13 9h8v12h-8V9zM3 13h8v8H3v-8z" />
    </svg>
  )
}

function MarketChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7 19V10" />
      <path d="M12 19V6" />
      <path d="M17 19v-7" />
      <path d="M21 19H3" />
    </svg>
  )
}

function WaterEfficiencyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M12 2.5c-3 4.5-6 7.1-6 11a6 6 0 1 0 12 0c0-3.9-3-6.5-6-11z" />
      <path d="M8 16h.01M12 18h.01M16 16h.01" />
    </svg>
  )
}

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
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <circle cx="17" cy="7.5" r="2.5" />
      <path d="M17 3.5v1M17 11.5v1M13.8 7.5h-1M21.2 7.5h-1" />
    </svg>
  )
}

function FertilizerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
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
    >
      <circle cx="9" cy="7" r="3.25" />
      <path d="M3 19v-.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v.5" />
      <circle cx="17" cy="8.5" r="2.75" />
      <path d="M21 19v-.4a4 4 0 0 0-3-3.7" />
    </svg>
  )
}

function SoilLayersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M12.83 3.18a2 2 0 0 0-1.66 0L3.6 7.08a1 1 0 0 0 0 1.84l7.57 3.45a2 2 0 0 0 1.65 0l7.58-3.45a1 1 0 0 0 0-1.84L12.83 3.18z" />
      <path d="m21 12-8.58 3.91a2 2 0 0 1-1.66 0L3 12" />
      <path d="m21 17-8.58 3.91a2 2 0 0 1-1.66 0L3 17" />
    </svg>
  )
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M12 3s6 7.2 6 11a6 6 0 11-12 0c0-3.8 6-11 6-11z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function FieldsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 12l9 4 9-4" />
      <path d="M3 17l9 4 9-4" />
    </svg>
  )
}

function YieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 3 5-6" />
      <path d="M14 8h4v4" />
    </svg>
  )
}

function CropIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={iconStroke.width}
      strokeLinecap={iconStroke.cap}
      strokeLinejoin={iconStroke.join}
    >
      <path d="M12 21V9" />
      <path d="M12 9c0-3 2-5 5-5-.5 3-2.5 5-5 5z" />
      <path d="M12 13c0-3-2-5-5-5 .5 3 2.5 5 5 5z" />
      <path d="M5 21h14" />
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
    >
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5 8-6 4-10" />
      <path d="M9.5 9.5c-3 3-1.5 6.5-3 10" />
    </svg>
  )
}
