import { useEffect, useRef, useState } from 'react'
import { useAuth, SignInButton } from '@clerk/react'
import { useTranslation } from 'react-i18next'
import { parseJson } from '../lib/api'
import { useVoice } from '../hooks/useVoice'

const MAX_MSGS = 20
const AUTO_SPEAK_KEY = 'agrivision:chat:autoSpeak'

type Msg = { role: 'user' | 'assistant'; content: string }

type ChatApiResponse = {
  reply?: string | null
  error?: string
  source?: string
}

type FarmChatProps = { embedded?: boolean }

export function FarmChat({ embedded = false }: FarmChatProps) {
  const { t, i18n } = useTranslation()
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: t('chat.welcome') },
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_SPEAK_KEY) === '1'
    } catch {
      return false
    }
  })
  const inputBeforeMicRef = useRef('')

  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en'
  const voice = useVoice({
    lang,
    onTranscript: (text, isFinal) => {
      // Live caption into the textbox; finalize replaces interim with the full transcript.
      const base = inputBeforeMicRef.current
      const sep = base && !base.endsWith(' ') ? ' ' : ''
      setInput(`${base}${sep}${text}`.trimStart())
      if (isFinal) {
        inputBeforeMicRef.current = `${base}${sep}${text}`.trimStart()
      }
    },
    onError: (code) => {
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setErr(t('chat.voice.micDenied'))
      } else if (code === 'no-speech') {
        setErr(t('chat.voice.noSpeech'))
      } else if (code === 'unsupported') {
        setErr(t('chat.voice.unsupported'))
      }
    },
  })

  useEffect(() => {
    if (isSignedIn) setErr(null)
  }, [isSignedIn])

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_SPEAK_KEY, autoSpeak ? '1' : '0')
    } catch {
      /* quota / private mode */
    }
  }, [autoSpeak])

  function toggleMic() {
    if (voice.listening) {
      voice.stopListening()
      return
    }
    if (!voice.recognitionSupported) {
      setErr(t('chat.voice.unsupported'))
      return
    }
    setErr(null)
    inputBeforeMicRef.current = input
    voice.startListening()
  }

  async function send() {
    const text = input.trim()
    if (!text || pending) return
    if (!isSignedIn) {
      setErr(t('chat.signInRequired'))
      return
    }
    setErr(null)
    if (voice.listening) voice.stopListening()
    if (voice.speaking) voice.cancelSpeak()
    inputBeforeMicRef.current = ''
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setPending(true)
    const slim = next.slice(-MAX_MSGS)
    try {
      const token = (await getToken()) || (await getToken({ skipCache: true }))
      if (!token) {
        setMessages((prev) => prev.slice(0, -1))
        setInput(text)
        setErr(t('chat.tokenWait'))
        setPending(false)
        return
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ messages: slim, language: lang }),
      })
      const body = await parseJson<ChatApiResponse>(res)
      if (res.status === 401) {
        setMessages((prev) => prev.slice(0, -1))
        setInput(text)
        setErr(t('chat.sessionNotVerified'))
        return
      }
      if (res.status === 429) {
        setMessages((prev) => prev.slice(0, -1))
        setInput(text)
        setErr(body.reply || t('chat.rateLimited'))
        return
      }
      if (body.error === 'content_policy' && body.reply) {
        const c = String(body.reply)
        setMessages((prev) => [...prev, { role: 'assistant', content: c }])
        if (autoSpeak && voice.ttsSupported) voice.speak(c)
        return
      }
      const out = body.reply
      if (!res.ok || out == null || out === '') {
        setMessages((prev) => prev.slice(0, -1))
        setInput(text)
        setErr(t('chat.error'))
        return
      }
      const reply = String(out)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      if (autoSpeak && voice.ttsSupported) voice.speak(reply)
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setInput(text)
      setErr(t('chat.error'))
    } finally {
      setPending(false)
    }
  }

  if (!isLoaded) {
    return <div className="rounded-2xl border border-ds-border p-6 text-sm text-ink-faint">…</div>
  }

  return (
    <div
      className={`flex h-[min(28rem,70vh)] flex-col rounded-2xl border border-ds-border bg-void-2/30 shadow-sm ${embedded ? 'border-0 bg-transparent shadow-none' : ''}`}
    >
      {embedded ? null : (
        <div className="border-b border-ds-border px-4 py-2">
          <p className="text-sm font-semibold text-ink">{t('chat.title')}</p>
          {!isSignedIn ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-amber-200/90">{t('chat.signInRequired')}</span>
              <SignInButton mode="modal">
                <button type="button" className="ds-btn-primary rounded-md px-2 py-1 text-xs">
                  {t('auth.signIn')}
                </button>
              </SignInButton>
            </div>
          ) : null}
        </div>
      )}
      {embedded && !isSignedIn && isLoaded ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-950/35 px-3 py-2 text-xs text-amber-50">
          <span>{t('chat.signInRequired')}</span>
          <SignInButton mode="modal">
            <button type="button" className="ds-btn-primary rounded-md px-2 py-1 text-xs">
              {t('auth.signIn')}
            </button>
          </SignInButton>
        </div>
      ) : null}
      {voice.ttsSupported ? (
        <div className="flex items-center justify-end border-b border-ds-border px-3 py-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-faint">
            <input
              type="checkbox"
              className="h-3 w-3 accent-indigo-cta"
              checked={autoSpeak}
              onChange={(e) => {
                const on = e.target.checked
                setAutoSpeak(on)
                if (!on) voice.cancelSpeak()
              }}
            />
            <span>{t('chat.voice.autoSpeak')}</span>
          </label>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.map((m, i) => {
          const isAssistant = m.role === 'assistant'
          return (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-6 rounded-xl border border-indigo-cta/30 bg-indigo-cta/15 px-3 py-2 text-ink'
                  : 'mr-6 rounded-xl border border-ds-border bg-void-2/50 px-3 py-2 text-ink/95'
              }
            >
              <div>{m.content}</div>
              {isAssistant && voice.ttsSupported ? (
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => (voice.speaking ? voice.cancelSpeak() : voice.speak(m.content))}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-faint transition hover:bg-surface-ds hover:text-ink"
                    aria-label={voice.speaking ? t('chat.voice.stopSpeak') : t('chat.voice.speak')}
                    title={voice.speaking ? t('chat.voice.stopSpeak') : t('chat.voice.speak')}
                  >
                    {voice.speaking ? '◼ ' : '▶ '}
                    {voice.speaking ? t('chat.voice.stopSpeak') : t('chat.voice.speak')}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
        {pending ? <p className="text-xs text-ink-faint">{t('chat.thinking')}</p> : null}
        {voice.listening ? <p className="text-xs text-indigo-cta-bright">{t('chat.voice.listening')}</p> : null}
        {err ? <p className="text-xs text-red-300">{err}</p> : null}
      </div>
      <form
        className="border-t border-ds-border p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="ds-input min-w-0 flex-1 rounded-lg disabled:opacity-50"
            maxLength={2000}
            autoComplete="off"
            disabled={!isSignedIn || pending}
          />
          {voice.recognitionSupported ? (
            <button
              type="button"
              onClick={toggleMic}
              disabled={!isSignedIn || pending}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? t('chat.voice.micStop') : t('chat.voice.micStart')}
              title={voice.listening ? t('chat.voice.micStop') : t('chat.voice.micStart')}
              className={
                voice.listening
                  ? 'rounded-lg border border-red-400/50 bg-red-500/15 px-3 py-2 text-sm text-red-100 transition disabled:opacity-50'
                  : 'rounded-lg border border-ds-border bg-void-2/60 px-3 py-2 text-sm text-ink-muted transition hover:border-ds-border-hover hover:text-ink disabled:opacity-50'
              }
            >
              <MicIcon className="h-4 w-4" listening={voice.listening} />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending || !isSignedIn}
            className="ds-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {t('chat.send')}
          </button>
        </div>
      </form>
    </div>
  )
}

function MicIcon({ className, listening }: { className?: string; listening?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={listening ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </svg>
  )
}
