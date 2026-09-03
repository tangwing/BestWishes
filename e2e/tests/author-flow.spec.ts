import { expect, test } from '@playwright/test';
import { agree, compose, GOOD_BODY, login, shareSlug } from './support';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('新用户没同意协议就进写祝福 → 被引导去协议页', async ({ page }) => {
  await login(page, '新来的');
  await page.goto('/compose');
  await page.waitForURL('**/agreement');
  await expect(page.getByRole('heading', { name: '《用户内容与授权协议》' })).toBeVisible();
});

test('作者写祝福 → 校验通过送达 → 访客看到正文 → 撤回后访客看到占位', async ({ page, browser }) => {
  await login(page, '小林');

  // 个人空间预设落款 / 城市（onBlur 各自保存，逐个确认落库）
  const senderName = page.locator('input[type="text"]').nth(0);
  const regionCity = page.locator('input[type="text"]').nth(1);
  await senderName.fill('小林');
  await senderName.blur();
  await expect(page.getByText('已保存。')).toBeVisible();
  await regionCity.fill('杭州');
  await regionCity.blur();
  await page.reload();
  await expect(page.locator('input[type="text"]').nth(1)).toHaveValue('杭州');

  await agree(page);

  // 范本不能粘贴：往正文里粘贴会被拦下
  const textarea = page.getByPlaceholder('慢慢写，写给一个具体的人。');
  await page.evaluate(() => navigator.clipboard.writeText('这是从别处复制来的祝福词'));
  await textarea.focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(page.getByText('用你自己的话写出来')).toBeVisible();
  await expect(textarea).toHaveValue('');

  const id = await compose(page, { body: GOOD_BODY, toName: '阿明' });
  expect(id).not.toEqual('');

  await expect(page.getByText('已发送')).toBeVisible();
  const slug = await shareSlug(page);

  // 访客（无登录态的独立上下文）
  const visitor = await browser.newContext();
  const vPage = await visitor.newPage();
  await vPage.goto(`/p/${slug}`);
  // 校验期间先看到占位，hold（1s）+ 扫描（3s）后自动刷出正文
  await expect(vPage.getByText('温柔以待')).toBeVisible({ timeout: 20_000 });
  await expect(vPage.getByText('来自 杭州 的 小林')).toBeVisible();

  // 作者撤回
  await page.goto('/records');
  await page.getByRole('button', { name: '撤回' }).click();
  await expect(page.getByText('已撤回')).toBeVisible();

  // 访客页转为占位
  await expect(vPage.getByText('这份祝福已被收回')).toBeVisible({ timeout: 20_000 });
  await expect(vPage.getByText('温柔以待')).toBeHidden();

  await visitor.close();
});
