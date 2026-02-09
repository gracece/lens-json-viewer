# AGENTS.md

This document provides technical guidance for AI coding agents (GitHub Copilot, Cursor, Aider, etc.) to ensure efficient and consistent development within the **Lens JSON Viewer** project.

## 1. Project Overview

*   **Core Goal**: A lightweight, high-performance desktop JSON/JSONL viewer.
*   **Architecture**: Electron application with a clear separation between the **Main Process** (Node.js) and **Renderer Process** (Web/Vue).
*   **Tech Stack**: 
    *   **Runtime**: Electron 40+
    *   **Frontend**: Vue 3.4 (Composition API with `<script setup>`)
    *   **Build Tool**: Vite 7 + `vite-plugin-electron`
    *   **Language**: TypeScript 5
    *   **UI Components**: Element Plus 2.7+
    *   **Styles**: SCSS (`sass-embedded`)
    *   **Parsing**: `ndjson` for JSONL streams.

## 2. Construction & Development

### Commands
*   **Install Dependencies**: `npm install`
*   **Development**: `npm run dev` (Starts Vite dev server and Electron window)
*   **Production Build**: `npm run build` (Executes `vue-tsc`, `vite build`, and `electron-builder`)
*   **Preview**: `npm run preview`

### Environment & Configuration
*   **Node.js Version**: Required 20.19+ or 22.12+.
*   **Main Process Config**: [electron-builder.json5](electron-builder.json5)
*   **Vite Config**: [vite.config.ts](vite.config.ts)
*   **TypeScript Config**: [tsconfig.json](tsconfig.json) and [tsconfig.node.json](tsconfig.node.json)

## 3. Architecture & File Mapping

*   **Main Process** (`/electron/`): Handles window management, native menus, file system I/O (local file reading), and IPC listeners.
*   **Renderer Process** (`/src/`): Vue 3 application.
    *   `App.vue`: Root component managing global state, drag-and-drop, and pagination.
    *   `components/`: UI components (e.g., `JsonNode.vue` for recursive rendering, `TableExtractor.vue` for data extraction).
    *   `composables/`: Shared logic (e.g., `useDarkMode.ts`).
*   **Preload Script** (`/electron/preload.ts`): Bridges Main and Renderer processes via `contextBridge`.

## 4. Coding Standards

*   **Logic Separation**: 
    *   Native operations (File I/O) must reside in the Main process ([electron/main.ts](electron/main.ts)).
    *   UI and state management must reside in the Renderer process ([src/](src/)).
*   **Component Style**: Use Vue 3 `<script setup lang="ts">` and Scoped SCSS.
*   **Performance**: Large JSON parsing must be handled asynchronously (using Web Workers or optimized Node.js streams) to avoid blocking the UI thread.
*   **Naming Conventions**:
    *   **Components**: PascalCase (e.g., `JsonViewerEnhanced.vue`).
    *   **Variables/Functions**: camelCase.
    *   **Files**: kebab-case or PascalCase for components.
*   **Type Safety**: Strict TypeScript usage. Avoid `any`. Use interfaces for JSON structures where possible.

## 5. Testing & Validation

*   **Type Checking**: Run `vue-tsc` (included in the build script) to verify TypeScript integrity.
*   **Linting**: Follow standard ESLint/Prettier configurations [Pending specific config file].
*   **Manual Validation**: Test large file loading (JSON and JSONL) after modifying parsing logic. Use files in [test_files/](test_files/) for benchmarking.

## 6. Project Boundaries & Constraints

*   **Generated Directories**: Do NOT manually edit `/dist/`, `/dist-electron/`, or `/release/`.
*   **IPC Logic**: Any new feature requiring OS access (e.g., opening a save dialog) must implement a 3-part bridge:
    1. Define in `electron/main.ts`.
    2. Expose in `electron/preload.ts`.
    3. Invoke in `src/`.
*   **Sensitive Information**: Ensure `.env` files or local paths are not hardcoded or committed.

## 7. Collaboration Rules

*   **Git Flow**: Feature branches (`feature/xxx`) -> PR -> Review -> Merge.
*   **Commit Messages**: Follow conventional commits:
    *   `feat:` New feature.
    *   `fix:` Bug fix.
    *   `refactor:` Code change that neither fixes a bug nor adds a feature.
    *   `docs:` Documentation updates.
*   **PR Requirements**: 
    1. Pass `npm run build` (type check + build).
    2. Maintain responsive UI for files up to 100MB.
    3. Ensure i18n support (English/Chinese) in [src/i18n/locales/](src/i18n/locales/).
