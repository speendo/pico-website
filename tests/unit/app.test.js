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
