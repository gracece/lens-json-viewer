const en = {
  // App header
  appTitle: 'Lens JSON Viewer',
  titleHint: 'Open a JSON or JSONL file from the menu to start.',

  // File meta
  items: 'items',

  // Loading
  loadingFile: 'Loading file…',
  readingFile: 'Reading file…',
  parsingJson: 'Parsing JSON…',

  // Empty state
  emptyTitleDragOver: 'Drop file here',
  emptyTitle: 'Ready to explore your JSON',
  emptyHint: 'Drag a JSON or JSONL file here, or click to browse',
  chooseFile: 'Choose a file',

  // Error
  failedToParse: 'Failed to parse file',
  openAnotherFile: 'Open another file',
  unableToReadFile: 'Unable to read file',
  failedToParseJson: 'Failed to parse JSON file',
  onlyJsonSupported: 'Only JSON or JSONL files are supported',
  jsonlUnavailable: 'JSONL content is unavailable',

  // Find in page
  findPlaceholder: 'Find in page… (Enter to search)',
  findPrevTitle: 'Previous (Shift+Enter)',
  findNextTitle: 'Next (Enter)',
  findCloseTitle: 'Close (Esc)',

  // Array controls
  matchesLoaded: 'Matches loaded',
  itemsLoaded: 'Items loaded',
  noMatches: 'No matches',
  matches: 'Matches',
  allItemsLoaded: 'All items loaded',
  searchInItems: 'Search in items',
  search: 'Search',
  clear: 'Clear',
  tableExtract: '📊 Table Extract',
  loadingEllipsis: 'Loading…',
  loadMore: 'Load more',
  loadAll: 'Load all',

  // JsonViewerEnhanced
  expandAll: '📂 Expand all',
  collapseAll: '📁 Collapse all',
  expandLevel: 'Level:',
  copyAll: '📋 Copy all',
  viewFullContent: 'View full content',
  copySuccess: 'Copied successfully',
  copyFail: 'Copy failed',
  copying: 'Copying...',
  copy: 'Copy',
  tree: 'Tree',
  raw: 'Raw',
  level: 'Level:',
  format: 'Format',
  minify: 'Minify',
  jsonFormatted: 'JSON formatted',
  jsonMinified: 'JSON minified',
  jsonFormatFailed: 'JSON format failed',

  // JsonNode
  chars: 'chars',
  lines: 'lines',
  clickToViewFull: 'Click to view full content',

  // TableExtractor
  tableExtractorFieldsTitle: 'Table Extractor — Define Fields',
  tableExtractorPreviewTitle: 'Table Extractor — Preview',
  fieldHelp: 'Enter field paths to extract, separated by commas or newlines.',
  fieldHelpDot: 'Use <code>dot.notation</code> for nested fields, and <code>[index]</code> for arrays (e.g. <code>user.name</code>, <code>tags[0]</code>, <code>data[0].key</code>).',
  fieldPlaceholder: 'e.g. id, name, user.email, metadata.created_at',
  presetNamePlaceholder: 'Preset name',
  savePreset: 'Save preset',
  presets: 'Presets:',
  detectedFields: 'Detected fields (click to add):',
  showing: 'Showing',
  of: 'of',
  rows: 'rows',
  columns: 'columns',
  exporting: 'Exporting…',
  exportAllAsCsv: 'Export all {count} rows as CSV',
  back: '← Back',
  extractTable: 'Extract Table',
  close: 'Close',

  // Settings
  settings: 'Settings',
  language: 'Language',
  languageEn: 'English',
  languageZh: '中文',
  general: 'General',
  settingsDesc: 'Customize your preferences.',
  pageSizeLabel: 'Load more count',
  pageSizeCustom: 'Custom',
  appearance: 'Appearance',
  themeMode: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',

  // Electron menu
  menuFile: 'File',
  menuOpen: 'Open…',
  menuEdit: 'Edit',
  menuFind: 'Find…',
  menuView: 'View',
  menuWindow: 'Window',
  menuHelp: 'Help',
}

export default en
export type LocaleMessages = typeof en
