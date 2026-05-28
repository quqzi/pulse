import { test, expect } from '@playwright/test';

test('subjects page loads', async ({ page }) => {
  await page.goto('/subjects');
  await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
});

test('can open new subject form', async ({ page }) => {
  await page.goto('/subjects');
  const addBtn = page.getByRole('button', { name: /add|new subject/i });
  await expect(addBtn).toBeVisible({ timeout: 8000 });
});
