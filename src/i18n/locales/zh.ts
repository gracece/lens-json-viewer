import type { LocaleMessages } from './en'

const zh: LocaleMessages = {
  // App header
  appTitle: 'Lens JSON 查看器',
  titleHint: '从菜单打开 JSON 或 JSONL 文件开始使用。',

  // File meta
  items: '条目',

  // Loading
  loadingFile: '正在加载文件…',
  readingFile: '正在读取文件…',
  parsingJson: '正在解析 JSON…',

  // Empty state
  emptyTitleDragOver: '将文件拖放到此处',
  emptyTitle: '准备好探索你的 JSON 了',
  emptyHint: '将 JSON 或 JSONL 文件拖放到此处，或点击浏览',
  chooseFile: '选择文件',
  inputTitle: '粘贴 JSON',
  inputHint: '支持 JSON 或 JSONL',
  inputPlaceholder: '在此粘贴 JSON 或 JSONL…',
  loadInput: '加载',
  clearInput: '清空',
  inputEmpty: '输入内容为空',
  jsonlLineError: 'JSONL 解析错误，行号',
  checkInput: '返回检查',

  // Error
  failedToParse: '解析文件失败',
  openAnotherFile: '打开其他文件',
  unableToReadFile: '无法读取文件',
  failedToParseJson: '解析 JSON 文件失败',
  onlyJsonSupported: '仅支持 JSON 或 JSONL 文件',
  jsonlUnavailable: 'JSONL 内容不可用',

  // Find in page
  findPlaceholder: '在页面中查找…（回车搜索）',
  findPrevTitle: '上一个 (Shift+Enter)',
  findNextTitle: '下一个 (Enter)',
  findCloseTitle: '关闭 (Esc)',

  // Array controls
  matchesLoaded: '匹配已加载',
  itemsLoaded: '条目已加载',
  noMatches: '无匹配项',
  matches: '匹配',
  allItemsLoaded: '全部条目已加载',
  searchInItems: '搜索条目',
  search: '搜索',
  clear: '清除',
  tableExtract: '📊 表格提取',
  loadingEllipsis: '加载中…',
  loadMore: '加载更多',
  loadAll: '加载全部',

  // JsonViewerEnhanced
  expandAll: '📂 展开所有',
  collapseAll: '📁 收起所有',
  expandLevel: '层级:',
  copyAll: '📋 复制全部',
  viewFullContent: '查看完整内容',
  copySuccess: '复制成功',
  copyFail: '复制失败',
  copying: '复制中...',
  copy: '复制',
  tree: '树形',
  raw: '原始',
  level: '层级:',
  format: '格式化',
  minify: '压缩',
  jsonFormatted: 'JSON 已格式化',
  jsonMinified: 'JSON 已压缩',
  jsonFormatFailed: 'JSON 格式化失败',

  // JsonNode
  chars: '字符',
  lines: '行',
  clickToViewFull: '点击查看完整内容',

  // TableExtractor
  tableExtractorFieldsTitle: '表格提取 — 定义字段',
  tableExtractorPreviewTitle: '表格提取 — 预览',
  fieldHelp: '输入要提取的字段路径，以逗号或换行分隔。',
  fieldHelpDot: '使用 <code>dot.notation</code> 访问嵌套字段，使用 <code>[index]</code> 访问数组元素（如 <code>user.name</code>、<code>tags[0]</code>、<code>data[0].key</code>）。',
  fieldPlaceholder: '如: id, name, user.email, metadata.created_at',
  presetNamePlaceholder: '预设名称',
  savePreset: '保存预设',
  presets: '预设:',
  detectedFields: '检测到的字段（点击添加）:',
  showing: '显示',
  of: '/',
  rows: '行',
  columns: '列',
  exporting: '导出中…',
  exportAllAsCsv: '导出全部 {count} 行为 CSV',
  back: '← 返回',
  extractTable: '提取表格',
  close: '关闭',

  // Settings
  settings: '设置',
  language: '语言',
  languageEn: 'English',
  languageZh: '中文',
  general: '通用',
  settingsDesc: '自定义你的偏好设置。',
  pageSizeLabel: '每次加载条数',
  pageSizeCustom: '自定义',
  openBehaviorLabel: '已有文件时打开方式',
  openInNewWindow: '新窗口打开',
  openInSameWindow: '当前窗口打开',
  appearance: '外观',
  themeMode: '主题',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',

  // Electron menu
  menuFile: '文件',
  menuOpen: '打开…',
  menuEdit: '编辑',
  menuFind: '查找…',
  menuView: '视图',
  menuWindow: '窗口',
  menuHelp: '帮助',
}

export default zh
