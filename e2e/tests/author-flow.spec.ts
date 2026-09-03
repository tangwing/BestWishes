import { expect, test } from '@playwright/test';
import { agree, broadcast, GOOD_BODY, login, region, setLocation } from './support';

test('新用户没同意协议就进写祝福 → 被引导去协议页', async ({ page }) => {
  await login(page, 'af-新来的');
  await page.goto('/compose');
  await page.waitForURL('**/agreement');
  await expect(page.getByRole('heading', { name: '《用户内容与授权协议》' })).toBeVisible();
});

test('群发给附近的陌生人 → 对方收件箱收到 → 对方回一段祝福', async ({ page, browser }) => {
  const r = region(10.0, 100.0);

  const recipientCtx = await browser.newContext();
  const rPage = await recipientCtx.newPage();
  await login(rPage, 'af2-阿离');
  await setLocation(rPage, r.recipient);

  await login(page, 'af2-发送者');
  await setLocation(page, r.sender);
  await agree(page);

  await page.goto('/compose');
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill(GOOD_BODY);
  // 范本不能粘贴
  await page.evaluate(() => navigator.clipboard.writeText('从别处复制来的祝福词'));
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(page.getByText('用你自己的话写出来')).toBeVisible();

  await page.getByRole('button', { name: '预览收件人' }).click();
  await expect(page.getByText(/将送达 1 人/)).toBeVisible();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForURL('**/sent/**');
  await expect(page.getByText(/送往.*1 位陌生人/)).toBeVisible();

  await rPage.goto('/inbox');
  await expect(rPage.getByText(GOOD_BODY)).toBeVisible({ timeout: 20_000 });
  await expect(rPage.getByText(/来自 af2-发送者/)).toBeVisible();

  // 回一段祝福
  await rPage.goto('/agreement');
  await rPage.getByRole('button', { name: '同意并继续' }).click();
  await rPage.goto('/inbox');
  await rPage.getByRole('button', { name: '回一段祝福' }).click();
  await rPage.waitForURL('**/compose**');
  await rPage
    .getByPlaceholder('慢慢写，写给一个具体的人。')
    .fill('谢谢你的祝福，也愿你一切都顺，平安喜乐安稳。');
  await rPage.getByRole('button', { name: '回过去' }).click();
  await rPage.waitForURL('**/sent/**');

  await page.goto('/inbox');
  await expect(page.getByText('谢谢你的祝福，也愿你一切都顺，平安喜乐安稳。')).toBeVisible({
    timeout: 20_000,
  });

  await recipientCtx.close();
});

test('范围里没有人 → 发送按钮不可用', async ({ page }) => {
  const r = region(60.0, 30.0); // 一个没有其他测试用户的偏远区域
  await login(page, 'af3-孤独');
  await setLocation(page, r.sender);
  await agree(page);
  await page.goto('/compose');
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill(GOOD_BODY);
  await page.getByRole('button', { name: '预览收件人' }).click();
  await expect(page.getByText('这个范围里还没有人。放宽条件或扩大距离。')).toBeVisible();
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
});

test('撤回后收件人看到占位', async ({ page, browser }) => {
  const r = region(-20.0, 50.0);

  const recipientCtx = await browser.newContext();
  const rPage = await recipientCtx.newPage();
  await login(rPage, 'af4-阿波');
  await setLocation(rPage, r.recipient);

  await login(page, 'af4-发送者');
  await setLocation(page, r.sender);
  await agree(page);
  await broadcast(page, { body: GOOD_BODY });

  await rPage.goto('/inbox');
  await expect(rPage.getByText(GOOD_BODY)).toBeVisible({ timeout: 20_000 });

  await page.goto('/records');
  await page.getByRole('button', { name: '撤回' }).first().click();
  await expect(page.getByText('已撤回')).toBeVisible();

  await rPage.goto('/inbox');
  await expect(rPage.getByText('这份祝福已被收回')).toBeVisible({ timeout: 20_000 });

  await recipientCtx.close();
});
