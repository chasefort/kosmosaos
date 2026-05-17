import './style.css'
import { inject } from '@vercel/analytics'
import { initGraph } from './graph/graph-engine'
import { initNarrative } from './graph/narrative'

inject()

document.addEventListener('DOMContentLoaded', () => {
  const isMobile = window.innerWidth < 768

  if (!isMobile) {
    const canvas = document.getElementById('graph-canvas') as HTMLCanvasElement | null
    if (canvas) {
      requestAnimationFrame(() => {
        initGraph(canvas)
      })
    }

    // Start narrative simulation
    initNarrative()
  }

  // "Get Kosmos" button opens the Download node panel
  const getKosmosBtn = document.getElementById('btn-get-kosmos')
  const mobileGetKosmosBtn = document.getElementById('m-get-kosmos')
  const openDownloadPanel = (e: Event) => {
    e.preventDefault()
    const event = new CustomEvent('kosmos:select-node', { detail: { nodeId: 'download' } })
    window.dispatchEvent(event)
  }
  if (getKosmosBtn) {
    getKosmosBtn.addEventListener('click', openDownloadPanel)
  }
  if (mobileGetKosmosBtn) {
    mobileGetKosmosBtn.addEventListener('click', openDownloadPanel)
  }

  // Mobile copy button
  const mCopyBtn = document.getElementById('m-copy-btn')
  if (mCopyBtn) {
    mCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('npx kosmos-aos').then(() => {
        mCopyBtn.textContent = 'Copied!'
        setTimeout(() => { mCopyBtn.textContent = 'Copy' }, 2000)
      })
    })
  }
})
