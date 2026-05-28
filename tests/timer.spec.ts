import { test, expect } from '@playwright/test';

test('timer page loads', async ({ page }) => {
  await page.goto('/timer');
  await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
});

test('timer shows start button', async ({ page }) => {
  await page.goto('/timer');
  const startBtn = page.getByRole('button', { name: /start/i });
  await expect(startBtn).toBeVisible({ timeout: 8000 });
});
