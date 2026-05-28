import { test, expect } from '@playwright/test';

test('schedule page loads', async ({ page }) => {
  await page.goto('/schedule');
  await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
});

test('schedule page shows week grid', async ({ page }) => {
  await page.goto('/schedule');
  await expect(page.locator('.week-grid, [class*="week"]')).toBeVisible({ timeout: 8000 });
});
