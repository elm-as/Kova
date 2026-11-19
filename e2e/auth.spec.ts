import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('should show error for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]')
    // Toast should appear
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 3000 })
  })

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible()

    // Click the eye button
    await page.locator('button[aria-label]').filter({ hasText: '' }).first().click()
    await expect(page.locator('input[type="text"]').last()).toBeVisible()
  })

  test('should navigate to registration form', async ({ page }) => {
    // Click "Create company account" button
    const createButton = page.getByRole('button', { name: /créer|create|crear/i })
    await createButton.click()

    // Should see registration form
    await expect(page.locator('input[id="companyName"]')).toBeVisible({ timeout: 3000 })
  })

  test('should navigate to forgot password', async ({ page }) => {
    const forgotLink = page.getByRole('button', { name: /oublié|forgot|olvidaste/i })
    await forgotLink.click()

    await expect(page.locator('text=/réinitialiser|reset|restablecer/i')).toBeVisible({ timeout: 3000 })
  })
})
