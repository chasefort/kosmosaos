import { DOWNLOAD_URL } from '../config'

export function initDownloadButtons() {
  const btns = document.querySelectorAll<HTMLAnchorElement>('.js-download-btn')
  btns.forEach(btn => {
    btn.href = DOWNLOAD_URL
    btn.target = '_blank'
    btn.rel = 'noreferrer'
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Get Kosmos`
  })
}
