<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  data: unknown[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

// Step state: 'fields' for input, 'table' for result display
const step = ref<'fields' | 'table'>('fields')
const fieldInput = ref('')
const parsedFields = ref<string[]>([])
const tableData = ref<Record<string, unknown>[]>([])

// Pagination for preview
const PAGE_SIZE = 50
const currentPage = ref(1)
const totalRows = ref(0)
const isExporting = ref(false)

// Preset management
const presetName = ref('')
const presets = ref<Record<string, string>>(loadPresets())

function loadPresets(): Record<string, string> {
  try {
    const raw = localStorage.getItem('table-extractor-presets')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePresetsToStorage() {
  localStorage.setItem('table-extractor-presets', JSON.stringify(presets.value))
}

function handleSavePreset() {
  const name = presetName.value.trim()
  if (!name || !fieldInput.value.trim()) return
  presets.value[name] = fieldInput.value.trim()
  savePresetsToStorage()
  presetName.value = ''
}

function handleLoadPreset(name: string) {
  const value = presets.value[name]
  if (value) fieldInput.value = value
}

function handleDeletePreset(name: string) {
  delete presets.value[name]
  savePresetsToStorage()
}

const presetNames = computed(() => Object.keys(presets.value))

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

// Auto-detect available fields from data (first 20 items sample)
const detectedFields = computed(() => {
  if (!props.data || props.data.length === 0) return []
  const fieldSet = new Set<string>()
  const sample = props.data.slice(0, 20)
  for (const item of sample) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      collectPaths(item as Record<string, unknown>, '', fieldSet, 3)
    }
  }
  return Array.from(fieldSet).sort()
})

function collectPaths(
  obj: Record<string, unknown>,
  prefix: string,
  result: Set<string>,
  maxDepth: number,
) {
  if (maxDepth <= 0) return
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (Array.isArray(value)) {
      // Show the array field itself
      result.add(path)
      // Also peek into first element if it's an object
      if (value.length > 0 && value[0] && typeof value[0] === 'object' && !Array.isArray(value[0])) {
        collectPaths(value[0] as Record<string, unknown>, `${path}[0]`, result, maxDepth - 1)
      }
    } else if (value && typeof value === 'object') {
      // Add both the parent path and recurse into children
      result.add(path)
      collectPaths(value as Record<string, unknown>, path, result, maxDepth - 1)
    } else {
      result.add(path)
    }
  }
}

// Parse a path segment, supporting array index like "data[0]" or "items[2]"
// Returns an array of access steps, e.g. "data[0]" => ["data", 0]
function parsePathSegment(segment: string): (string | number)[] {
  const steps: (string | number)[] = []
  const regex = /^([^\[]*)((?:\[\d+\])*)$/
  const match = segment.match(regex)
  if (!match) {
    steps.push(segment)
    return steps
  }
  const key = match[1]
  const indices = match[2]
  if (key) steps.push(key)
  if (indices) {
    const indexMatches = indices.matchAll(/\[(\d+)\]/g)
    for (const m of indexMatches) {
      steps.push(parseInt(m[1], 10))
    }
  }
  return steps
}

// Resolve a path on an object, supporting dot notation and array indices
// e.g. "data[0].name", "items[1].tags[0]", "user.name"
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    const steps = parsePathSegment(part)
    for (const step of steps) {
      if (current === null || current === undefined) return undefined
      if (typeof step === 'number') {
        if (!Array.isArray(current)) return undefined
        current = current[step]
      } else {
        if (typeof current !== 'object') return undefined
        current = (current as Record<string, unknown>)[step]
      }
    }
  }
  return current
}

function formatCellValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

// Extract only a single page of data for preview
function extractPage(fields: string[], page: number): Record<string, unknown>[] {
  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, props.data.length)
  const rows: Record<string, unknown>[] = []
  for (let i = start; i < end; i++) {
    const item = props.data[i]
    const row: Record<string, unknown> = {}
    for (const field of fields) {
      row[field] = getNestedValue(item, field)
    }
    rows.push(row)
  }
  return rows
}

function handleExtract() {
  const raw = fieldInput.value.trim()
  if (!raw) return

  // Parse fields: comma or newline separated
  const fields = raw
    .split(/[,\n]/)
    .map((f) => f.trim())
    .filter(Boolean)

  parsedFields.value = fields
  totalRows.value = props.data.length
  currentPage.value = 1

  // Only extract first page for preview
  tableData.value = extractPage(fields, 1)
  step.value = 'table'
}

function handlePageChange(page: number) {
  currentPage.value = page
  tableData.value = extractPage(parsedFields.value, page)
}

function handleBack() {
  step.value = 'fields'
}

function handleClose() {
  dialogVisible.value = false
  // Reset state after close animation
  setTimeout(() => {
    step.value = 'fields'
    tableData.value = []
    parsedFields.value = []
    currentPage.value = 1
    totalRows.value = 0
  }, 300)
}

function handleAddField(field: string) {
  const current = fieldInput.value.trim()
  if (!current) {
    fieldInput.value = field
  } else {
    // Avoid duplicates
    const existing = current.split(/[,\n]/).map((f) => f.trim())
    if (!existing.includes(field)) {
      fieldInput.value = current + ', ' + field
    }
  }
}

// CSV export — generates from ALL raw data, not just the preview page
function handleExportCsv() {
  if (parsedFields.value.length === 0 || props.data.length === 0) return

  isExporting.value = true

  // Use requestAnimationFrame to let the UI update (show exporting state) before heavy work
  requestAnimationFrame(() => {
    try {
      const headers = parsedFields.value
      const lines: string[] = []

      // Header row
      lines.push(headers.map(escapeCsvField).join(','))

      // Data rows — iterate full raw data
      for (const item of props.data) {
        const cells = headers.map((field) =>
          escapeCsvField(formatCellValue(getNestedValue(item, field))),
        )
        lines.push(cells.join(','))
      }

      const csvContent = '\uFEFF' + lines.join('\n') // BOM for Excel UTF-8 compatibility
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `table-extract-${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      isExporting.value = false
    }
  })
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

// Reset step when dialog opens
watch(
  () => props.visible,
  (val) => {
    if (val) {
      step.value = 'fields'
      tableData.value = []
      parsedFields.value = []
      currentPage.value = 1
      totalRows.value = 0
    }
  },
)
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="step === 'fields' ? t('tableExtractorFieldsTitle') : t('tableExtractorPreviewTitle')"
    width="90%"
    top="5vh"
    :close-on-click-modal="false"
    destroy-on-close
    @close="handleClose"
  >
    <!-- Step 1: Field input -->
    <div v-if="step === 'fields'" class="extractor-fields">
      <p class="field-help">
        {{ t('fieldHelp') }}<br />
        <span v-html="t('fieldHelpDot')"></span>
      </p>

      <textarea
        v-model="fieldInput"
        class="field-textarea"
        :placeholder="t('fieldPlaceholder')"
        rows="4"
        spellcheck="false"
      ></textarea>

      <!-- Preset management -->
      <div class="preset-section">
        <div class="preset-save">
          <input
            v-model="presetName"
            class="preset-name-input"
            type="text"
            :placeholder="t('presetNamePlaceholder')"
            @keydown.enter="handleSavePreset"
          />
          <button
            class="preset-save-button"
            type="button"
            :disabled="!presetName.trim() || !fieldInput.trim()"
            @click="handleSavePreset"
          >
            {{ t('savePreset') }}
          </button>
        </div>
        <div v-if="presetNames.length > 0" class="preset-list">
          <span class="preset-label">{{ t('presets') }}</span>
          <div v-for="name in presetNames" :key="name" class="preset-chip">
            <span class="preset-chip-name" @click="handleLoadPreset(name)">{{ name }}</span>
            <button class="preset-chip-delete" type="button" @click="handleDeletePreset(name)">×</button>
          </div>
        </div>
      </div>

      <!-- Detected fields -->
      <div v-if="detectedFields.length > 0" class="detected-fields">
        <p class="detected-title">{{ t('detectedFields') }}</p>
        <div class="detected-chips">
          <button
            v-for="field in detectedFields"
            :key="field"
            class="field-chip"
            type="button"
            @click="handleAddField(field)"
          >
            {{ field }}
          </button>
        </div>
      </div>
    </div>

    <!-- Step 2: Table preview -->
    <div v-if="step === 'table'" class="extractor-table">
      <div class="table-toolbar">
        <span class="table-count">
          {{ t('showing') }} {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, totalRows) }}
          {{ t('of') }} {{ totalRows.toLocaleString() }} {{ t('rows') }} · {{ parsedFields.length }} {{ t('columns') }}
        </span>
        <button
          class="export-csv-button"
          type="button"
          :disabled="isExporting"
          @click="handleExportCsv"
        >
          {{ isExporting ? t('exporting') : t('exportAllAsCsv', { count: totalRows.toLocaleString() }) }}
        </button>
      </div>

      <div class="table-wrapper">
        <el-table :data="tableData" border stripe max-height="55vh" style="width: 100%">
          <el-table-column label="#" width="70" fixed>
            <template #default="{ $index }">
              {{ (currentPage - 1) * PAGE_SIZE + $index + 1 }}
            </template>
          </el-table-column>
          <el-table-column
            v-for="field in parsedFields"
            :key="field"
            :prop="field"
            :label="field"
            min-width="150"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatCellValue(row[field]) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="table-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="PAGE_SIZE"
          :total="totalRows"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button v-if="step === 'table'" class="footer-button ghost" type="button" @click="handleBack">
        {{ t('back') }}
        </button>
        <button v-if="step === 'fields'" class="footer-button primary" type="button" :disabled="!fieldInput.trim()" @click="handleExtract">
          {{ t('extractTable') }}
        </button>
        <button class="footer-button ghost" type="button" @click="handleClose">
          {{ t('close') }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.extractor-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-help {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary, #64748b);
  line-height: 1.6;
}

.field-help code {
  background: var(--bg-tertiary, #f1f5f9);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary, #0f172a);
}

.field-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-primary, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: var(--text-primary, #0f172a);
  background: var(--bg-secondary, #ffffff);
  resize: vertical;
  line-height: 1.6;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.preset-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-save {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preset-name-input {
  flex: 1;
  max-width: 200px;
  padding: 6px 12px;
  border: 1px solid var(--border-primary, #e2e8f0);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #0f172a);
  background: var(--bg-secondary, #ffffff);
}

.preset-name-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.preset-save-button {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border-primary, #e2e8f0);
  background: var(--bg-secondary, #ffffff);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary, #475569);
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-save-button:hover:not(:disabled) {
  background: var(--bg-tertiary, #f8fafc);
  border-color: var(--border-accent, #cbd5f5);
}

.preset-save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-list {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  font-weight: 600;
}

.preset-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--accent-blue-bg, #eff6ff);
  border: 1px solid var(--accent-blue-border, #bfdbfe);
  border-radius: 999px;
  padding: 2px 4px 2px 10px;
  font-size: 12px;
  color: var(--accent-blue, #2563eb);
}

.preset-chip-name {
  cursor: pointer;
  font-weight: 500;
}

.preset-chip-name:hover {
  text-decoration: underline;
}

.preset-chip-delete {
  border: none;
  background: none;
  color: #93c5fd;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
}

.preset-chip-delete:hover {
  color: #ef4444;
}

.detected-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detected-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary, #475569);
}

.detected-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.field-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-primary, #e2e8f0);
  background: var(--bg-tertiary, #f8fafc);
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--text-secondary, #334155);
  cursor: pointer;
  transition: all 0.2s ease;
}

.field-chip:hover {
  background: var(--accent-blue-bg, #eff6ff);
  border-color: var(--empty-hover-border, #93c5fd);
  color: var(--accent-blue-hover, #1d4ed8);
}

.extractor-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-count {
  font-size: 13px;
  color: var(--text-tertiary, #64748b);
  font-weight: 500;
}

.export-csv-button {
  padding: 8px 18px;
  border-radius: 999px;
  border: none;
  background: #10b981;
  color: #ffffff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.export-csv-button:hover {
  background: #059669;
  transform: translateY(-1px);
}

.table-wrapper {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.table-pagination {
  display: flex;
  justify-content: center;
  padding: 8px 0 0;
}

.export-csv-button:disabled {
  opacity: 0.7;
  cursor: wait;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.footer-button {
  padding: 8px 20px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.footer-button.primary {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

.footer-button.primary:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.footer-button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.footer-button.ghost {
  background: var(--bg-secondary, #ffffff);
  color: var(--text-secondary, #1e293b);
  border-color: var(--border-primary, #e2e8f0);
}

.footer-button.ghost:hover {
  background: var(--bg-tertiary, #f8fafc);
  border-color: var(--border-accent, #cbd5f5);
  transform: translateY(-1px);
}
</style>
