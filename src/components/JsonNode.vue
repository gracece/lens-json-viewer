<template>
  <div class="json-node" :class="[`json-type-${valueType}`, `json-depth-${currentDepth}`]">
    <div class="json-line">
      <!-- 展开/收起按钮 -->
      <span 
        v-if="isCollapsible" 
        class="json-toggle"
        @click="toggleExpanded"
      >
        {{ isExpanded ? '▾' : '▸' }}
      </span>
      <span v-else class="json-toggle-placeholder"></span>
      
      <!-- 键名 -->
      <span v-if="keyName && !isElementOfArray" class="json-key">"{{ keyName }}"</span>
      <span v-if="keyName && !isElementOfArray" class="json-colon">:</span>
      
      <!-- 值 -->
      <span 
        class="json-value"
        :class="{ 
          'json-clickable': isCollapsible || (stringInfo && stringInfo.isTruncated),
          'json-truncated': stringInfo && stringInfo.isTruncated,
          [`json-value-${valueType}`]: true
        }"
        @click="isCollapsible ? toggleExpanded() : (stringInfo && stringInfo.isTruncated ? showFullString() : null)"
      >
        <template v-if="stringInfo">
          {{ stringInfo.display }}
          <span v-if="stringInfo.isTruncated" class="json-truncate-hint">
            {{ stringInfo.stats }} - {{ t('clickToViewFull') }}
          </span>
          <span 
            v-if="!stringInfo.isTruncated && stringInfo.fullValue" 
            class="json-string-expand-icon"
            @click.stop="showFullString()"
            :title="t('viewFullContent')"
          >
            ↗
          </span>
        </template>
        <template v-else-if="isCollapsible && !isExpanded">
          {{ displayValue }}
          <span class="json-collapsed-preview">
            {{ valueType === 'array' ? ' […]' : ' {…}' }}
          </span>
        </template>
        <template v-else-if="isCollapsible && isExpanded">
          <span class="json-bracket-open">{{ valueType === 'array' ? '[' : '{' }}</span>
        </template>
        <template v-else>
          {{ displayValue }}
        </template>
      </span>
    </div>
    
    <!-- 子节点 -->
    <div v-if="isCollapsible && isExpanded && hasRenderedChildren" class="json-children">
      <JsonNode
        v-for="[key, childValue] in objectEntries"
        :key="key"
        :value="childValue"
        :key-name="key"
        :path="[...path, keyName].filter(Boolean)"
        :expanded="expanded"
        :expand-depth="expandDepth"
        :current-depth="currentDepth + 1"
        :copyable="copyable"
        :max-string-length="maxStringLength"
        :max-string-lines="maxStringLines"
        :is-all-expanded="isAllExpanded"
        :is-element-of-array="valueType === 'array'"
        @show-full-string="$emit('show-full-string', $event)"
        @copy="$emit('copy', $event)"
      />
      
      <!-- 闭合括号 -->
      <div class="json-line json-bracket-close">
        <span class="json-toggle-placeholder"></span>
        <span class="json-bracket-close-char">{{ valueType === 'array' ? ']' : '}' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  value: any
  keyName?: string
  path?: string[]
  expanded?: boolean
  expandDepth?: number
  currentDepth?: number
  copyable?: boolean
  maxStringLength?: number
  maxStringLines?: number
  isAllExpanded?: boolean
  isElementOfArray?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  keyName: '',
  path: () => [],
  expanded: true,
  expandDepth: 5,
  currentDepth: 0,
  copyable: true,
  maxStringLength: 256,
  maxStringLines: 5,
  isAllExpanded: false,
  isElementOfArray: false
})

const emit = defineEmits<{
  'show-full-string': [data: { key: string; value: string }]
  'copy': [value: string]
}>()

const isExpanded = ref(
  props.isAllExpanded || 
  (props.expanded && props.currentDepth < props.expandDepth)
)
const hasRenderedChildren = ref(isExpanded.value)

// 监听全部展开状态的变化
watch(() => props.isAllExpanded, (newVal) => {
  if (newVal) {
    isExpanded.value = true
    hasRenderedChildren.value = true
  }
})

// 监听展开深度的变化
watch(() => props.expandDepth, (newDepth) => {
  if (!props.isAllExpanded) {
    isExpanded.value = props.expanded && props.currentDepth < newDepth
    if (isExpanded.value) {
      hasRenderedChildren.value = true
    }
  }
})

const valueType = computed(() => {
  if (props.value === null) return 'null'
  if (props.value === undefined) return 'undefined'
  if (Array.isArray(props.value)) return 'array'
  return typeof props.value
})

const isCollapsible = computed(() => {
  return valueType.value === 'object' || valueType.value === 'array'
})

const displayValue = computed(() => {
  const val = props.value
  
  switch (valueType.value) {
    case 'null':
      return 'null'
    case 'undefined':
      return 'undefined'
    case 'boolean':
      return val.toString()
    case 'number':
      return val.toString()
    case 'string':
      return processString(val)
    case 'array':
      return `Array(${val.length})`
    case 'object': {
      const keys = Object.keys(val)
      return `Object{${keys.length}}`
    }
    default:
      return String(val)
  }
})

const processString = (str: string) => {
  if (!str) return { display: '""', isTruncated: false, fullValue: str }
  
  const lines = str.split('\n')
  const shouldTruncateByLength = str.length > props.maxStringLength
  const shouldTruncateByLines = lines.length > props.maxStringLines
  
  if (shouldTruncateByLength || shouldTruncateByLines) {
    let truncated = str
    
    if (shouldTruncateByLines) {
      truncated = lines.slice(0, props.maxStringLines).join('\n')
    }
    
    if (truncated.length > props.maxStringLength) {
      truncated = truncated.substring(0, props.maxStringLength)
    }
    
    const stats = []
    if (shouldTruncateByLength) {
    stats.push(`${str.length} ${t('chars')}`)
    }
    if (shouldTruncateByLines) {
      stats.push(`${lines.length} ${t('lines')}`)
    }
    
    return {
      display: `"${truncated}..."`,
      isTruncated: true,
      fullValue: str,
      stats: stats.join(', ')
    }
  }
  
  return {
    display: `"${str}"`,
    isTruncated: false,
    fullValue: str
  }
}

const stringInfo = computed(() => {
  if (valueType.value === 'string') {
    return processString(props.value)
  }
  return null
})

const objectEntries = computed(() => {
  if (valueType.value === 'object') {
    return Object.entries(props.value)
  }
  if (valueType.value === 'array') {
    return props.value.map((item: any, index: number) => [index.toString(), item])
  }
  return []
})

function toggleExpanded() {
  if (isCollapsible.value) {
    isExpanded.value = !isExpanded.value
    if (isExpanded.value) {
      hasRenderedChildren.value = true
    }
  }
}

function showFullString() {
  if (stringInfo.value) {
    const path = [...props.path, props.keyName].filter(Boolean).join('.')
    emit('show-full-string', {
      key: path || 'root',
      value: stringInfo.value.fullValue
    })
  }
}
</script>

<script lang="ts">
// 为了支持递归组件，需要显式声明组件名称
export default {
  name: 'JsonNode'
}
</script>
