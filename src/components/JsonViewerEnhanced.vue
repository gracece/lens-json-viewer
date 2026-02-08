<template>
  <div 
    class="json-viewer-enhanced" 
    :class="{ 
      'json-boxed': boxed, 
      [`json-theme-${theme}`]: true 
    }"
    ref="containerRef"
  >
    <div class="json-container">
      <div class="json-header" v-if="copyable">
        <div class="json-controls">
          <div class="json-expand-controls">
            <button 
              class="json-control-btn"
            @click="handleExpandAll"
            :title="t('expandAll')"
          >
            {{ t('expandAll') }}
            </button>
            <button 
              class="json-control-btn"
            @click="handleCollapseAll"
            :title="t('collapseAll')"
          >
            {{ t('collapseAll') }}
            </button>
          </div>
          <div class="json-depth-controls">
            <span class="depth-label">{{ t('expandLevel') }}</span>
            <button 
              class="json-depth-btn"
              @click="decreaseDepth"
              :disabled="currentExpandDepth <= 0"
              :title="t('expandLevel')"
            >
              ➖
            </button>
            <span class="depth-value">{{ currentExpandDepth }}</span>
            <button 
              class="json-depth-btn"
              @click="increaseDepth"
              :title="t('expandLevel')"
            >
              ➕
            </button>
          </div>
        </div>
        <button 
          class="json-copy-all"
          @click="handleCopyAll"
          :title="t('copyAll')"
        >
          {{ t('copyAll') }}
        </button>
      </div>
      <JsonNode
        :value="value"
        :key-name="''"
        :path="[]"
        :expanded="expanded"
        :expand-depth="currentExpandDepth"
        :current-depth="0"
        :copyable="false"
        :max-string-length="maxStringLength"
        :max-string-lines="maxStringLines"
        :is-all-expanded="isAllExpanded"
        :key="renderKey"
        @show-full-string="handleShowFullString"
        @copy="handleCopy"
      />
    </div>
    
    <!-- 大字符串查看弹窗 -->
    <el-dialog
      v-model="showStringDialog"
      :title="`${t('viewFullContent')} - ${currentStringKey}`"
      width="80%"
      :max-width="900"
      :close-on-click-modal="true"
      :close-on-press-escape="true"
      destroy-on-close
      append-to-body
      custom-class="json-string-viewer-dialog"
      @close="handleStringDialogClose"
    >
      <div class="string-dialog-content">
        <div class="string-controls">
          <div class="string-control-left">
            <el-button 
              size="small" 
              type="primary" 
              @click="copyStringContent"
              :loading="copying"
              :icon="DocumentCopy"
            >
              {{ copying ? t('copying') : t('copy') }}
            </el-button>
            <el-button-group v-if="isCurrentContentJson" size="small">
              <el-button 
              :type="!isRawView ? 'primary' : ''"
                @click="setViewMode(false)"
                :icon="List"
              >
                {{ t('tree') }}
              </el-button>
              <el-button 
              :type="isRawView ? 'primary' : ''"
                @click="setViewMode(true)"
                :icon="Document"
              >
                {{ t('raw') }}
              </el-button>
            </el-button-group>
            <div v-if="isCurrentContentJson && !isRawView" class="dialog-depth-controls">
              <span class="depth-label">{{ t('level') }}</span>
              <el-button 
              size="small"
                @click="decreaseDialogDepth"
                :disabled="dialogExpandDepth <= 0"
                :icon="Minus"
              />
              <span class="depth-value">{{ dialogExpandDepth }}</span>
              <el-button 
              size="small"
                @click="increaseDialogDepth"
                :icon="Plus"
              />
            </div>
            <el-button 
              v-if="isCurrentContentJson && isRawView"
              size="small" 
              type="success" 
              @click="formatJsonContent"
              :icon="MagicStick"
            >
              {{ isFormatted ? t('minify') : t('format') }}
            </el-button>
          </div>
          <div class="string-meta">
            <span class="string-type" v-if="isCurrentContentJson">JSON</span>
            <span class="string-length">{{ formatLength(currentStringValue?.length || 0) }}</span>
          </div>
        </div>
        <div class="string-content-wrapper">
          <div v-if="isCurrentContentJson && !isRawView" class="json-rendered-content">
            <JsonViewerEnhanced 
              :value="parsedJsonValue"
              :boxed="false"
              :copyable="false"
              :theme="theme"
              :maxStringLength="maxStringLength"
              :maxStringLines="maxStringLines"
              :expandDepth="dialogExpandDepth"
              :key="`dialog-json-${dialogRenderKey}`"
            />
          </div>
          <pre v-else class="string-full-content">{{ currentStringValue }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElDialog, ElButton, ElButtonGroup, ElMessage } from 'element-plus'
import { DocumentCopy, List, Document, Minus, Plus, MagicStick } from '@element-plus/icons-vue'
import { copyToClip } from '../utils/copy'
import JsonNode from './JsonNode.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  value: any
  copyable?: boolean
  boxed?: boolean
  expanded?: boolean
  expandDepth?: number
  theme?: string
  maxStringLength?: number
  maxStringLines?: number
}

const props = withDefaults(defineProps<Props>(), {
  copyable: true,
  boxed: true,
  expanded: true,
  expandDepth: 5,
  theme: 'light',
  maxStringLength: 512,
  maxStringLines: 5
})

const showStringDialog = ref(false)
const currentStringKey = ref('')
const currentStringValue = ref('')
const copying = ref(false)
const containerRef = ref<HTMLElement>()
const isCurrentContentJson = ref(false)
const isFormatted = ref(false)
const isRawView = ref(false)
const parsedJsonValue = ref<any>(null)
const dialogExpandDepth = ref(5) // 弹窗中JSON的展开层级
const dialogRenderKey = ref(0) // 用于强制重新渲染弹窗中的JSON组件

// 当前展开深度
const currentExpandDepth = ref(props.expandDepth)
// 控制是否全部展开
const isAllExpanded = ref(false)
// 唯一的key用于强制重新渲染
const renderKey = ref(0)

// 检测字符串是否是有效的 JSON
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

// 格式化 JSON 字符串
function formatJsonString(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return jsonStr
  }
}

// 处理显示完整字符串
function handleShowFullString(data: { key: string; value: string }) {
  currentStringKey.value = data.key
  currentStringValue.value = data.value
  isCurrentContentJson.value = isValidJson(data.value)
  isFormatted.value = false
  isRawView.value = false
  
  // 如果是有效的 JSON，解析它
  if (isCurrentContentJson.value) {
    try {
      parsedJsonValue.value = JSON.parse(data.value)
    } catch (error) {
      parsedJsonValue.value = null
      isCurrentContentJson.value = false
    }
  } else {
    parsedJsonValue.value = null
  }
  
  showStringDialog.value = true
}

// 处理复制
async function handleCopy(value: string) {
  try {
    await copyToClip(value)
    ElMessage.success(t('copySuccess'))
  } catch (error) {
    ElMessage.error(t('copyFail'))
  }
}

// 复制全部内容
async function handleCopyAll() {
  try {
    const jsonString = JSON.stringify(props.value, null, 2)
    await copyToClip(jsonString)
    ElMessage.success(t('copySuccess'))
  } catch (error) {
    ElMessage.error(t('copyFail'))
  }
}

// 复制字符串内容
async function copyStringContent() {
  if (!currentStringValue.value) return
  
  copying.value = true
  try {
    await copyToClip(currentStringValue.value)
    ElMessage.success(t('copySuccess'))
  } catch (error) {
    ElMessage.error(t('copyFail'))
  } finally {
    copying.value = false
  }
}

// 格式化 JSON 内容
function formatJsonContent() {
  if (!isCurrentContentJson.value || !currentStringValue.value) return
  
  if (isFormatted.value) {
    // 如果已经格式化，则压缩显示
    try {
      const parsed = JSON.parse(currentStringValue.value)
      currentStringValue.value = JSON.stringify(parsed)
      isFormatted.value = false
      ElMessage.success(t('jsonMinified'))
    } catch (error) {
      ElMessage.error(t('jsonFormatFailed'))
    }
  } else {
    // 格式化显示
    currentStringValue.value = formatJsonString(currentStringValue.value)
    isFormatted.value = true
    ElMessage.success(t('jsonFormatted'))
  }
}

// 格式化文件长度显示
function formatLength(length: number): string {
  if (length < 1024) return `${length} chars`
  if (length < 1024 * 1024) return `${(length / 1024).toFixed(1)}K chars`
  return `${(length / (1024 * 1024)).toFixed(1)}M chars`
}

// 设置视图模式
function setViewMode(isRaw: boolean) {
  isRawView.value = isRaw
}

// 弹窗JSON展开层级控制
function increaseDialogDepth() {
  dialogExpandDepth.value++
  dialogRenderKey.value++
}

function decreaseDialogDepth() {
  if (dialogExpandDepth.value > 0) {
    dialogExpandDepth.value--
    dialogRenderKey.value++
  }
}

// 关闭字符串弹窗
function handleStringDialogClose() {
  currentStringKey.value = ''
  currentStringValue.value = ''
  isRawView.value = false
  parsedJsonValue.value = null
  dialogExpandDepth.value = 5 // 重置到默认层级
  dialogRenderKey.value = 0
}

// 展开所有节点
function handleExpandAll() {
  isAllExpanded.value = true
  renderKey.value++
}

// 收起所有节点
function handleCollapseAll() {
  isAllExpanded.value = false
  currentExpandDepth.value = 0
  renderKey.value++
}

// 增加展开层级
function increaseDepth() {
  currentExpandDepth.value++
  isAllExpanded.value = false
  renderKey.value++
}

// 减少展开层级
function decreaseDepth() {
  if (currentExpandDepth.value > 0) {
    currentExpandDepth.value--
    isAllExpanded.value = false
    renderKey.value++
  }
}


</script>

<style lang="scss">
.json-viewer-enhanced {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #24292f;
  background: #ffffff;
  
  &.json-boxed {
    border: 1px solid #d0d7de;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  
  &.json-theme-dark {
    background-color: #0d1117;
    color: #f0f6fc;
    
    &.json-boxed {
      border-color: #30363d;
      background-color: #161b22;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  }

  .json-container {
    width: 100%;
    font-variant-ligatures: none;
  }

  .json-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(175, 184, 193, 0.2);
  }

  .json-controls {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .json-expand-controls {
    display: flex;
    gap: 8px;
  }

  .json-depth-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    
    .depth-label {
      font-size: 12px;
      color: #656d76;
      font-weight: 500;
    }
    
    .depth-value {
      min-width: 20px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: #0366d6;
      background: rgba(3, 102, 214, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
    }
  }

  .json-control-btn,
  .json-depth-btn {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    color: #24292f;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    
    &:hover:not(:disabled) {
      background: #eaeef2;
      border-color: #afb8c1;
    }
    
    &:active:not(:disabled) {
      transform: scale(0.98);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .json-depth-btn {
    padding: 4px 8px;
    min-width: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .json-copy-all {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    color: #24292f;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    
    &:hover {
      background: #eaeef2;
      border-color: #afb8c1;
    }
    
    &:active {
      transform: scale(0.98);
    }
  }

  .json-node {
    position: relative;
    
    .json-line {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 2px 0;
      position: relative;
      min-height: 20px;
      transition: background-color 0.15s ease;
      border-radius: 4px;
      margin: 0 -4px;
      padding-left: 4px;
      padding-right: 4px;
      user-select: text;
      
      &:hover {
        background-color: rgba(3, 102, 214, 0.02);
      }
    }
    
    .json-key {
      color: #0366d6;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 13px;
      margin-right: 2px;
    }
    
    .json-toggle {
      cursor: pointer;
      user-select: none;
      color: #586069;
      font-size: 10px;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      flex-shrink: 0;
      margin-top: 1px;
      transition: all 0.15s ease;
      font-weight: 700;
      
      &:hover {
        color: #0366d6;
        background-color: rgba(3, 102, 214, 0.05);
        transform: scale(1.15);
      }
    }
    
    .json-toggle-placeholder {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    
    .json-colon {
      color: #586069;
      margin-right: 6px;
      font-weight: 500;
    }
    
    .json-value {
      flex: 1;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.45;
      
      &.json-clickable {
        cursor: pointer;
        transition: all 0.15s ease;
        border-radius: 3px;
        
        &:hover {
          background-color: transparent;
        }
      }
      
      &.json-truncated {
        border-left: 3px solid #0366d6;
        padding-left: 10px;
        background: rgba(3, 102, 214, 0.02);
        border-radius: 0 4px 4px 0;
      }
    }
    
    .json-truncate-hint {
      color: #0366d6;
      font-style: italic;
      font-size: 11px;
      margin-left: 10px;
      opacity: 0.9;
      font-weight: 500;
    }
    
    .json-string-expand-icon {
      display: inline-block;
      margin-left: 6px;
      opacity: 0.4;
      font-size: 10px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      border-radius: 2px;
      padding: 1px 2px;
      
      &:hover {
        opacity: 0.8;
        background-color: rgba(3, 102, 214, 0.08);
        transform: scale(1.1);
      }
    }
    
    .json-children {
      margin-left: 24px;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        left: -12px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(3, 102, 214, 0.2);
      }
      
      .json-line {
        position: relative;
        
        &::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          width: 8px;
          height: 1px;
          background: rgba(3, 102, 214, 0.2);
        }
      }
      
      .json-bracket-close::before {
        display: none;
      }
    }
  }

  // 深度样式增强
  .json-depth-0 > .json-line {
    font-weight: 600;
  }

  .json-depth-1 > .json-line {
    font-weight: 500;
  }

  .json-depth-2 > .json-line {
    font-weight: 400;
  }

  // 值类型样式
  .json-value.json-value-string {
    color: #22863a;
    font-weight: 500;
  }

  .json-value.json-value-number {
    color: #005cc5;
    font-weight: 600;
  }

  .json-value.json-value-boolean {
    color: #6f42c1;
    font-weight: 600;
  }

  .json-value.json-value-null,
  .json-value.json-value-undefined {
    color: #6a737d;
    font-style: italic;
    opacity: 0.9;
  }

  .json-collapsed-preview {
    color: #6a737d;
    font-style: italic;
    margin-left: 4px;
  }

  .json-bracket-open,
  .json-bracket-close-char {
    color: #586069;
    font-weight: 600;
  }

  .json-type-array > .json-line > .json-value,
  .json-type-object > .json-line > .json-value {
    color: #6f42c1;
    font-weight: 600;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 14px;
    border: 1px solid rgba(198, 209, 234, 0.15);
  }

  // 暗色主题
  &.json-theme-dark {
    .json-header {
      border-color: rgba(110, 118, 129, 0.2);
    }
    
    .json-copy-all {
      background: #21262d;
      border-color: #30363d;
      color: #f0f6fc;
      
      &:hover {
        background: #30363d;
        border-color: #8b949e;
      }
    }
    
    .json-control-btn,
    .json-depth-btn {
      background: #21262d;
      border-color: #30363d;
      color: #f0f6fc;
      
      &:hover:not(:disabled) {
        background: #30363d;
        border-color: #8b949e;
      }
    }
    
    .json-depth-controls {
      .depth-label {
        color: #8b949e;
      }
      
      .depth-value {
        color: #58a6ff;
        background: rgba(88, 166, 255, 0.15);
      }
    }
    
    .json-key {
      color: #58a6ff;
    }
    
    .json-toggle {
      color: #8b949e;
      
      &:hover {
        color: #58a6ff;
        background-color: rgba(88, 166, 255, 0.08);
      }
    }
    
    .json-colon {
      color: #8b949e;
    }
    
    .json-line:hover {
      background-color: rgba(88, 166, 255, 0.03);
    }
    
    .json-children {
      &::before {
        background: rgba(88, 166, 255, 0.3);
      }
      
      .json-line::before {
        background: rgba(88, 166, 255, 0.3);
      }
    }
    
    .json-value.json-value-string {
      color: #7ee787;
    }
    
    .json-value.json-value-number {
      color: #58a6ff;
    }
    
    .json-value.json-value-boolean {
      color: #d2a8ff;
    }
    
    .json-value.json-value-null,
    .json-value.json-value-undefined {
      color: #8b949e;
    }
    
    .json-collapsed-preview {
      color: #8b949e;
    }
    
    .json-bracket-open,
    .json-bracket-close-char {
      color: #8b949e;
    }
    
    .json-type-array > .json-line > .json-value,
    .json-type-object > .json-line > .json-value {
      color: #d2a8ff;
      background: rgba(210, 168, 255, 0.05);
      border-color: rgba(210, 168, 255, 0.15);
    }
    
    .json-value.json-truncated {
      background: rgba(88, 166, 255, 0.05);
      border-color: #58a6ff;
    }
    
    .json-string-expand-icon {
      &:hover {
        background-color: rgba(88, 166, 255, 0.12);
      }
    }
  }
}
</style>

<!-- 全局样式 - 为 append-to-body 的对话框提供样式 -->
<style lang="scss">
/* Element Plus Dialog 全局样式 - 使用最强选择器确保样式生效 */
body .el-overlay .json-string-viewer-dialog,
body .json-string-viewer-dialog,
.json-string-viewer-dialog {
  
  .el-dialog__body {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
    padding: 20px !important;
  }
  
  .string-dialog-content {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
    
    .string-controls {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      margin-bottom: 8px !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      border: 1px solid #e1e4e8 !important;
      background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%) !important;
      font-family: inherit !important;
      min-height: 32px !important;
      
      .string-control-left {
        display: flex !important;
        gap: 8px !important;
        align-items: center !important;
        
        .dialog-depth-controls {
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          padding: 2px 6px !important;
          background: rgba(59, 130, 246, 0.05) !important;
          border: 1px solid rgba(59, 130, 246, 0.2) !important;
          border-radius: 4px !important;
          
          .depth-label {
            font-size: 10px !important;
            color: #374151 !important;
            font-weight: 500 !important;
            white-space: nowrap !important;
          }
          
          .depth-value {
            min-width: 16px !important;
            text-align: center !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            color: #3b82f6 !important;
            background: rgba(59, 130, 246, 0.1) !important;
            padding: 1px 4px !important;
            border-radius: 3px !important;
          }
        }
      }
      
      .string-meta {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        
        .string-type {
          font-size: 10px !important;
          font-weight: 600 !important;
          color: #ffffff !important;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
          padding: 2px 6px !important;
          border-radius: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3px !important;
          box-shadow: 0 1px 2px rgba(34, 197, 94, 0.2) !important;
        }
        
        .string-length {
          font-size: 10px !important;
          color: #6b7280 !important;
          font-weight: 500 !important;
          background: rgba(255, 255, 255, 0.8) !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          border: 1px solid rgba(209, 213, 219, 0.6) !important;
          font-family: 'SF Mono', Monaco, monospace !important;
        }
      }
    }
    
    .string-content-wrapper {
      max-height: 70vh !important;
      overflow: auto !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      background: #ffffff !important;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05) !important;
      
      .json-rendered-content {
        padding: 20px !important;
        background: #ffffff !important;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
        border-radius: 8px !important;
      }
      
      .string-full-content {
        margin: 0 !important;
        padding: 20px !important;
        background-color: #ffffff !important;
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
        font-size: 13px !important;
        line-height: 1.6 !important;
        color: #374151 !important;
        white-space: pre-wrap !important;
        word-break: break-all !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        hyphens: auto !important;
        border: none !important;
        border-radius: 8px !important;
      }
      
      /* 滚动条样式 */
      &::-webkit-scrollbar {
        width: 8px !important;
        height: 8px !important;
      }
      
      &::-webkit-scrollbar-track {
        background: #f1f5f9 !important;
        border-radius: 4px !important;
      }
      
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1 !important;
        border-radius: 4px !important;
        
        &:hover {
          background: #94a3b8 !important;
        }
      }
    }
  }
}

/* 直接对所有可能的选择器使用最强样式 */
.string-dialog-content {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
  
  .string-controls {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    margin-bottom: 8px !important;
    padding: 6px 12px !important;
    border-radius: 6px !important;
    border: 1px solid #e1e4e8 !important;
    background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%) !important;
    min-height: 32px !important;
    
    .string-control-left {
      display: flex !important;
      gap: 8px !important;
      align-items: center !important;
      
      .dialog-depth-controls {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 2px 6px !important;
        background: rgba(59, 130, 246, 0.05) !important;
        border: 1px solid rgba(59, 130, 246, 0.2) !important;
        border-radius: 4px !important;
        
        .depth-label {
          font-size: 10px !important;
          color: #374151 !important;
          font-weight: 500 !important;
          white-space: nowrap !important;
        }
        
        .depth-value {
          min-width: 16px !important;
          text-align: center !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #3b82f6 !important;
          background: rgba(59, 130, 246, 0.1) !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
        }
      }
    }
    
    .string-meta {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      
      .string-type {
        font-size: 10px !important;
        font-weight: 600 !important;
        color: #ffffff !important;
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.3px !important;
        box-shadow: 0 1px 2px rgba(34, 197, 94, 0.2) !important;
      }
      
      .string-length {
        font-size: 10px !important;
        color: #6b7280 !important;
        font-weight: 500 !important;
        background: rgba(255, 255, 255, 0.8) !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        border: 1px solid rgba(209, 213, 219, 0.6) !important;
        font-family: 'SF Mono', Monaco, monospace !important;
      }
    }
  }
  
  .string-content-wrapper {
    max-height: 70vh !important;
    overflow: auto !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    background: #ffffff !important;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05) !important;
    
    .json-rendered-content {
      padding: 20px !important;
      background: #ffffff !important;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
      border-radius: 8px !important;
    }
    
    .string-full-content {
      margin: 0 !important;
      padding: 20px !important;
      background-color: #ffffff !important;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace !important;
      font-size: 13px !important;
      line-height: 1.6 !important;
      color: #374151 !important;
      white-space: pre-wrap !important;
      word-break: break-all !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      hyphens: auto !important;
      border: none !important;
      border-radius: 8px !important;
    }
    
    /* 滚动条样式 */
    &::-webkit-scrollbar {
      width: 8px !important;
      height: 8px !important;
    }
    
    &::-webkit-scrollbar-track {
      background: #f1f5f9 !important;
      border-radius: 4px !important;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #cbd5e1 !important;
      border-radius: 4px !important;
      
      &:hover {
        background: #94a3b8 !important;
      }
    }
  }
}
</style>
