# Phase 2: TDD for Existing JS Implementation Plan (JS Stack)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vitest unit tests (direct function calls) and Playwright e2e tests (browser integration) that exercise all internal functions (`serialize`, `setBaseline`, `getPending`, `createField`, `populateFromComponents`, `applyAttrs`, `updateUI`, `showError`, `clearError`, `postJSON`, `loadManifest`, `loadComponents`, `refreshComponents`, `syncThen`, `handleSaveApply`, `handleApply`, `handleReset`, `renderNav`, `renderForm`, `handleHash`, `wireButtons`, `bindChangeListeners`, `init`).

**Architecture:** vitest + jsdom for unit tests (fast, no browser, direct function calls via a 1-line `__TEST_MODE` expose in `app.js`). `@playwright/test` for e2e tests (real browser, full integration with the test server). Python test tooling (pytest, pytest-playwright) is discarded — all new JS tests use the JS ecosystem.

**Tech Stack:** vitest, @playwright/test, jsdom

---

### File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `tests/setup.js` | vitest setup — loads app.js in jsdom with mocks | Create |
| `tests/unit/app.test.js` | Unit tests via vitest + jsdom | Create |
| `tests/e2e/app.test.js` | E2E tests via @playwright/test | Create |
| `vitest.config.js` | vitest configuration | Create |
| `playwright.config.js` | Playwright configuration | Create |
| `build.sh` | Terser build script with `--define` flag (removes test-expose dead code) | Create |
| `app.js` | Add 1-line `__TEST_MODE` expose before `})();` | Modify |
| `package.json` | Add devDependencies and test scripts | Modify |

(No changes to `app.min.js`, `test_server/`, or any HTML/CSS file.)

---

### Task 1: Install dependencies and create test infrastructure

**Files:**
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `tests/setup.js`
- Create: `tests/e2e/app.test.js` (skeleton)
- Modify: `package.json`
- Modify: `app.js`

- [ ] **Step 1: Install vitest and Playwright**

```bash
npm install --save-dev vitest @playwright/test
npx playwright install chromium
```

Expected: Packages installed, Chromium downloaded.

- [ ] **Step 2: Update package.json with test scripts**

Edit `package.json`:
```json
{
  "name": "pico-website",
  "private": true,
  "scripts": {
    "build": "terser app.js -o app.min.js -c -m --define window.__TEST_MODE=false",
    "test": "vitest run && playwright test",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "terser": "^5.0.0",
    "vitest": "^3.0.0",
    "@playwright/test": "^1.50.0"
  }
}
```

- [ ] **Step 3: Add test-expose line to app.js**

In `app.js`, insert one line before `})();` on line 400:

```js
  /* test-expose */if(window.__TEST_MODE){window.serialize=serialize;window.setBaseline=setBaseline;window.getPending=getPending;window.createField=createField;window.populateFromComponents=populateFromComponents;window.applyAttrs=applyAttrs;window.updateUI=updateUI;window.showError=showError;window.clearError=clearError;window.postJSON=postJSON;window.loadManifest=loadManifest;window.loadComponents=loadComponents;window.refreshComponents=refreshComponents;window.syncThen=syncThen;window.handleSaveApply=handleSaveApply;window.handleApply=handleApply;window.handleReset=handleReset;window.renderNav=renderNav;window.renderForm=renderForm;window.handleHash=handleHash;window.wireButtons=wireButtons;window.bindChangeListeners=bindChangeListeners;window.init=init;window.__test={};Object.defineProperty(window.__test,'components',{get:()=>components,set:v=>{components=v}});}
})();
```

This block is skipped in production (no `__TEST_MODE`). Gzipped overhead is ~50 bytes if Terser keeps it. **Build step must pass `--define window.__TEST_MODE=false` to Terser** to dead-code eliminate the block from `app.min.js` (see Task 7, Step 5).

- [ ] **Step 4: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
  },
})
```

- [ ] **Step 5: Create tests/setup.js**

```js
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Signal app.js IIFE to expose internal functions on window
window.__TEST_MODE = true

// Set up required DOM elements that app.js reads at init time
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

// Prevent real network requests during unit tests
window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })

// Load app.js in global scope so the IIFE executes and exposes functions
const code = readFileSync(resolve(__dirname, '../app.js'), 'utf-8')
;(0, eval)(code)
```

- [ ] **Step 6: Create playwright.config.js**

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8765',
  },
  webServer: {
    command: 'uvicorn test_server.main:app --host 127.0.0.1 --port 8765',
    port: 8765,
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 7: Create build.sh script**

Create `build.sh` to document and run the correct terser command:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Build app.min.js for ESP32 deployment.
# --define removes the __TEST_MODE test-expose dead code from the minified output.
# Use full path since this is a shell script (not an npm script with auto-PATH).
"$(npm root)"/.bin/terser app.js -o app.min.js -c -m --define window.__TEST_MODE=false
```

```bash
chmod +x build.sh
```

- [ ] **Step 8: Create e2e test skeleton**

Write `tests/e2e/app.test.js`:
```js
import { test, expect } from '@playwright/test'

test.describe('App loads', () => {
  test('renders accordion sections from manifest', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('details#wifi')
    const sections = page.locator('details')
    await expect(sections).toHaveCount(2)
  })
})
```

- [ ] **Step 9: Run both test suites to verify infrastructure**

```bash
npm run test:unit
npm run test:e2e
```

Expected: Unit test passes (fast, no browser). E2E test passes (Playwright opens Chromium, test server starts).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add vitest + Playwright test infrastructure"
```

---

### Task 2: Unit tests for serialize, setBaseline, getPending, updateUI

**Files:**
- Create: `tests/unit/app.test.js`

- [ ] **Step 1: Write test file**

Create `tests/unit/app.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'

describe('serialize', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = `
      <input name="wifi.ssid" value="" />
      <select name="wifi.mode">
        <option value="station" selected>Station</option>
        <option value="ap">AP</option>
      </select>
      <input type="checkbox" name="wifi.hidden" role="switch" />
      <input type="range" name="wifi.channel" value="6" min="1" max="13" />
    `
    window.__test.components = [
      { id: 'wifi', fields: [['ssid', 'text'], ['mode', 'select'], ['hidden', 'switch'], ['channel', 'range']] },
    ]
  })

  it('returns current form values', () => {
    const data = window.serialize()
    expect(data).toEqual({
      'wifi.ssid': '',
      'wifi.mode': 'station',
      'wifi.hidden': false,
      'wifi.channel': '6',
    })
  })

  it('returns updated values after input change', () => {
    document.querySelector('[name="wifi.ssid"]').value = 'MyNet'
    document.querySelector('[name="wifi.mode"]').value = 'ap'
    document.querySelector('[name="wifi.hidden"]').checked = true
    const data = window.serialize()
    expect(data).toEqual({
      'wifi.ssid': 'MyNet',
      'wifi.mode': 'ap',
      'wifi.hidden': true,
      'wifi.channel': '6',
    })
  })
})

describe('setBaseline / getPending', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = `
      <input name="wifi.ssid" value="" />
      <input name="wifi.channel" value="6" />
    `
    window.__test.components = [
      { id: 'wifi', fields: [['ssid', 'text'], ['channel', 'range']] },
    ]
    window.setBaseline()
  })

  it('getPending returns empty when nothing changed', () => {
    expect(window.getPending()).toEqual({})
  })

  it('getPending detects a changed field', () => {
    document.querySelector('[name="wifi.ssid"]').value = 'MyNet'
    expect(window.getPending()).toEqual({ 'wifi.ssid': 'MyNet' })
  })

  it('getPending returns empty after reverting', () => {
    document.querySelector('[name="wifi.ssid"]').value = 'Temp'
    expect(window.getPending()).toEqual({ 'wifi.ssid': 'Temp' })
    document.querySelector('[name="wifi.ssid"]').value = ''
    expect(window.getPending()).toEqual({})
  })

  it('getPending detects multiple changes', () => {
    document.querySelector('[name="wifi.ssid"]').value = 'Net'
    document.querySelector('[name="wifi.channel"]').value = '11'
    expect(window.getPending()).toEqual({ 'wifi.ssid': 'Net', 'wifi.channel': '11' })
  })
})

describe('updateUI', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = `
      <input name="wifi.ssid" value="" required />
    `
    window.__test.components = [
      { id: 'wifi', fields: [['ssid', 'text']] },
    ]
    window.setBaseline()
  })

  it('disables buttons when no pending changes', () => {
    window.updateUI()
    expect(document.getElementById('btn-apply').disabled).toBe(true)
    expect(document.getElementById('btn-reset').disabled).toBe(true)
    expect(document.getElementById('btn-save-apply').disabled).toBe(true)
  })

  it('enables buttons when changes exist and form is valid', () => {
    document.querySelector('[name="wifi.ssid"]').value = 'Net'
    window.updateUI()
    expect(document.getElementById('btn-apply').disabled).toBe(false)
  })

  it('updates pending count text', () => {
    document.querySelector('[name="wifi.ssid"]').value = 'Net'
    window.updateUI()
    expect(document.getElementById('pending-count').textContent).toBe('1 pending change(s)')
  })
})
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/app.test.js
git commit -m "test: unit tests for serialize/setBaseline/getPending/updateUI"
```

---

### Task 3: Unit tests for createField, applyAttrs, populateFromComponents

**Files:**
- Modify: `tests/unit/app.test.js`

- [ ] **Step 1: Add DOM function tests**

Append to `tests/unit/app.test.js`:
```js
describe('createField', () => {
  it('creates text input with attributes', () => {
    const field = window.createField('wifi', ['ssid', 'text', 'SSID', {
      attrs: { maxlength: '32', placeholder: 'MyNetwork' },
      tooltip: 'WiFi network name',
    }])
    expect(field.tagName).toBe('LABEL')
    const input = field.querySelector('input')
    expect(input.type).toBe('text')
    expect(input.name).toBe('wifi.ssid')
    expect(input.maxLength).toBe(32)
    expect(input.placeholder).toBe('MyNetwork')
  })

  it('creates select with options', () => {
    const field = window.createField('wifi', ['mode', 'select', 'Mode', {
      options: [['station', 'Station'], ['ap', 'AP']],
      default: 'station',
    }])
    const select = field.querySelector('select')
    expect(select.options.length).toBe(2)
    expect(select.options[0].value).toBe('station')
    expect(select.options[1].value).toBe('ap')
    expect(select.value).toBe('station')
  })

  it('creates switch (checkbox with role)', () => {
    const field = window.createField('wifi', ['hidden', 'switch', 'Hidden', {
      attrs: { role: 'switch' },
      default: true,
    }])
    const input = field.querySelector('input')
    expect(input.type).toBe('checkbox')
    expect(input.role).toBe('switch')
    expect(input.checked).toBe(true)
  })

  it('creates range with output display', () => {
    const field = window.createField('wifi', ['channel', 'range', 'Channel', {
      attrs: { min: '1', max: '13', step: '1' },
      default: '6',
    }])
    expect(field.querySelector('input[type="range"]')).not.toBeNull()
    expect(field.querySelector('output')).not.toBeNull()
  })

  it('creates number input', () => {
    const field = window.createField('gpio', ['pin', 'number', 'Pin', {
      attrs: { min: '0', max: '39' },
      default: '2',
    }])
    const input = field.querySelector('input[type="number"]')
    expect(input.min).toBe('0')
    expect(input.max).toBe('39')
    expect(input.value).toBe('2')
  })

  it('creates radio group', () => {
    const field = window.createField('gpio', ['pull', 'radio', 'Pull', {
      options: [['none', 'None'], ['up', 'Up'], ['down', 'Down']],
      default: 'none',
    }])
    expect(field.tagName).toBe('FIELDSET')
    const radios = field.querySelectorAll('input[type="radio"]')
    expect(radios.length).toBe(3)
    expect(radios[0].value).toBe('none')
    expect(radios[1].value).toBe('up')
    expect(radios[2].value).toBe('down')
  })

  it('sets tooltip attribute on label', () => {
    const field = window.createField('wifi', ['ssid', 'text', 'SSID', {
      tooltip: 'Network name',
    }])
    expect(field.getAttribute('data-tooltip')).toBe('Network name')
  })

  it('returns null for invalid field spec', () => {
    expect(window.createField('x', [])).toBeNull()
    expect(window.createField('x', ['k', 'unknown', 'L'])).toBeNull()
  })
})

describe('applyAttrs', () => {
  it('sets multiple attributes on an element', () => {
    const el = document.createElement('input')
    window.applyAttrs(el, { maxlength: '32', placeholder: 'Name', min: '0' })
    expect(el.getAttribute('maxlength')).toBe('32')
    expect(el.getAttribute('placeholder')).toBe('Name')
    expect(el.getAttribute('min')).toBe('0')
  })

  it('handles null/undefined attrs gracefully', () => {
    const el = document.createElement('input')
    expect(() => window.applyAttrs(el, null)).not.toThrow()
    expect(() => window.applyAttrs(el, undefined)).not.toThrow()
  })
})

describe('populateFromComponents', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = `
      <input name="wifi.ssid" value="old" />
      <select name="wifi.mode">
        <option value="station">Station</option>
        <option value="ap" selected>AP</option>
      </select>
      <input type="checkbox" name="wifi.hidden" role="switch" />
    `
  })

  it('sets form values from components data', () => {
    window.populateFromComponents([
      {
        id: 'wifi',
        fields: [
          ['ssid', 'text', 'SSID', { default: 'new-ssid' }],
          ['mode', 'select', 'Mode', { default: 'station' }],
          ['hidden', 'switch', 'Hidden', { default: false }],
        ],
      },
    ])
    expect(document.querySelector('[name="wifi.ssid"]').value).toBe('new-ssid')
    expect(document.querySelector('[name="wifi.mode"]').value).toBe('station')
    expect(document.querySelector('[name="wifi.hidden"]').checked).toBe(false)
  })

  it('handles empty fields gracefully', () => {
    expect(() => window.populateFromComponents([])).not.toThrow()
    expect(() => window.populateFromComponents([{ id: 'x' }])).not.toThrow()
  })
})
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/app.test.js
git commit -m "test: unit tests for createField/applyAttrs/populateFromComponents"
```

---

### Task 4: Unit tests for remaining internal functions

**Files:**
- Modify: `tests/unit/app.test.js`

- [ ] **Step 1: Add tests for all remaining internal functions**

Append to `tests/unit/app.test.js`:
```js
describe('showError / clearError', () => {
  beforeEach(() => {
    const sb = document.getElementById('status-bar')
    sb.textContent = ''
    sb.style.color = ''
  })

  it('showError sets status bar text and red color', () => {
    window.showError('Something failed')
    expect(document.getElementById('status-bar').textContent).toBe('Something failed')
    expect(document.getElementById('status-bar').style.color).toBe('var(--pico-color-red)')
  })

  it('clearError resets status bar', () => {
    window.showError('Error')
    window.clearError()
    expect(document.getElementById('status-bar').textContent).toBe('')
    expect(document.getElementById('status-bar').style.color).toBe('')
  })
})

describe('postJSON', () => {
  beforeEach(() => {
    document.getElementById('status-bar').textContent = ''
  })

  it('sends POST with JSON body and returns true on success', async () => {
    let captured
    window.fetch = (url, opts) => {
      captured = { url, opts }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    const result = await window.postJSON('/api/apply', { key: 'val' })
    expect(result).toBe(true)
    expect(captured.url).toBe('/api/apply')
    expect(captured.opts.method).toBe('POST')
    expect(captured.opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(captured.opts.body)).toEqual({ key: 'val' })
  })

  it('returns false and shows error on HTTP error', async () => {
    window.fetch = () => Promise.resolve({ ok: false, status: 400 })
    const result = await window.postJSON('/api/apply', {})
    expect(result).toBe(false)
    expect(document.getElementById('status-bar').textContent).toContain('Request failed')
  })

  it('returns false and shows error on network failure', async () => {
    window.fetch = () => Promise.reject(new Error('Network error'))
    const result = await window.postJSON('/api/apply', {})
    expect(result).toBe(false)
    expect(document.getElementById('status-bar').textContent).toContain('Request failed')
  })

  it('returns false and shows error on response error field', async () => {
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: 'Bad data' }) })
    const result = await window.postJSON('/api/apply', {})
    expect(result).toBe(false)
    expect(document.getElementById('status-bar').textContent).toContain('Request failed')
  })
})

describe('loadManifest', () => {
  beforeEach(() => {
    window.__test.components = []
    document.getElementById('status-bar').textContent = ''
  })

  it('loads manifest and sets components on success', async () => {
    window.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ id: 'wifi', label: 'WiFi', file: 'wifi.json' }]),
    })
    const result = await window.loadManifest()
    expect(result).toBe(true)
    expect(window.__test.components).toEqual([{ id: 'wifi', label: 'WiFi', file: 'wifi.json' }])
  })

  it('shows error on 404', async () => {
    window.fetch = () => Promise.resolve({ ok: false, status: 404 })
    const result = await window.loadManifest()
    expect(result).toBe(false)
    expect(document.getElementById('status-bar').textContent).toContain('Failed to load manifest')
  })

  it('shows error on network failure', async () => {
    window.fetch = () => Promise.reject(new Error('Network error'))
    const result = await window.loadManifest()
    expect(result).toBe(false)
    expect(document.getElementById('status-bar').textContent).toContain('Failed to load manifest')
  })
})

describe('loadComponents', () => {
  beforeEach(() => {
    window.__test.components = [
      { id: 'wifi', label: 'WiFi', file: 'wifi.json' },
      { id: 'gpio', label: 'GPIO', file: 'gpio.json' },
    ]
    document.getElementById('status-bar').textContent = ''
  })

  it('loads all component JSON files', async () => {
    const responses = {
      'wifi.json': [{ key: 'ssid', type: 'text' }],
      'gpio.json': [{ key: 'pin', type: 'number' }],
    }
    window.fetch = (url) => {
      const file = url.replace(/^\//, '')
      return Promise.resolve({ ok: true, json: () => Promise.resolve(responses[file]) })
    }
    await window.loadComponents()
    expect(window.__test.components[0].fields).toEqual([{ key: 'ssid', type: 'text' }])
    expect(window.__test.components[1].fields).toEqual([{ key: 'pin', type: 'number' }])
  })

  it('skips failed component and shows warning', async () => {
    window.fetch = (url) => {
      if (url === '/gpio.json') return Promise.resolve({ ok: false, status: 404 })
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    }
    await window.loadComponents()
    expect(window.__test.components.length).toBe(1)
    expect(window.__test.components[0].id).toBe('wifi')
    expect(document.getElementById('status-bar').textContent).toContain('Skipped')
  })

  it('handles all components failing', async () => {
    window.fetch = () => Promise.resolve({ ok: false, status: 404 })
    await window.loadComponents()
    expect(window.__test.components.length).toBe(0)
  })
})

describe('renderNav', () => {
  beforeEach(() => {
    document.getElementById('nav-list').innerHTML = ''
    window.__test.components = [
      { id: 'wifi', label: 'WiFi Configuration' },
      { id: 'gpio', label: 'GPIO Settings' },
    ]
  })

  it('renders nav links for each component', () => {
    window.renderNav()
    const links = document.querySelectorAll('#nav-list a')
    expect(links.length).toBe(2)
    expect(links[0].textContent).toBe('WiFi Configuration')
    expect(links[0].getAttribute('href')).toBe('#wifi')
    expect(links[1].textContent).toBe('GPIO Settings')
    expect(links[1].getAttribute('href')).toBe('#gpio')
  })
})

describe('renderForm', () => {
  beforeEach(() => {
    document.getElementById('config-form').innerHTML = ''
    window.__test.components = [
      {
        id: 'wifi',
        label: 'WiFi Configuration',
        fields: [['ssid', 'text', 'SSID', { tooltip: 'Network name' }]],
      },
    ]
  })

  it('renders accordion details for each component', () => {
    window.renderForm()
    const details = document.querySelector('#config-form details')
    expect(details).not.toBeNull()
    expect(details.id).toBe('wifi')
    expect(details.querySelector('summary').textContent).toBe('WiFi Configuration')
  })

  it('renders fields inside accordion', () => {
    window.renderForm()
    const input = document.querySelector('#config-form input[name="wifi.ssid"]')
    expect(input).not.toBeNull()
  })
})

describe('handleHash', () => {
  beforeEach(() => {
    const el = document.createElement('details')
    el.id = 'test-section'
    el.innerHTML = '<summary>Test</summary>'
    document.body.appendChild(el)
  })

  it('opens details section matching location hash', () => {
    location.hash = '#test-section'
    window.handleHash()
    expect(document.getElementById('test-section').open).toBe(true)
  })
})

describe('wireButtons / bindChangeListeners', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = `
      <input name="wifi.ssid" value="" />
    `
    window.__test.components = [{ id: 'wifi', fields: [['ssid', 'text']] }]
    window.setBaseline()
  })

  it('wireButtons attaches click handler to btn-apply', async () => {
    document.querySelector('[name="wifi.ssid"]').value = 'changed'
    window.fetch = (url, opts) => {
      if (opts && opts.method === 'POST') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve([['ssid', 'text', 'SSID']]) })
    }
    window.wireButtons()
    document.getElementById('btn-apply').click()
    await new Promise(r => setTimeout(r, 0))
    expect(window.getPending()).toEqual({})
  })

  it('bindChangeListeners triggers updateUI on input event', () => {
    window.bindChangeListeners()
    document.querySelector('[name="wifi.ssid"]').value = 'changed'
    document.querySelector('[name="wifi.ssid"]').dispatchEvent(new Event('input', { bubbles: true }))
    expect(document.getElementById('pending-count').textContent).toBe('1 pending change(s)')
  })

  it('bindChangeListeners triggers updateUI on change event', () => {
    window.bindChangeListeners()
    document.querySelector('[name="wifi.ssid"]').value = 'changed'
    document.querySelector('[name="wifi.ssid"]').dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.getElementById('pending-count').textContent).toBe('1 pending change(s)')
  })
})

describe('refreshComponents', () => {
  beforeEach(() => {
    window.__test.components = [
      { id: 'wifi', label: 'WiFi', file: 'wifi.json' },
    ]
    document.getElementById('status-bar').textContent = ''
  })

  it('fetches each component file and sets fields', async () => {
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([['ssid', 'text', 'SSID']]) })
    await window.refreshComponents()
    expect(window.__test.components[0].fields).toEqual([['ssid', 'text', 'SSID']])
  })

  it('shows error on fetch failure', async () => {
    window.fetch = () => Promise.resolve({ ok: false, status: 404 })
    await window.refreshComponents()
    expect(document.getElementById('status-bar').textContent).toContain('Failed to refresh')
  })
})

describe('syncThen', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = '<input name="wifi.ssid" value="old" />'
    window.__test.components = [{ id: 'wifi', fields: [['ssid', 'text', 'SSID', { default: 'new' }]] }]
    window.setBaseline()
    document.getElementById('status-bar').textContent = 'old error'
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([['ssid', 'text', 'SSID', { default: 'new' }]]) })
  })

  it('with true repopulates, resets baseline, clears error', async () => {
    window.syncThen(true)
    await new Promise(r => setTimeout(r, 0))
    expect(document.querySelector('[name="wifi.ssid"]').value).toBe('new')
    expect(window.getPending()).toEqual({})
    expect(document.getElementById('status-bar').textContent).toBe('')
  })

  it('with false does not repopulate but resets baseline', async () => {
    window.syncThen(false)
    await new Promise(r => setTimeout(r, 0))
    expect(document.querySelector('[name="wifi.ssid"]').value).toBe('old')
    expect(window.getPending()).toEqual({})
  })
})

describe('handleApply', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = '<input name="wifi.ssid" value="" />'
    window.__test.components = [{ id: 'wifi', fields: [['ssid', 'text', 'SSID']] }]
    window.setBaseline()
  })

  it('sends pending changes to /api/apply and clears pending on success', async () => {
    let postedUrl = null
    let postedData = null
    let fetchCount = 0
    window.fetch = (url, opts) => {
      fetchCount++
      if (opts && opts.method === 'POST') {
        postedUrl = url
        postedData = JSON.parse(opts.body)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    }
    document.querySelector('[name="wifi.ssid"]').value = 'changed'
    expect(Object.keys(window.getPending()).length).toBeGreaterThan(0)
    window.handleApply()
    await new Promise(r => setTimeout(r, 0))
    expect(postedUrl).toBe('/api/apply')
    expect(postedData).toEqual({ 'wifi.ssid': 'changed' })
    expect(window.getPending()).toEqual({})
  })

  it('does nothing when no pending changes', () => {
    window.fetch = () => { throw new Error('should not be called') }
    expect(() => window.handleApply()).not.toThrow()
  })
})

describe('handleSaveApply', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = '<input name="wifi.ssid" value="" />'
    window.__test.components = [{ id: 'wifi', fields: [['ssid', 'text', 'SSID']] }]
    window.setBaseline()
  })

  it('sends pending changes to /api/save', async () => {
    let postedUrl = null
    window.fetch = (url, opts) => {
      if (opts && opts.method === 'POST') {
        postedUrl = url
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    }
    document.querySelector('[name="wifi.ssid"]').value = 'saved'
    window.handleSaveApply()
    await new Promise(r => setTimeout(r, 0))
    expect(postedUrl).toBe('/api/save')
  })
})

describe('handleReset', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = '<input name="wifi.ssid" value="baseline" />'
    window.__test.components = [{ id: 'wifi', fields: [['ssid', 'text', 'SSID', { default: 'baseline' }]] }]
    window.setBaseline()
    document.getElementById('status-bar').textContent = 'some error'
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([['ssid', 'text', 'SSID', { default: 'baseline' }]]) })
  })

  it('clears error and resets form to baseline', async () => {
    document.querySelector('[name="wifi.ssid"]').value = 'dirty'
    expect(Object.keys(window.getPending()).length).toBeGreaterThan(0)
    window.handleReset()
    await new Promise(r => setTimeout(r, 0))
    expect(document.querySelector('[name="wifi.ssid"]').value).toBe('baseline')
    expect(window.getPending()).toEqual({})
    expect(document.getElementById('status-bar').textContent).toBe('')
  })
})

describe('init', () => {
  beforeEach(() => {
    document.getElementById('nav-list').innerHTML = ''
    document.getElementById('config-form').innerHTML = ''
    document.getElementById('status-bar').textContent = ''
  })

  it('loads manifest and components, renders UI, sets baseline', async () => {
    let callCount = 0
    window.fetch = (url) => {
      callCount++
      if (url === '/manifest.json') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'wifi', label: 'WiFi', file: 'wifi.json' }]),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([['ssid', 'text', 'SSID', { tooltip: 'Net name' }]]),
      })
    }
    await window.init()
    expect(document.getElementById('nav-list').querySelectorAll('a').length).toBe(1)
    expect(document.querySelector('#config-form details')).not.toBeNull()
    expect(document.querySelector('[name="wifi.ssid"]')).not.toBeNull()
    expect(window.getPending()).toEqual({})
    expect(document.getElementById('status-bar').textContent).toBe('')
  })
})
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/app.test.js
git commit -m "test: unit tests for all remaining internal functions"
```

---

### Task 5: E2E tests for form rendering and initial values

**Files:**
- Create: `tests/e2e/app.test.js` (overwrite skeleton)

- [ ] **Step 1: Write form rendering and initial value tests**

Write `tests/e2e/app.test.js`:
```js
import { test, expect } from '@playwright/test'

test.describe('Form rendering', () => {
  test('renders accordion sections from manifest', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('details#wifi')
    const sections = page.locator('details')
    await expect(sections).toHaveCount(2)
    await expect(page.locator('details#wifi summary')).toHaveText('WiFi Configuration')
    await expect(page.locator('details#gpio summary')).toHaveText('GPIO Settings')
  })

  test('text input renders with correct attributes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[name="wifi.ssid"]')
    const ssid = page.locator('[name="wifi.ssid"]')
    await expect(ssid).toHaveAttribute('type', 'text')
    await expect(ssid).toHaveAttribute('maxlength', '32')
    await expect(ssid).toHaveAttribute('placeholder', 'MyNetwork')
  })

  test('select renders with options', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[name="wifi.mode"]')
    const options = page.locator('[name="wifi.mode"] option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toHaveValue('station')
    await expect(options.nth(1)).toHaveValue('ap')
  })

  test('switch renders correctly', async ({ page }) => {
    await page.goto('/')
    const sw = page.locator('[name="wifi.hidden"]')
    await expect(sw).toHaveAttribute('type', 'checkbox')
    await expect(sw).toHaveAttribute('role', 'switch')
  })

  test('range renders with output', async ({ page }) => {
    await page.goto('/')
    const channel = page.locator('[name="wifi.channel"]')
    await expect(channel).toHaveAttribute('type', 'range')
    await expect(channel).toHaveAttribute('min', '1')
    await expect(channel).toHaveAttribute('max', '13')
    await expect(channel).toHaveAttribute('step', '1')
  })

  test('radio group renders', async ({ page }) => {
    await page.goto('/')
    const radios = page.locator('[name="gpio.pull"]')
    await expect(radios).toHaveCount(3)
    await expect(radios.nth(0)).toHaveValue('none')
    await expect(radios.nth(1)).toHaveValue('up')
    await expect(radios.nth(2)).toHaveValue('down')
  })

  test('labels include tooltips', async ({ page }) => {
    await page.goto('/')
    const ssidLabel = page.locator('label').filter({ hasText: 'SSID' })
    await expect(ssidLabel).toHaveAttribute('data-tooltip', 'WiFi network name')
  })

  test('nav links render for each component', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#nav-list a')
    const links = page.locator('#nav-list a')
    await expect(links).toHaveCount(2)
    await expect(links.nth(0)).toHaveAttribute('href', '#wifi')
    await expect(links.nth(1)).toHaveAttribute('href', '#gpio')
  })
})

test.describe('Initial values', () => {
  test('text input default is empty', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="wifi.ssid"]')).toHaveValue('')
  })

  test('select default is station', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="wifi.mode"]')).toHaveValue('station')
  })

  test('switch default is unchecked', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="wifi.hidden"]')).not.toBeChecked()
  })

  test('range default is 6', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="wifi.channel"]')).toHaveValue('6')
  })

  test('number default is 2', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="gpio.pin"]')).toHaveValue('2')
  })

  test('radio default is none', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="gpio.pull"][value="none"]')).toBeChecked()
  })

  test('no pending changes initially', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#pending-count')).toHaveText('')
    await expect(page.locator('#btn-apply')).toBeDisabled()
    await expect(page.locator('#btn-reset')).toBeDisabled()
    await expect(page.locator('#btn-save-apply')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run e2e tests**

```bash
npm run test:e2e
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/app.test.js
git commit -m "test: e2e form rendering and initial value tests"
```

---

### Task 6: E2E tests for pending detection and button actions

**Files:**
- Modify: `tests/e2e/app.test.js`

- [ ] **Step 1: Add pending detection tests**

Append to `tests/e2e/app.test.js`:
```js
test.describe('Pending detection', () => {
  test('changing text shows pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('MyNetwork')
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
  })

  test('restoring value clears pending', async ({ page }) => {
    await page.goto('/')
    const ssid = page.locator('[name="wifi.ssid"]')
    await ssid.fill('MyNetwork')
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
    await ssid.fill('')
    await expect(page.locator('#pending-count')).toHaveText('')
  })

  test('changing switch triggers pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.hidden"]').check()
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
  })

  test('changing select triggers pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.mode"]').selectOption('ap')
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
  })

  test('changing range triggers pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.channel"]').fill('11')
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
  })

  test('multiple changes show correct count', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('MyNet')
    await page.locator('[name="wifi.mode"]').selectOption('ap')
    await expect(page.locator('#pending-count')).toHaveText('2 pending change(s)')
  })

  test('changing radio triggers pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="gpio.pull"]').nth(1).check()
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
  })

  test('switch toggle and revert clears pending', async ({ page }) => {
    await page.goto('/')
    const sw = page.locator('[name="wifi.hidden"]')
    await sw.check()
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
    await sw.uncheck()
    await expect(page.locator('#pending-count')).toHaveText('')
  })

  test('radio change and revert clears pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="gpio.pull"][value="up"]').check()
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
    await page.locator('[name="gpio.pull"][value="none"]').check()
    await expect(page.locator('#pending-count')).toHaveText('')
  })
})
```

- [ ] **Step 2: Add button action tests**

Append to `tests/e2e/app.test.js`:
```js
test.describe('Button actions', () => {
  test('apply clears pending', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('TestNet')
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await expect(page.locator('#pending-count')).toHaveText('')
  })

  test('apply then reset returns to design-time defaults', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('PersistentNet')
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await page.locator('#btn-reset').click()
    await page.waitForTimeout(500)
    // reset runs refreshComponents + populateFromComponents, which load
    // static component JSON files — the form returns to design-time defaults.
    // On the real ESP32, this endpoint would return NVS-backed values.
    await expect(page.locator('[name="wifi.ssid"]')).toHaveValue('')
  })

  test('reset after apply reverts to design-time defaults', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('StableNet')
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await page.locator('[name="wifi.ssid"]').fill('LocalChange')
    await expect(page.locator('#pending-count')).toHaveText('1 pending change(s)')
    await page.locator('#btn-reset').click()
    await page.waitForTimeout(500)
    await expect(page.locator('[name="wifi.ssid"]')).toHaveValue('')
    await expect(page.locator('#pending-count')).toHaveText('')
  })

  test('save and apply then reload shows design-time defaults', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('SavedNet')
    await page.locator('#btn-save-apply').click()
    await page.waitForTimeout(500)
    await page.reload()
    await page.waitForSelector('details#wifi')
    // The test server serves static component JSON, so after reload the
    // form is populated from design-time defaults (ssid default is '').
    // On the real ESP32, the component endpoint would return NVS-backed
    // defaults, making this truly test persistence across reboot.
    await expect(page.locator('[name="wifi.ssid"]')).toHaveValue('')
  })
})
```

- [ ] **Step 3: Run e2e tests**

```bash
npm run test:e2e
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app.test.js
git commit -m "test: e2e pending detection and button action tests"
```

---

### Task 7: E2E tests for nav, hash, error states, edge cases

**Files:**
- Modify: `tests/e2e/app.test.js`

- [ ] **Step 1: Add navigation and hash tests**

Append to `tests/e2e/app.test.js`:
```js
test.describe('Navigation and hash', () => {
  test('nav click opens accordion', async ({ page }) => {
    await page.goto('/')
    await page.locator('#nav-list a[href="#gpio"]').click()
    await expect(page.locator('details#gpio')).toHaveAttribute('open', '')
  })

  test('url hash opens section', async ({ page }) => {
    await page.goto('/#gpio')
    await page.waitForSelector('details#gpio')
    await expect(page.locator('details#gpio')).toHaveAttribute('open', '')
  })
})
```

- [ ] **Step 2: Add error state tests using route interception**

Append to `tests/e2e/app.test.js`:
```js
test.describe('Error states', () => {
  test('manifest failure shows error', async ({ page }) => {
    await page.route('**/manifest.json', route => route.fulfill({ status: 404 }))
    await page.goto('/')
    await page.waitForSelector('#status-bar')
    await expect(page.locator('#status-bar')).toContainText('Failed to load manifest')
  })

  test('manifest failure renders no form', async ({ page }) => {
    await page.route('**/manifest.json', route => route.fulfill({ status: 404 }))
    await page.goto('/')
    await expect(page.locator('details')).toHaveCount(0)
  })

  test('component load failure shows warning', async ({ page }) => {
    await page.route('**/components/gpio.json', route => route.fulfill({ status: 404 }))
    await page.goto('/')
    await expect(page.locator('#status-bar')).toContainText('Skipped')
  })

  test('component load failure renders partial form', async ({ page }) => {
    await page.route('**/components/gpio.json', route => route.fulfill({ status: 404 }))
    await page.goto('/')
    await expect(page.locator('details#wifi')).toHaveCount(1)
    await expect(page.locator('details#gpio')).toHaveCount(0)
  })

  test('post error shows in status bar', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('Test')
    await page.route('**/api/apply', route => route.fulfill({ status: 400, body: 'Invalid' }))
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await expect(page.locator('#status-bar')).toContainText('Request failed')
  })

  test('subsequent success clears error', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('Test')
    await page.route('**/api/apply', route => route.fulfill({ status: 400, body: 'Invalid' }))
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await expect(page.locator('#status-bar')).toContainText('Request failed')
    await page.unroute('**/api/apply')
    await page.locator('[name="wifi.ssid"]').fill('Test2')
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await expect(page.locator('#status-bar')).toHaveText('')
  })
})
```

- [ ] **Step 3: Add edge case tests**

Append to `tests/e2e/app.test.js`:
```js
test.describe('Edge cases', () => {
  test('invalid number does not enable buttons', async ({ page }) => {
    await page.goto('/')
    const pin = page.locator('[name="gpio.pin"]')
    await pin.fill('999')
    await expect(page.locator('#btn-apply')).toBeDisabled()
  })

  test('range output displays live value', async ({ page }) => {
    await page.goto('/')
    const channel = page.locator('[name="wifi.channel"]')
    const output = page.locator('output')
    await expect(output).toHaveText('6')
    await channel.fill('11')
    await expect(output).toHaveText('11')
  })

  test('multiple fields then apply', async ({ page }) => {
    await page.goto('/')
    await page.locator('[name="wifi.ssid"]').fill('Net')
    await page.locator('[name="wifi.channel"]').fill('11')
    await page.locator('[name="gpio.pin"]').fill('5')
    await expect(page.locator('#pending-count')).toHaveText('3 pending change(s)')
    await page.locator('#btn-apply').click()
    await page.waitForTimeout(500)
    await expect(page.locator('#pending-count')).toHaveText('')
  })

  test('form has expected field count', async ({ page }) => {
    await page.goto('/')
    const wifiFields = page.locator('details#wifi label, details#wifi fieldset')
    const gpioFields = page.locator('details#gpio label, details#gpio fieldset')
    await expect(wifiFields).toHaveCount(5)
    await expect(gpioFields).toHaveCount(4)
  })
})
```

- [ ] **Step 4: Run e2e tests**

```bash
npm run test:e2e
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/app.test.js
git commit -m "test: e2e nav, hash, error states, edge cases"
```

---

### Task 8: Full test suite and verification

- [ ] **Step 1: Run full unit test suite**

```bash
npm run test:unit
```

Expected: All PASS.

- [ ] **Step 2: Run full e2e test suite**

```bash
npm run test:e2e
```

Expected: All PASS.

- [ ] **Step 3: Run both suites together**

```bash
npm test
```

Expected: Both suites PASS.

- [ ] **Step 4: Verify app.js diff is minimal**

```bash
git diff app.js
```

Expected: Only the expose line added.

- [ ] **Step 5: Build minified app via build.sh**

Build uses `build.sh` (created in Task 1) which passes `--define window.__TEST_MODE=false` to Terser:

```bash
./build.sh
```

Also update `package.json` build script to match:

```json
"build": "./build.sh"
```

Run and verify:

```bash
npm run build
```

Expected: `app.min.js` produced. Verify the test-expose block is eliminated:

```bash
rg 'TEST_MODE' app.min.js  # should output nothing — dead code stripped
```

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: complete JS TDD with vitest unit tests + Playwright e2e"
```

---

### Self-Review

**1. Spec coverage:**
- Unit tests (direct function calls): Tasks 2-4 test all internal functions directly:
  - Task 2: `serialize`, `setBaseline`, `getPending`, `updateUI`
  - Task 3: `createField`, `applyAttrs`, `populateFromComponents`
  - Task 4: `showError`, `clearError`, `postJSON`, `loadManifest`, `loadComponents`, `refreshComponents`, `syncThen`, `handleSaveApply`, `handleApply`, `handleReset`, `renderNav`, `renderForm`, `handleHash`, `wireButtons`, `bindChangeListeners`, `init`
- E2E (browser integration): Tasks 5-7 cover form rendering, initial values, pending detection, button actions, nav/hash, error states, and edge cases through the real browser
- E2E button tests were corrected to match actual behavior: `refreshComponents` loads static component JSON, so reset/reload returns to *design-time defaults*, not the last applied state. On the real ESP32, the component endpoint would return NVS-backed values, making reset/reload truly restore applied state.
- Every internal function is exercised both directly (unit) and indirectly (e2e)
- Zero changes to `app.min.js`, `test_server/`, HTML, or CSS

**2. Placeholder scan:** All code blocks contain complete implementation. No "TBD", "TODO", or missing patterns.

**3. Type consistency:** Function names, DOM query patterns, field spec format, and attribute names consistent across all tasks. The expose block on `window` lists all 23 internal functions plus a `window.__test.components` getter/setter — identical to the names used inside the IIFE. Tests use `window.__test.components` to set or assert the closure's private `components` variable.
