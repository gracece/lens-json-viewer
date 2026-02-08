import { ref, computed } from 'vue'
import en from './locales/en'
import zh from './locales/zh'
import type { LocaleMessages } from './locales/en'

export type Locale = 'en' | 'zh'

const LOCALE_STORAGE_KEY = 'app-locale'

const messages: Record<Locale, LocaleMessages> = { en, zh }

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch {
    // ignore
  }
  // Auto-detect from system language
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('zh')) return 'zh'
  return 'en'
}

export const currentLocale = ref<Locale>(loadLocale())

export function setLocale(locale: Locale) {
  currentLocale.value = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // ignore
  }
  // Notify electron main process to rebuild menu
  try {
    window.ipcRenderer?.invoke('set-locale', locale)
  } catch {
    // ignore in non-electron env
  }
}

/**
 * Translation function. Supports simple interpolation via {key} placeholders.
 */
export function t(key: keyof LocaleMessages, params?: Record<string, string | number>): string {
  const msg = messages[currentLocale.value]?.[key] ?? messages.en[key] ?? key
  if (!params) return msg
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

/**
 * Vue composable for i18n
 */
export function useI18n() {
  const locale = computed({
    get: () => currentLocale.value,
    set: (val: Locale) => setLocale(val),
  })

  return {
    locale,
    t,
    setLocale,
  }
}
