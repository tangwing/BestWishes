import { expect, test } from '@playwright/test';

test('未知链接 → 显示"没有找到"占位，不报错', async ({ page }) => {
  await page.goto('/p/this-slug-does-not-exist');
  await expect(page.getByText('没有找到这份祝福')).toBeVisible();
  // 访客页始终有回到首页写祝福的入口
  await expect(page.getByRole('link', { name: '我也写一段 →' })).toBeVisible();
});

test('访客页不需要登录态', async ({ page }) => {
  await page.goto('/p/anything');
  await expect(page.getByText('BestWishes')).toBeVisible();
  await expect(page).toHaveURL(/\/p\/anything$/);
});
