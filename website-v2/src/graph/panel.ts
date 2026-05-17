import { NODES, TYPE_COLORS, getPanelContent } from './nodes-data'
import { initDownloadButtons } from '../header/download'

let panelEl: HTMLElement | null = null
let bodyEl: HTMLElement | null = null
let dotEl: HTMLElement | null = null
let labelEl: HTMLElement | null = null
let titleEl: HTMLElement | null = null
let closeBtn: HTMLElement | null = null

// Callback provided by graph-engine so we avoid a circular import
let onCloseCb: () => void = () => {}

export function initPanel(onClose: () => void) {
  onCloseCb = onClose
  panelEl  = document.getElementById('panel')
  bodyEl   = document.getElementById('panel-body')
  dotEl    = document.getElementById('panel-type-dot')
  labelEl  = document.getElementById('panel-type-label')
  titleEl  = document.getElementById('panel-title')
  closeBtn = document.getElementById('panel-close')

  closeBtn?.addEventListener('click', () => onCloseCb())
}

export function openPanel(nodeId: string) {
  if (!panelEl || !bodyEl || !dotEl || !labelEl || !titleEl) return

  const node = NODES.find(n => n.id === nodeId)
  if (!node) return

  const color = TYPE_COLORS[node.type] ?? '#94a3b8'

  // Type badge
  dotEl.style.background = color
  dotEl.style.boxShadow = `0 0 6px ${color}`
  labelEl.textContent = node.type.replace(/_/g, ' ')
  labelEl.style.color = color
  labelEl.style.background = color + '1a'

  // Node name
  titleEl.textContent = node.label

  // Body content
  bodyEl.innerHTML = getPanelContent(nodeId)

  // Wire up any download buttons injected into panel
  initDownloadButtons()

  // Open
  panelEl.classList.remove('panel--closed')
  panelEl.classList.add('panel--open')
}

export function closePanel() {
  if (!panelEl) return
  panelEl.classList.remove('panel--open')
  panelEl.classList.add('panel--closed')
}
