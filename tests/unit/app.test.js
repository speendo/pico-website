import { describe, it, expect } from 'vitest'

describe('infrastructure', () => {
  it('jsdom and vitest are working', () => {
    expect(document).toBeDefined()
    expect(window.__TEST_MODE).toBe(true)
  })
})
