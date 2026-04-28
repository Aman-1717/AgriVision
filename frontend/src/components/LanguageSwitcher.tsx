import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'

const codes = ['en', 'hi'] as const

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const value = i18n.language.startsWith('hi') ? 'hi' : 'en'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor="av-lang" className="text-xs font-medium text-ink-faint">
        {t('language.label')}
      </label>
      <select
        id="av-lang"
        value={value}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="rounded-lg border border-ds-border bg-input-void py-1.5 pl-2 pr-7 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-indigo-cta/40"
      >
        {codes.map((code) => (
          <option key={code} value={code}>
            {t(`language.${code}`)}
          </option>
        ))}
      </select>
    </div>
  )
}
