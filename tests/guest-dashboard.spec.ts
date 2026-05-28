import { test, expect } from '@playwright/test';

test('dashboard loads in guest mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
  await expect(page).not.toHaveURL(/auth/);
});

test('sidebar navigation links are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible({ timeout: 8000 });
});
