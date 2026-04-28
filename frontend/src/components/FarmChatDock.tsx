import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FarmChat } from './FarmChat'

/**
 * Global floating action: round button bottom-right; opens FarmChat in a sheet/panel.
 */
export function FarmChatDock() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_6px_24px_rgba(94,106,210,0.35),inset_0_1px_0_0_rgba(255,255,255,0.15)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-cta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void-1"
        style={{ background: 'linear-gradient(145deg, #5e6ad2 0%, #4f5ac0 55%, #4349a8 100%)' }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'farm-chat-panel' : undefined}
        title={t('chat.openFab')}
      >
        <span className="sr-only">{t('chat.openFab')}</span>
        <ChatBubbleIcon className="h-7 w-7" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-end sm:justify-end sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          id="farm-chat-panel"
        >
          <button
            type="button"
            className="absolute inset-0 bg-void-0/70 backdrop-blur-sm transition"
            onClick={close}
            aria-label={t('chat.closePanel')}
          />
          <div
            className="relative z-10 flex w-full max-w-md flex-col rounded-t-2xl border border-ds-border bg-void-2/95 shadow-2xl backdrop-blur-xl sm:max-h-[min(32rem,85vh)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ds-border px-3 py-2">
              <p id={titleId} className="text-sm font-semibold text-ink">
                {t('chat.title')}
              </p>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-2 text-sm text-ink-faint transition hover:bg-surface-ds hover:text-ink"
                aria-label={t('chat.closePanel')}
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 p-2 pb-3">
              <FarmChat key={i18n.language} embedded />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H6l-3 3v-4.5A8.5 8.5 0 0 1 3 6.2 8.5 8.5 0 0 1 12.5 3h.5A8.5 8.5 0 0 1 21 11.5Z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
