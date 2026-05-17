import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './styles/theme.css'
import { useAppStore } from './store/app.store'

declare global {
    interface Window {
        __KOSMOS_CAPTURE__?: {
            openFile: (path: string) => void
            closeFile: () => void
            openFileExplorer: () => void
            closeFileExplorer: () => void
        }
    }
}

async function init() {
    // In browser mode (npx kosmos-aos), window.api is not set by a preload script.
    // Import the HTTP/WebSocket shim that maps the same interface to the local server.
    if (!window.api) {
        await import('../../server/browser-api')
    }

    if (window.location.search.includes('capture=1')) {
        window.__KOSMOS_CAPTURE__ = {
            openFile: (path: string) => useAppStore.getState().setOpenFilePath(path),
            closeFile: () => useAppStore.getState().setOpenFilePath(null),
            openFileExplorer: () => useAppStore.getState().setFileExplorerOpen(true),
            closeFileExplorer: () => useAppStore.getState().setFileExplorerOpen(false),
        }
    }

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    )
}

init()
