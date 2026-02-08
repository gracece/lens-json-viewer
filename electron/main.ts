import { app, BrowserWindow, dialog, Menu, ipcMain } from 'electron'
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

let win: BrowserWindow | null
let pendingFile: string | null = null
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
  return await readJsonFile(filePath)
})

ipcMain.handle('find-in-page', (_event, query: string, options?: Electron.FindInPageOptions) => {
  if (!win) return null
  return win.webContents.findInPage(query, options)
})

ipcMain.handle('stop-find-in-page', (_event, action: 'clearSelection' | 'keepSelection' | 'activateSelection' = 'clearSelection') => {
  if (!win) return null
  return win.webContents.stopFindInPage(action)
})

ipcMain.handle('set-locale', (_event, locale: string) => {
  currentLocale = locale
  buildMenu()
  return true
})

async function openJsonFile(targetPath?: string) {
  const filePath = targetPath ?? await selectJsonFile()
  if (!filePath) return

  if (!win) {
    pendingFile = filePath
    return
  }

  try {
    const payload = await readJsonFile(filePath)
    win.webContents.send('file-opened', payload)
  } catch (error) {
    dialog.showErrorBox('Open File Failed', error instanceof Error ? error.message : 'Unable to read file')
  }
}

async function selectJsonFile() {
  if (!win) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open JSON File - LensJsonViewer',
    properties: ['openFile'],
    filters: [
      { name: 'JSON', extensions: ['json', 'jsonl'] }
    ]
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
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
            win?.webContents.send('trigger-search')
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

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200,
    height: 800,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.on('closed', () => {
    win = null
  })

  win.webContents.on('found-in-page', (_event, result) => {
    win?.webContents.send('find-in-page-result', result)
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', async () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    if (pendingFile) {
      await openJsonFile(pendingFile)
      pendingFile = null
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
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
  openJsonFile(filePath)
})

app.whenReady().then(() => {
  createWindow()
  buildMenu()
})
