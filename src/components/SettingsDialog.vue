<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, type Locale } from '../i18n'
import { useDarkMode, type ThemeMode } from '../composables/useDarkMode'

const props = defineProps<{
  visible: boolean
  pageSize: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:pageSize', value: number): void
}>()

const { t, locale } = useI18n()
const { themeMode, setThemeMode } = useDarkMode()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

function handleLocaleChange(lang: Locale) {
  locale.value = lang
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function handlePageSizeChange(size: number) {
  emit('update:pageSize', size)
  try {
    localStorage.setItem('app-array-page-size', String(size))
  } catch { /* ignore */ }
}

function handleCustomPageSize(event: Event) {
  const input = event.target as HTMLInputElement
  const n = parseInt(input.value, 10)
  if (n >= 1 && n <= 500) {
    handlePageSizeChange(n)
  }
}

function handleThemeModeChange(mode: ThemeMode) {
  setThemeMode(mode)
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('settings')"
    width="480px"
    :close-on-click-modal="true"
    destroy-on-close
  >
    <div class="settings-body">
      <p class="settings-desc">{{ t('settingsDesc') }}</p>

      <div class="settings-section">
        <h3 class="settings-section-title">{{ t('general') }}</h3>

        <div class="settings-row">
          <span class="settings-label">{{ t('language') }}</span>
          <div class="settings-control">
            <button
              class="lang-button"
              :class="{ active: locale === 'en' }"
              type="button"
              @click="handleLocaleChange('en')"
            >
              {{ t('languageEn') }}
            </button>
            <button
              class="lang-button"
              :class="{ active: locale === 'zh' }"
              type="button"
              @click="handleLocaleChange('zh')"
            >
              {{ t('languageZh') }}
            </button>
          </div>
        </div>

        <div class="settings-row">
          <span class="settings-label">{{ t('pageSizeLabel') }}</span>
          <div class="settings-control">
            <button
              v-for="size in PAGE_SIZE_OPTIONS"
              :key="size"
              class="lang-button"
              :class="{ active: pageSize === size }"
              type="button"
              @click="handlePageSizeChange(size)"
            >
              {{ size }}
            </button>
            <input
              class="page-size-input"
              type="number"
              min="1"
              max="500"
              :value="pageSize"
              :placeholder="t('pageSizeCustom')"
              @change="handleCustomPageSize"
            />
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">{{ t('appearance') }}</h3>

        <div class="settings-row">
          <span class="settings-label">{{ t('themeMode') }}</span>
          <div class="settings-control">
            <button
              class="lang-button theme-btn"
              :class="{ active: themeMode === 'light' }"
              type="button"
              @click="handleThemeModeChange('light')"
            >
              ☀️ {{ t('themeLight') }}
            </button>
            <button
              class="lang-button theme-btn"
              :class="{ active: themeMode === 'dark' }"
              type="button"
              @click="handleThemeModeChange('dark')"
            >
              🌙 {{ t('themeDark') }}
            </button>
            <button
              class="lang-button theme-btn"
              :class="{ active: themeMode === 'system' }"
              type="button"
              @click="handleThemeModeChange('system')"
            >
              💻 {{ t('themeSystem') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.settings-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary, #64748b);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary, #1e293b);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-primary, #e2e8f0);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #334155);
}

.settings-control {
  display: flex;
  gap: 6px;
}

.lang-button {
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--border-primary, #e2e8f0);
  background: var(--bg-secondary, #ffffff);
  color: var(--text-tertiary, #475569);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-button:hover {
  border-color: #93c5fd;
  background: var(--accent-blue-bg, #eff6ff);
  color: var(--accent-blue, #2563eb);
}

.lang-button.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
}

.page-size-input {
  width: 64px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-primary, #e2e8f0);
  font-size: 13px;
  color: var(--text-primary, #0f172a);
  background: var(--bg-secondary, #ffffff);
  text-align: center;
  transition: border-color 0.2s ease;
}

.page-size-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Hide number input spinners */
.page-size-input::-webkit-inner-spin-button,
.page-size-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
