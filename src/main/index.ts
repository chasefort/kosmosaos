import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerWorkspaceHandlers } from './ipc/workspace.ipc'
import { registerGraphHandlers } from './ipc/graph.ipc'
import { registerRunsHandlers } from './ipc/runs.ipc'
import { registerIntegrationHandlers } from './ipc/integrations.ipc'
import { registerFileHandlers } from './ipc/files.ipc'
import { registerTerminalHandlers, killAllTerminals } from './ipc/terminal.ipc'
import { registerDashboardHandlers } from './ipc/dashboard.ipc'
import { registerV2Handlers } from './ipc/v2.ipc'
import { registerContextHandlers } from './ipc/context.ipc'
import { initDatabase } from './storage/db'
import { setBroadcast } from './ipc/broadcast'
import { flushLivePersistence } from './ipc/live-persist'

function createWindow(): BrowserWindow {
    // Load logo for window icon — resize to 1024×1024 and tag as @2x so macOS
    // displays it at 512pt (the correct dock icon size) instead of 1024pt.
    const iconPath = join(__dirname, '../../resources/icon.png')
    let windowIcon: Electron.NativeImage | undefined
    try {
        const img = nativeImage.createFromPath(iconPath)
        if (!img.isEmpty()) {
            const resized = img.resize({ width: 1024, height: 1024 })
            windowIcon = nativeImage.createFromBuffer(resized.toPNG(), { scaleFactor: 2.0 })
        }
    } catch { /* icon not yet present */ }

    const mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        show: false,
        frame: true,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 14, y: 14 },
        ...(windowIcon ? { icon: windowIcon } : {}),
        backgroundColor: '#0a0a0a',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR']
        if (level >= 2) {
            console.log(`[Renderer ${levels[level] || level}] ${message} (${sourceId}:${line})`)
        }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return mainWindow
}

function setupMacOSMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Kosmos',
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                {
                    label: 'Open Workspace',
                    accelerator: 'CmdOrCtrl+O',
                    click: (_item, focusedWindow) => {
                        focusedWindow?.webContents.send('trigger-open-workspace')
                    }
                },
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
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },

                {
                    label: 'Dashboard',
                    accelerator: 'CmdOrCtrl+0',
                    click: (_i, w) => (w as BrowserWindow)?.webContents.send('navigate', '/dashboard')
                },
                {
                    label: 'Universe Map',
                    accelerator: 'CmdOrCtrl+1',
                    click: (_i, w) => (w as BrowserWindow)?.webContents.send('navigate', '/universe')
                },
                {
                    label: 'Runs / Time Machine',
                    accelerator: 'CmdOrCtrl+2',
                    click: (_i, w) => (w as BrowserWindow)?.webContents.send('navigate', '/runs')
                },
                {
                    label: 'Health',
                    accelerator: 'CmdOrCtrl+3',
                    click: (_i, w) => (w as BrowserWindow)?.webContents.send('navigate', '/health')
                },
                {
                    label: 'Flow Chart',
                    accelerator: 'CmdOrCtrl+4',
                    click: (_i, w) => (w as BrowserWindow)?.webContents.send('navigate', '/flow')
                },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+5',
                    click: (_i, w) => (w as BrowserWindow)?.webContents.send('navigate', '/settings')
                }
            ]
        },
        { role: 'window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.kosmos.app')

    // Set the Kosmos logo as the macOS dock icon (and taskbar on Windows)
    const iconPath = join(__dirname, '../../resources/icon.png')
    try {
        const icon = nativeImage.createFromPath(iconPath)
        if (!icon.isEmpty()) {
            const resized = icon.resize({ width: 1024, height: 1024 })
            const dockIcon = nativeImage.createFromBuffer(resized.toPNG(), { scaleFactor: 2.0 })
            if (process.platform === 'darwin') app.dock?.setIcon(dockIcon)
        }
    } catch { /* icon file not yet present — no-op */ }

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    setBroadcast((channel, payload) => {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, payload))
    })

    try {
        initDatabase()
    } catch (e) {
        console.error('Failed to init database:', e)
    }

    registerWorkspaceHandlers(ipcMain)
    registerGraphHandlers(ipcMain)
    registerRunsHandlers(ipcMain)
    registerIntegrationHandlers(ipcMain)
    registerFileHandlers(ipcMain)
    registerTerminalHandlers(ipcMain)
    registerDashboardHandlers(ipcMain)
    registerV2Handlers(ipcMain)
    registerContextHandlers(ipcMain)

    setupMacOSMenu()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('before-quit', () => {
    flushLivePersistence()
    killAllTerminals()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
