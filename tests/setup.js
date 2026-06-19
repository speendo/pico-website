import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

window.__TEST_MODE = true

document.body.innerHTML = `
  <nav id="nav-list"></nav>
  <form id="config-form"></form>
  <div id="status-bar"></div>
  <footer></footer>
  <button id="btn-save-apply"></button>
  <button id="btn-apply"></button>
  <button id="btn-reset"></button>
  <span id="pending-count"></span>
`

window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })

const code = readFileSync(resolve(__dirname, '../app.js'), 'utf-8')
;(0, eval)(code)
