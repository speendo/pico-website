import { test, expect } from '@playwright/test'

test.describe('App loads', () => {
  test('renders accordion sections from manifest', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('details#wifi')
    const sections = page.locator('details')
    await expect(sections).toHaveCount(2)
  })
})
