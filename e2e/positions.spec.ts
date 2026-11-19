import { test, expect } from '@playwright/test'

/**
 * These tests require a logged-in session. We seed via localStorage
 * before each test.
 */

const SEED_COMPANY = {
  id: 'e2e-company',
  name: 'E2E Corp',
  email: 'admin@e2e.test',
  createdAt: Date.now(),
  license: {
    type: 'enterprise',
    maxUsers: 50,
    maxPositions: -1,
    maxCandidatesPerPosition: -1,
    features: {
      bulkOperations: true,
      advancedAnalytics: true,
      emailTemplates: true,
      apiAccess: true,
      customBranding: true,
    },
    startDate: Date.now(),
    expiryDate: Date.now() + 365 * 86400000,
    isActive: true,
  },
  subscription: {
    status: 'active',
    currentPeriodEnd: Date.now() + 30 * 86400000,
    cancelAtPeriodEnd: false,
  },
}

const SEED_USER = {
  id: 'e2e-user',
  companyId: 'e2e-company',
  name: 'Admin E2E',
  email: 'admin@e2e.test',
  passwordHash: '$2a$10$fakeHashForE2E',
  role: 'owner',
  createdAt: Date.now(),
}

const SEED_SESSION = {
  companyId: 'e2e-company',
  userId: 'e2e-user',
  loggedInAt: Date.now(),
}

test.describe('Position Management', () => {
  test.beforeEach(async ({ page }) => {
    // Seed localStorage before navigating
    await page.addInitScript((data) => {
      localStorage.setItem('ats:auth-session', JSON.stringify(data.session))
      localStorage.setItem('ats:companies', JSON.stringify([data.company]))
      localStorage.setItem('ats:users', JSON.stringify([data.user]))
      localStorage.setItem('ats:positions', JSON.stringify([]))
      localStorage.setItem('ats:candidates', JSON.stringify([]))
      localStorage.setItem('ats:language', 'en')
    }, { session: SEED_SESSION, company: SEED_COMPANY, user: SEED_USER })

    await page.goto('/')
    // Wait for the app to load
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
  })

  test('should display dashboard on login', async ({ page }) => {
    await expect(page.getByText(/dashboard|tableau de bord/i)).toBeVisible()
  })

  test('should navigate to positions tab', async ({ page }) => {
    await page.click('[value="positions"]')
    await expect(page.getByText(/no positions|aucun poste/i)).toBeVisible({ timeout: 5000 })
  })

  test('should open create position dialog', async ({ page }) => {
    await page.click('[value="positions"]')
    await page.waitForTimeout(500)

    // Click "New Position" or "Create First Position" button
    const newButton = page.getByRole('button', { name: /new position|nouveau|crear|first/i })
    await newButton.first().click()

    // Dialog should open with title input
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 })
  })

  test('should switch tabs with keyboard shortcuts', async ({ page }) => {
    await page.keyboard.press('Alt+2')
    await page.waitForTimeout(500)
    // Positions tab should be active
    await expect(page.locator('[value="positions"][data-state="active"]')).toBeVisible()
  })

  test('should toggle dark mode', async ({ page }) => {
    // Initial state
    const html = page.locator('html')
    const initialClass = await html.getAttribute('class')

    // Toggle
    await page.keyboard.press('Control+Shift+KeyD')
    await page.waitForTimeout(300)

    const newClass = await html.getAttribute('class')
    expect(newClass).not.toBe(initialClass)
  })
})
