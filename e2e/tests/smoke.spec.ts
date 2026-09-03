import { expect, test } from '@playwright/test';

test('首页能打开', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('BestWishes').first()).toBeVisible();
});
