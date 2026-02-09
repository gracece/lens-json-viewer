<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import JsonViewerEnhanced from './components/JsonViewerEnhanced.vue'
import TableExtractor from './components/TableExtractor.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { useI18n } from './i18n'
import { useDarkMode } from './composables/useDarkMode'

const { t } = useI18n()
const { isDark } = useDarkMode()
const viewerTheme = computed(() => isDark.value ? 'dark' : 'light')

type JsonValue = Record<string, unknown> | unknown[]

type LoadedFile = {
  path: string
  content?: string
  jsonlEntries?: unknown[]
  isJsonl?: boolean
}

const filePath = ref('')
const parseError = ref('')
const parsedValue = ref<JsonValue | null>(null)
const isDragOver = ref(false)
const isLoading = ref(false)
const isParsing = ref(false)
const isJsonlFile = ref(false)
const loadingMessage = ref('')
const rawFileSize = ref(0)
const isArrayPagination = ref(false)
const arrayDisplayCount = ref(0)
const ARRAY_PAGE_SIZE_KEY = 'app-array-page-size'
function loadArrayPageSize(): number {
  try {
    const stored = localStorage.getItem(ARRAY_PAGE_SIZE_KEY)
    if (stored) {
      const n = parseInt(stored, 10)
      if (n >= 1 && n <= 500) return n
    }
  } catch { /* ignore */ }
  return 10
}
const arrayPageSize = ref(loadArrayPageSize())
const isLoadingMore = ref(false)
const hasLoadedOnce = ref(false)
const searchQuery = ref('')
const searchResults = ref<number[]>([])
const isSearchActive = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const showTableExtractor = ref(false)
const showSettings = ref(false)

// Find-in-page state
const findQuery = ref('')
const findVisible = ref(false)
const findActiveMatch = ref(0)
const findTotalMatches = ref(0)
const findInputRef = ref<HTMLInputElement | null>(null)
const lastSearchedQuery = ref('')

const isBusy = computed(() => isLoading.value || isParsing.value)
const fileSizeLabel = computed(() => {
  const size = rawFileSize.value
  if (size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
})
const rawArrayTotalCount = computed(() => Array.isArray(parsedValue.value) ? parsedValue.value.length : 0)
const arrayTotalCount = computed(() => isSearchActive.value ? searchResults.value.length : rawArrayTotalCount.value)
const arrayHasMore = computed(() => isArrayPagination.value && arrayDisplayCount.value < arrayTotalCount.value)
const fileName = computed(() => {
  if (!filePath.value) return ''
  const normalized = filePath.value.replace(/\\/g, '/')
  const segments = normalized.split('/')
  return segments[segments.length - 1] || normalized
})
const displayValue = computed(() => {
  if (!isArrayPagination.value) return parsedValue.value
  const arrayValue = parsedValue.value
  if (!Array.isArray(arrayValue)) return parsedValue.value
  if (isSearchActive.value) {
    const slice = searchResults.value.slice(0, arrayDisplayCount.value)
    return slice.map((index) => arrayValue[index]).filter((item) => item !== undefined)
  }
  return arrayValue.slice(0, arrayDisplayCount.value)
})
const viewerExpandDepth = computed(() => 5)

function isJsonFile(path: string) {
  const lower = path.toLowerCase()
  return lower.endsWith('.json') || lower.endsWith('.jsonl')
}

function isArrayOfObjects(value: JsonValue | null) {
  if (!Array.isArray(value) || value.length === 0) return false
  const sampleSize = Math.min(value.length, 50)
  for (let index = 0; index < sampleSize; index++) {
    const item = value[index]
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false
    }
  }
  return true
}

function handleDroppedPaths(paths: string[]) {
  const targetPath = paths.find((candidate) => isJsonFile(candidate))
  if (!targetPath) {
    ElMessage.warning(t('onlyJsonSupported'))
    return
  }

  isLoading.value = true
  loadingMessage.value = t('readingFile')
  window.ipcRenderer.invoke('read-json-file', targetPath)
    .then((payload: LoadedFile) => {
      loadFile(payload)
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : t('unableToReadFile')
      ElMessage.error(message)
    })
    .finally(() => {
      isLoading.value = false
      isDragOver.value = false
    })
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files ?? []) as Array<File & { path?: string }>
  const paths = files.map((file) => file.path).filter((path): path is string => Boolean(path))
  handleDroppedPaths(paths)
}

function handleClickOpen() {
  isLoading.value = true
  loadingMessage.value = t('readingFile')
  window.ipcRenderer.invoke('select-json-file')
    .then((payload: LoadedFile | null) => {
      if (!payload) return
      loadFile(payload)
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : t('unableToReadFile')
      ElMessage.error(message)
    })
    .finally(() => {
      isLoading.value = false
      isDragOver.value = false
    })
}

function parseJsonContent(content: string) {
  const workerSource = `
    self.onmessage = (event) => {
      const { content } = event.data;
      try {
        const parsed = JSON.parse(content);
        self.postMessage({ ok: true, value: parsed });
      } catch (error) {
        const message = error && error.message ? error.message : 'Failed to parse file';
        self.postMessage({ ok: false, error: message });
      }
    };
  `

  return new Promise<JsonValue>((resolve, reject) => {
    const blob = new Blob([workerSource], { type: 'text/javascript' })
    const workerUrl = URL.createObjectURL(blob)
    const worker = new Worker(workerUrl)

    const cleanup = () => {
      worker.terminate()
      URL.revokeObjectURL(workerUrl)
    }

    worker.onmessage = (event) => {
      const { ok, value, error } = event.data || {}
      cleanup()
      if (ok) {
        resolve(value as JsonValue)
      } else {
        reject(new Error(error || 'Failed to parse file'))
      }
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'Worker failed to parse file'))
    }

    worker.postMessage({ content })
  })
}

function setupArrayPagination(value: JsonValue | null) {
  if (!value || !Array.isArray(value)) {
    isArrayPagination.value = false
    arrayDisplayCount.value = 0
    return
  }

  const shouldPaginate = isJsonlFile.value || isArrayOfObjects(value)
  isArrayPagination.value = shouldPaginate
  if (shouldPaginate) {
  arrayDisplayCount.value = Math.min(arrayPageSize.value, value.length)
    } else {
      arrayDisplayCount.value = 0
    }
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSearchArray()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClearSearch()
  }
}

function handleRetryOpen() {
  parseError.value = ''
  parsedValue.value = null
  handleClickOpen()
}

function handleSearchArray() {
  if (!Array.isArray(parsedValue.value)) return

  const keyword = searchQuery.value.trim()
  if (!keyword) {
    searchResults.value = []
    isSearchActive.value = false
    arrayDisplayCount.value = Math.min(arrayPageSize.value, rawArrayTotalCount.value)
    return
  }

  const lowered = keyword.toLowerCase()
  const matches: number[] = []

  parsedValue.value.forEach((item, index) => {
    let content = ''
    try {
      content = JSON.stringify(item)
    } catch {
      content = String(item)
    }
    if (content.toLowerCase().includes(lowered)) {
      matches.push(index)
    }
  })

  searchResults.value = matches
  isSearchActive.value = true
  arrayDisplayCount.value = Math.min(arrayPageSize.value, matches.length)
}

function handleClearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  isSearchActive.value = false
    arrayDisplayCount.value = Math.min(arrayPageSize.value, rawArrayTotalCount.value)
}

function handleLoadMoreArray() {
  if (!arrayHasMore.value || isLoadingMore.value) return

  isLoadingMore.value = true
  try {
    arrayDisplayCount.value = Math.min(arrayDisplayCount.value + arrayPageSize.value, arrayTotalCount.value)
  } finally {
    isLoadingMore.value = false
  }
}

function handleLoadAllArray() {
  if (!arrayHasMore.value || isLoadingMore.value) return

  isLoadingMore.value = true
  try {
    arrayDisplayCount.value = arrayTotalCount.value
  } finally {
    isLoadingMore.value = false
  }
}

async function loadFile({ path, content, jsonlEntries, isJsonl }: LoadedFile) {
  filePath.value = path
  const fileContent = content ?? ''
  parseError.value = ''
  parsedValue.value = null
  isParsing.value = true
  isJsonlFile.value = isJsonl ?? path.toLowerCase().endsWith('.jsonl')
  isArrayPagination.value = false
  arrayDisplayCount.value = 0
  searchQuery.value = ''
  searchResults.value = []
  isSearchActive.value = false
  rawFileSize.value = (content ?? '').length + (jsonlEntries ? JSON.stringify(jsonlEntries).length : 0)
  loadingMessage.value = t('parsingJson')

  try {
    if (isJsonlFile.value) {
      if (!jsonlEntries) {
        throw new Error(t('jsonlUnavailable'))
      }
      parsedValue.value = jsonlEntries as JsonValue
    } else {
      parsedValue.value = await parseJsonContent(fileContent)
    }
    setupArrayPagination(parsedValue.value)
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : t('failedToParse')
    ElMessage.error(t('failedToParseJson'))
  } finally {
    isParsing.value = false
    hasLoadedOnce.value = true
  }
}

const hasData = computed(() => parsedValue.value !== null)
const findCounterText = computed(() => {
  if (!findQuery.value.trim()) return ''
  return `${findActiveMatch.value} / ${findTotalMatches.value}`
})

// Find-in-page functions
function handleFindStart() {
  const query = findQuery.value.trim()
  if (!query) {
    window.ipcRenderer.invoke('stop-find-in-page', 'clearSelection')
    findActiveMatch.value = 0
    findTotalMatches.value = 0
    lastSearchedQuery.value = ''
    return
  }
  lastSearchedQuery.value = query
  window.ipcRenderer.invoke('find-in-page', query)
}

function handleFindNext() {
  const query = findQuery.value.trim()
  if (!query) return
  if (query !== lastSearchedQuery.value) {
    handleFindStart()
  } else {
    window.ipcRenderer.invoke('find-in-page', query, { forward: true, findNext: true })
  }
}

function handleFindPrev() {
  const query = findQuery.value.trim()
  if (!query) return
  if (query !== lastSearchedQuery.value) {
    handleFindStart()
  } else {
    window.ipcRenderer.invoke('find-in-page', query, { forward: false, findNext: true })
  }
}

function handleFindAction(shiftKey: boolean) {
  const query = findQuery.value.trim()
  if (!query) {
    handleFindStart() // Will clear search
    return
  }

  if (query !== lastSearchedQuery.value || findTotalMatches.value === 0) {
    // Query changed or no previous matches — start fresh
    handleFindStart()
  } else if (shiftKey) {
    // Same query + Shift — previous match
    handleFindPrev()
  } else {
    // Same query — next match
    handleFindNext()
  }
}

function handleFindKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    handleFindAction(event.shiftKey)
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    handleCloseFindBar()
  }
}

function handleOpenFindBar() {
  findVisible.value = true
  nextTick(() => {
    findInputRef.value?.focus()
    findInputRef.value?.select()
  })
}

function handleCloseFindBar() {
  findVisible.value = false
  findQuery.value = ''
  findActiveMatch.value = 0
  findTotalMatches.value = 0
  lastSearchedQuery.value = ''
  window.ipcRenderer.invoke('stop-find-in-page', 'clearSelection')
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
    event.preventDefault()
    handleOpenFindBar()
    return
  }

  if (!findVisible.value) return

  const target = event.target as HTMLElement | null
  const isEditable = Boolean(
    target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
  )

  if (isEditable) return

  if (event.key === 'Enter') {
    event.preventDefault()
    handleFindAction(event.shiftKey)
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCloseFindBar()
  }
}

onMounted(() => {
  window.ipcRenderer.on('file-opened', (_event, payload: LoadedFile) => {
    loadFile(payload)
  })

  window.ipcRenderer.on('trigger-search', () => {
    handleOpenFindBar()
  })

  window.ipcRenderer.on('find-in-page-result', (_event, result: { activeMatchOrdinal: number; matches: number }) => {
    findActiveMatch.value = result.activeMatchOrdinal
    findTotalMatches.value = result.matches
  })

  window.addEventListener('dragover', handleDragOver)
  window.addEventListener('dragleave', handleDragLeave)
  window.addEventListener('drop', handleDrop)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('dragover', handleDragOver)
  window.removeEventListener('dragleave', handleDragLeave)
  window.removeEventListener('drop', handleDrop)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="app-shell">
    <!-- Loading Overlay -->
    <Transition name="fade">
      <div v-if="isBusy" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">{{ loadingMessage }}</p>
        </div>
      </div>
    </Transition>

    <header class="app-header">
      <div class="title-block">
        <h1>{{ t('appTitle') }}</h1>
        <span v-if="!hasLoadedOnce" class="title-hint">{{ t('titleHint') }}</span>
      </div>
      <div class="header-tools">
        <div class="header-find" v-if="findVisible">
          <input
            ref="findInputRef"
            v-model="findQuery"
            class="find-input"
            type="text"
            :placeholder="t('findPlaceholder')"
            @keydown="handleFindKeydown"
          />
          <span v-if="findQuery.trim()" class="find-counter">{{ findCounterText }}</span>
          <button class="find-button" type="button" :title="t('findPrevTitle')" @click="handleFindPrev" :disabled="!findQuery.trim()">▲</button>
          <button class="find-button" type="button" :title="t('findNextTitle')" @click="handleFindNext" :disabled="!findQuery.trim()">▼</button>
          <button class="find-close" type="button" :title="t('findCloseTitle')" @click="handleCloseFindBar">✕</button>
        </div>
        <div class="file-meta" v-if="filePath">
          <span class="file-path" :title="filePath">{{ fileName }}</span>
          <span v-if="fileSizeLabel" class="file-size-badge">{{ fileSizeLabel }}</span>
          <span v-if="rawArrayTotalCount > 0" class="file-count-badge">{{ rawArrayTotalCount }} {{ t('items') }}</span>
        </div>
      </div>
      <button class="settings-button" type="button" :title="t('settings')" @click="showSettings = true">⚙️</button>
    </header>

    <!-- Settings Dialog -->
    <SettingsDialog v-model:visible="showSettings" v-model:pageSize="arrayPageSize" />

    <main class="app-content">
      <div v-if="parseError" class="error-card">
        <div class="error-icon">⚠️</div>
        <h2>{{ t('failedToParse') }}</h2>
        <pre>{{ parseError }}</pre>
        <button class="retry-button" type="button" @click="handleRetryOpen">{{ t('openAnotherFile') }}</button>
      </div>

      <template v-else-if="hasData">
        <div class="viewer-card">
          <JsonViewerEnhanced
            :value="displayValue"
            :boxed="true"
            :copyable="true"
            :expandDepth="viewerExpandDepth"
            :theme="viewerTheme"
          />
          <div v-if="isArrayPagination" class="array-controls">
            <div class="array-left">
              <span class="array-meta-text">
                {{ arrayDisplayCount }} / {{ arrayTotalCount }}
                <template v-if="isSearchActive && arrayTotalCount === 0"> · {{ t('noMatches') }}</template>
                <template v-else-if="isSearchActive"> · {{ t('matches') }}: {{ arrayTotalCount }} / {{ rawArrayTotalCount }}</template>
                <template v-else-if="!arrayHasMore"> · {{ t('allItemsLoaded') }}</template>
              </span>
              <button
                v-show="arrayHasMore"
                class="ctrl-button"
                type="button"
                :disabled="isLoadingMore || isParsing"
                @click="handleLoadMoreArray"
              >
                {{ isLoadingMore ? t('loadingEllipsis') : t('loadMore') + ' (' + arrayPageSize + ')' }}
              </button>
              <button
                v-show="arrayHasMore"
                class="ctrl-button"
                type="button"
                :disabled="isLoadingMore || isParsing"
                @click="handleLoadAllArray"
              >
                {{ t('loadAll') }}
              </button>
            </div>
            <div class="array-right">
              <div class="header-search">
                <input
                  v-model="searchQuery"
                  class="search-input"
                  type="text"
                  :placeholder="t('searchInItems')"
                  :disabled="isParsing"
                  ref="searchInputRef"
                  @keydown="handleSearchKeydown"
                />
                <button
                  class="ctrl-button"
                  type="button"
                  :disabled="isParsing"
                  @click="handleSearchArray"
                >
                  {{ t('search') }}
                </button>
                <button
                  v-show="isSearchActive"
                  class="ctrl-button"
                  type="button"
                  :disabled="isParsing"
                  @click="handleClearSearch"
                >
                  {{ t('clear') }}
                </button>
              </div>
              <button
                class="ctrl-button"
                type="button"
                @click="showTableExtractor = true"
              >
                {{ t('tableExtract') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Table Extractor Dialog -->
        <TableExtractor
          v-if="isArrayPagination && Array.isArray(parsedValue)"
          v-model:visible="showTableExtractor"
          :data="(parsedValue as unknown[])"
        />
      </template>

      <div v-else class="empty-state" :class="{ 'is-dragover': isDragOver }" @click="handleClickOpen">
        <div class="empty-icon">{{ isDragOver ? '📂' : '📄' }}</div>
        <p class="empty-title">{{ isDragOver ? t('emptyTitleDragOver') : t('emptyTitle') }}</p>
        <span class="empty-hint">{{ t('emptyHint') }}</span>
        <button class="open-button" type="button">{{ t('chooseFile') }}</button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: var(--shadow-md);
  flex-wrap: nowrap;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.title-block h1 {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.title-hint {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.title-block p {
  margin: 0;
  color: var(--text-tertiary);
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 420px;
}

.file-size-badge,
.file-count-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.file-size-badge {
  background: var(--accent-blue-bg);
  color: var(--accent-blue);
  border: 1px solid var(--accent-blue-border);
}

.file-count-badge {
  background: var(--accent-green-bg);
  color: var(--accent-green-text);
  border: 1px solid var(--accent-green-border);
}

.settings-button {
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;
  flex-shrink: 0;
}

.settings-button:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-accent);
  transform: rotate(45deg);
}

.header-tools {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-find {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.find-input {
  min-width: 160px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--text-primary);
}

.find-counter {
  font-size: 11px;
  color: var(--text-tertiary);
  min-width: 48px;
  text-align: center;
}

.find-button,
.find-close {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.find-button:hover:not(:disabled),
.find-close:hover:not(:disabled) {
  background: var(--accent-blue-bg);
  border-color: var(--border-accent);
}

.find-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-search {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.tool-button {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-button.primary {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.2);
}

.tool-button.primary:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.tool-button.ghost {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-color: var(--border-primary);
}

.tool-button.ghost:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-accent);
}

.tool-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.file-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}

.file-path {
  display: inline;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  word-break: break-all;
}

.app-content {
  flex: 1;
  padding: 0;
}

.viewer-card {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  transition: background-color 0.3s ease;
}

.array-controls {
  margin-top: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  position: sticky;
  bottom: 0;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-up);
  z-index: 5;
  height: 56px;
  flex-wrap: nowrap;
  box-sizing: border-box;
  transition: background-color 0.3s ease;
}

.array-left {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.array-meta-text {
  color: var(--text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.array-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
}

.search-input {
  min-width: 170px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-primary);
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.search-input:disabled {
  background: var(--bg-tertiary);
}

/* Unified small control button */
.ctrl-button {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}

.ctrl-button:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-secondary);
}

.ctrl-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.error-card {
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  color: var(--error-text);
  padding: 32px 24px;
  border-radius: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.error-icon {
  font-size: 36px;
  line-height: 1;
}

.error-card h2 {
  margin: 0;
  font-size: 16px;
}

.error-card pre {
  white-space: pre-wrap;
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--error-text-secondary);
  background: var(--error-code-bg);
  padding: 8px 12px;
  border-radius: 6px;
  max-width: 100%;
  overflow-x: auto;
}

.retry-button {
  margin-top: 8px;
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid var(--error-retry-border);
  background: var(--bg-secondary);
  color: var(--error-text);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: var(--error-retry-hover-bg);
  border-color: var(--error-retry-hover-border);
  transform: translateY(-1px);
}

.empty-state {
  text-align: center;
  margin: 10px;
  padding: 80px 20px;
  border: 2px dashed var(--empty-border);
  border-radius: 16px;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.empty-state:hover {
  border-color: var(--empty-hover-border);
  background: var(--bg-hover);
}

.empty-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 4px;
  transition: transform 0.3s ease;
}

.empty-state:hover .empty-icon,
.empty-state.is-dragover .empty-icon {
  transform: scale(1.15);
}

.empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-hint {
  display: inline-block;
  font-size: 13px;
  color: var(--text-muted);
}

.empty-state.is-dragover {
  border-color: var(--accent-blue);
  background: var(--accent-blue-bg);
  color: var(--accent-blue-hover);
  transform: scale(1.01);
}

.empty-state.is-dragover .empty-title {
  color: var(--accent-blue-hover);
}

.empty-state.is-dragover .empty-hint {
  color: var(--accent-blue);
}

.open-button {
  margin-top: 4px;
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: var(--accent-blue);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.open-button:hover {
  background: var(--accent-blue-hover);
  transform: translateY(-1px);
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--loading-overlay);
  backdrop-filter: blur(4px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.01em;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
