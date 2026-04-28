import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/translation.json'
import hi from './locales/hi/translation.json'

const STORAGE_KEY = 'agrivision_i18nextLng'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
  })

function setHtmlLang(lng: string) {
  const base = lng.split('-')[0] ?? 'en'
  if (typeof document !== 'undefined') {
    document.documentElement.lang = base === 'hi' ? 'hi' : 'en'
  }
}

setHtmlLang(i18n.language)
i18n.on('languageChanged', setHtmlLang)

export default i18n
