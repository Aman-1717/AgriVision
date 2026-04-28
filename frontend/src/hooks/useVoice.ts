import { useCallback, useEffect, useRef, useState } from 'react'

type Lang = 'en' | 'hi'

const BCP47: Record<Lang, string> = { en: 'en-US', hi: 'hi-IN' }

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export type UseVoiceOptions = {
  lang: Lang
  onTranscript?: (text: string, isFinal: boolean) => void
  onError?: (code: string) => void
}

export function useVoice({ lang, onTranscript, onError }: UseVoiceOptions) {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  }, [onTranscript, onError])

  const recognitionSupported = !!recognitionCtor()
  const ttsSupported = ttsAvailable()

  const stopListening = useCallback(() => {
    const r = recRef.current
    if (!r) return
    try {
      r.stop()
    } catch {
      /* no-op: already stopped */
    }
  }, [])

  const startListening = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      onErrorRef.current?.('unsupported')
      return
    }
    if (recRef.current) {
      try {
        recRef.current.abort()
      } catch {
        /* no-op */
      }
      recRef.current = null
    }
    const rec = new Ctor()
    rec.lang = BCP47[lang]
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onstart = () => setListening(true)
    rec.onend = () => {
      setListening(false)
      if (recRef.current === rec) recRef.current = null
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      onErrorRef.current?.(e.error || 'error')
      setListening(false)
    }
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let finalText = ''
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const r = ev.results[i]
        const alt = r[0]
        if (!alt) continue
        if (r.isFinal) finalText += alt.transcript
        else interim += alt.transcript
      }
      const text = (finalText || interim).trim()
      if (!text) return
      onTranscriptRef.current?.(text, !!finalText)
    }
    recRef.current = rec
    try {
      rec.start()
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : 'error')
      setListening(false)
      recRef.current = null
    }
  }, [lang])

  const cancelSpeak = useCallback(() => {
    if (!ttsSupported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [ttsSupported])

  const speak = useCallback(
    (text: string) => {
      const trimmed = (text || '').trim()
      if (!trimmed) return
      if (!ttsSupported) {
        onErrorRef.current?.('unsupported')
        return
      }
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(trimmed)
      utter.lang = BCP47[lang]
      utter.rate = 1
      utter.pitch = 1
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      const voices = window.speechSynthesis.getVoices()
      const match = voices.find((v) => v.lang?.toLowerCase().startsWith(BCP47[lang].toLowerCase()))
      if (match) utter.voice = match
      window.speechSynthesis.speak(utter)
    },
    [lang, ttsSupported],
  )

  // Cleanup on unmount: stop mic + cancel any in-flight TTS so it doesn't bleed into next page.
  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort()
      } catch {
        /* no-op */
      }
      recRef.current = null
      if (ttsAvailable()) window.speechSynthesis.cancel()
    }
  }, [])

  return {
    recognitionSupported,
    ttsSupported,
    listening,
    speaking,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  }
}
