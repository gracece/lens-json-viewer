# 🔍 Lens JSON Viewer

A lightweight, fast desktop application for viewing, searching, and formatting JSON / JSONL files. Built with **Electron + Vite + Vue 3 + TypeScript**.

> *Lens* — like a magnifying glass for your JSON data.

**English** | [中文](README.zh-CN.md)

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/Electron-40-blueviolet)
![Vue](https://img.shields.io/badge/Vue-3.4-brightgreen)

---

## ✨ Features

### File Opening
- **Menu**: `File → Open…` (`⌘O` / `Ctrl+O`)
- **Drag & Drop**: Drop `.json` / `.jsonl` files directly into the window
- **File Association**: Double-click JSON files in your file manager to open with Lens

### Tree Viewer
- Hierarchical tree view with collapsible nodes
- Adjustable expand depth (➖ / ➕ controls)
- One-click "Expand All" / "Collapse All"
- Syntax-highlighted value types (string, number, boolean, null)

### Large String Handling
- Long strings are truncated (default: 512 chars / 5 lines) with a click-to-expand modal
- Modal supports **Tree view** and **Raw view** toggle (when the string is valid JSON itself)
- In-modal JSON formatting / minification and copy

### JSONL Support
- Stream-based JSONL parsing via `ndjson`
- Paginated loading with configurable page size (default: 10 items)
- "Load more" / "Load all" controls

### Search
- **Find in page** (`⌘F` / `Ctrl+F`): Native Electron `findInPage` with prev/next navigation and match count
- **Array item search**: Filter array items by keyword in the bottom control bar

### Table Extraction
- Extract structured data from arrays of objects into a table view
- Define custom field paths with dot notation and array indexing
- Save & load field presets
- Export to CSV

### Appearance
- 🌗 Light / Dark / System theme modes
- 🌐 English and Chinese (中文) UI

---

## 📸 Screenshots

> *Coming soon — contributions welcome!*

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.19+ or 22.12+
- **npm** (bundled with Node.js)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/gracece/lens-json-viewer.git
cd lens-json-viewer

# Install dependencies
npm install

# Start in development mode (Vite dev server + Electron)
npm run dev
```

### Build for Production

```bash
# Type-check + Vite build + electron-builder package
npm run build
```

Build artifacts are output to `release/<version>/`:

| Platform | Format | Architecture |
|----------|--------|-------------|
| macOS    | DMG    | arm64       |
| Windows  | NSIS installer | x64  |
| Linux    | AppImage | —        |

---

## 🏗️ Project Structure

```
├── electron/
│   ├── main.ts                 # Main process: window, menu, IPC, file I/O
│   ├── preload.ts              # Preload script: exposes ipcRenderer to renderer
│   └── electron-env.d.ts       # Electron environment type declarations
├── src/
│   ├── main.ts                 # Vue app entry point
│   ├── App.vue                 # Root view: file loading, drag & drop, pagination, search
│   ├── components/
│   │   ├── JsonViewerEnhanced.vue  # Tree container: expand controls, copy, large-string modal
│   │   ├── JsonNode.vue            # Recursive tree node rendering
│   │   ├── TableExtractor.vue      # Table extraction dialog
│   │   └── SettingsDialog.vue      # Settings dialog (theme, language, page size)
│   ├── composables/
│   │   └── useDarkMode.ts      # Dark mode composable
│   ├── i18n/                   # Internationalization (en / zh)
│   ├── utils/
│   │   └── copy.ts             # Clipboard utility
│   └── style.css               # Global styles & CSS variables
├── public/                     # Static assets (icons)
├── electron-builder.json5      # electron-builder config
├── vite.config.ts              # Vite config
├── tsconfig.json               # TypeScript config
└── package.json
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘O` / `Ctrl+O` | Open file |
| `⌘F` / `Ctrl+F` | Find in page |
| `Enter` | Next match |
| `Shift+Enter` | Previous match |
| `Esc` | Close search bar |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Desktop Framework | Electron 40 |
| Frontend Framework | Vue 3.4 (Composition API + `<script setup>`) |
| Build Tool | Vite 7 + vite-plugin-electron |
| UI Library | Element Plus 2.7 |
| Language | TypeScript 5 |
| CSS | sass-embedded (SCSS) |
| JSONL Parsing | ndjson |
| Packaging | electron-builder (DMG / NSIS / AppImage) |

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/my-feature`)
3. **Commit** your changes (`git commit -m 'Add some feature'`)
4. **Push** to the branch (`git push origin feature/my-feature`)
5. **Open** a Pull Request

### Development Tips

- Use **VS Code** with the [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension for the best Vue 3 + TypeScript experience
- If Vite reports missing `sass-embedded`, run `npm install -D sass-embedded`
- JSON parsing runs in a **Web Worker** to keep the UI responsive — keep this pattern for any heavy computation

### Areas Where Help Is Needed

- 🎨 **App Icon**: The project needs a proper icon design (currently uses a placeholder). A lens/magnifying glass themed icon in `.icns` (macOS), `.ico` (Windows), and `.png` formats would be great
- 🌍 **Translations**: Add more languages beyond English and Chinese
- 📸 **Screenshots**: Add screenshots or a demo GIF to the README
- 🧪 **Tests**: Unit and integration test coverage
- 📦 **CI/CD**: GitHub Actions for automated builds and releases
- 📖 **Documentation**: Improve inline code documentation

---

## 📋 Known Limitations

- The app icon is a placeholder and needs a proper design
- File associations may require manual setup on some Linux distributions
- Very large files (100MB+) may cause slow initial parsing

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Element Plus](https://element-plus.org/)
- [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)
