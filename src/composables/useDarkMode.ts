import { ref, watch, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'app-theme-mode'

function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // ignore
  }
  return 'system'
}

function getSystemDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

const themeMode = ref<ThemeMode>(loadThemeMode())
const systemIsDark = ref(getSystemDark())

// Listen to system theme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', (e) => {
    systemIsDark.value = e.matches
    applyTheme()
  })
}

const isDark = computed(() => {
  if (themeMode.value === 'system') return systemIsDark.value
  return themeMode.value === 'dark'
})

function applyTheme() {
  const dark = isDark.value
  document.documentElement.classList.toggle('dark', dark)
  // Also set Element Plus dark mode
  document.documentElement.classList.toggle('el-dark', dark)
}

function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // ignore
  }
  applyTheme()
}

// Watch for reactive changes
watch(isDark, () => {
  applyTheme()
}, { immediate: true })

export function useDarkMode() {
  return {
    themeMode,
    isDark,
    setThemeMode,
  }
}
