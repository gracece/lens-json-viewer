import { app, BrowserWindow, dialog, Menu, ipcMain, screen } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'

const require = createRequire(import.meta.url)
const ndjson = require('ndjson') as { parse: () => NodeJS.ReadWriteStream }
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const windows = new Set<BrowserWindow>()
const pendingFilePaths: string[] = []
const windowHasFile = new Map<number, boolean>()
type OpenBehavior = 'new-window' | 'reuse-window'
let openBehavior: OpenBehavior = 'new-window'
let currentLocale: string = 'en'

const menuLabels: Record<string, Record<string, string>> = {
  en: {
    file: 'File',
    open: 'Open…',
    edit: 'Edit',
    find: 'Find…',
    view: 'View',
    window: 'Window',
    help: 'Help',
  },
  zh: {
    file: '文件',
    open: '打开…',
    edit: '编辑',
    find: '查找…',
    view: '视图',
    window: '窗口',
    help: '帮助',
  },
}

async function readJsonlFile(filePath: string) {
  const entries: unknown[] = []
  const parser = ndjson.parse()
  const stream = createReadStream(filePath, { encoding: 'utf-8' })
  const parsedStream = stream.pipe(parser)

  for await (const entry of parsedStream as AsyncIterable<unknown>) {
    entries.push(entry)
  }

  return entries
}

async function readJsonFile(filePath: string) {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.jsonl')) {
    const jsonlEntries = await readJsonlFile(filePath)
    return { path: filePath, jsonlEntries, isJsonl: true }
  }

  const content = await fs.readFile(filePath, 'utf-8')
  return { path: filePath, content, isJsonl: false }
}

ipcMain.handle('read-json-file', async (_event, filePath: string) => {
  return await readJsonFile(filePath)
})

ipcMain.handle('select-json-file', async () => {
  const filePath = await selectJsonFile()
  if (!filePath) return null

  const targetWin = getFocusedWindow()
  if (targetWin) {
    const hasFile = windowHasFile.get(targetWin.id)
    const shouldReuse = !hasFile || openBehavior === 'reuse-window'
    if (shouldReuse) {
      await sendFileToWindow(targetWin, filePath)
      return null
    }
  }

  createWindow(filePath)

  return null
})

ipcMain.handle('open-json-file', (event, filePath: string, options?: { reuseIfEmpty?: boolean }) => {
  if (!filePath) return false

  const senderWin = BrowserWindow.fromWebContents(event.sender)
  if (senderWin) {
    const hasFile = windowHasFile.get(senderWin.id)
    const shouldReuse = !hasFile || openBehavior === 'reuse-window' || (options?.reuseIfEmpty && !hasFile)
    if (shouldReuse) {
      sendFileToWindow(senderWin, filePath)
      return true
    }
  }

  createWindow(filePath)

  return true
})

ipcMain.handle('find-in-page', (event, query: string, options?: Electron.FindInPageOptions) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (!targetWin) return null
  return targetWin.webContents.findInPage(query, options)
})

ipcMain.handle('stop-find-in-page', (event, action: 'clearSelection' | 'keepSelection' | 'activateSelection' = 'clearSelection') => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (!targetWin) return null
  return targetWin.webContents.stopFindInPage(action)
})

ipcMain.handle('set-locale', (_event, locale: string) => {
  currentLocale = locale
  buildMenu()
  return true
})

ipcMain.handle('set-open-behavior', (_event, behavior: OpenBehavior) => {
  openBehavior = behavior === 'reuse-window' ? 'reuse-window' : 'new-window'
  return true
})

ipcMain.handle('set-window-title', (event, title: string) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (!targetWin) return false
  targetWin.setTitle(title)
  return true
})

async function sendFileToWindow(targetWin: BrowserWindow, filePath: string) {
  try {
    const payload = await readJsonFile(filePath)
    targetWin.webContents.send('file-opened', payload)
    windowHasFile.set(targetWin.id, true)
  } catch (error) {
    dialog.showErrorBox('Open File Failed', error instanceof Error ? error.message : 'Unable to read file')
  }
}

async function openJsonFile(targetPath?: string) {
  const filePath = targetPath ?? await selectJsonFile()
  if (!filePath) return
  const targetWin = getFocusedWindow()
  if (targetWin) {
    const hasFile = windowHasFile.get(targetWin.id)
    const shouldReuse = !hasFile || openBehavior === 'reuse-window'
    if (shouldReuse) {
      await sendFileToWindow(targetWin, filePath)
      return
    }
  }

  createWindow(filePath)
}

async function selectJsonFile() {
  const parentWindow = BrowserWindow.getFocusedWindow() ?? Array.from(windows)[0] ?? undefined
  const { canceled, filePaths } = await dialog.showOpenDialog(parentWindow, {
    title: 'Open JSON File - LensJsonViewer',
    properties: ['openFile'],
    filters: [
      { name: 'JSON', extensions: ['json', 'jsonl'] }
    ]
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
}

function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow() ?? Array.from(windows)[0] ?? null
}

function buildMenu() {
  const appName = app.getName()
  const labels = menuLabels[currentLocale] || menuLabels.en
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: labels.file,
      submenu: [
        {
          label: labels.open,
          accelerator: 'CmdOrCtrl+O',
          click: () => openJsonFile()
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: labels.edit,
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: labels.find,
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            getFocusedWindow()?.webContents.send('trigger-search')
          }
        }
      ]
    },
    {
      label: labels.view,
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: labels.window,
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      label: labels.help,
      submenu: [
        { role: 'help' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow(filePath?: string) {
  const focusedWin = BrowserWindow.getFocusedWindow() ?? Array.from(windows)[0] ?? null
  const offset = 24
  let x: number | undefined
  let y: number | undefined

  if (focusedWin) {
    const bounds = focusedWin.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea

    x = bounds.x + offset
    y = bounds.y + offset

    const maxX = workArea.x + workArea.width - 1200
    const maxY = workArea.y + workArea.height - 800
    if (x > maxX) x = workArea.x + offset
    if (y > maxY) y = workArea.y + offset
  }

  const newWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    x,
    y,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  windows.add(newWin)
  windowHasFile.set(newWin.id, false)

  newWin.on('closed', () => {
    windows.delete(newWin)
    windowHasFile.delete(newWin.id)
  })

  newWin.webContents.on('found-in-page', (_event, result) => {
    newWin.webContents.send('find-in-page-result', result)
  })

  // Test active push message to Renderer-process.
  newWin.webContents.on('did-finish-load', async () => {
    newWin.webContents.send('main-process-message', (new Date).toLocaleString())
    if (filePath) {
      await sendFileToWindow(newWin, filePath)
    }
  })

  if (VITE_DEV_SERVER_URL) {
    newWin.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    newWin.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  return newWin
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (app.isReady()) {
    openJsonFile(filePath)
  } else {
    pendingFilePaths.push(filePath)
  }
})

app.whenReady().then(() => {
  if (pendingFilePaths.length > 0) {
    pendingFilePaths.splice(0).forEach((filePath) => createWindow(filePath))
  } else {
    createWindow()
  }
  buildMenu()
})
