import { expect, test } from '@playwright/test';
import { agree, login, region, setLocation } from './support';

const SCRIPT = '愿你放下焦虑，一步一步来。';

test('祝福请求：发布 → 广场浏览 → 录音回应（真麦克风假设备）→ 多维反馈 → 请求人收到', async ({
  page,
  browser,
}) => {
  const SITUATION = 'wr1-最近考研压力很大，每天都很焦虑，希望有人能鼓励我一下。';
  const r = region(40.0, -70.0);

  const responderCtx = await browser.newContext();
  const rPage = await responderCtx.newPage();
  await login(rPage, 'wr1-回应者');
  await setLocation(rPage, r.recipient);
  await agree(rPage);

  await login(page, 'wr1-求祝福');
  await setLocation(page, r.sender);
  await agree(page);

  await page.goto('/wish-requests/new');
  await page.getByPlaceholder('最近遇到了什么，心情怎么样，希望被怎么祝福……').fill(SITUATION);
  await page.getByPlaceholder('例如：愿你放下焦虑，一步一步来……').fill(SCRIPT);
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.waitForURL('**/wish-requests/wrq_**');
  const requestId = page.url().split('/wish-requests/').pop() ?? '';

  // 未登录 / 其他账号在广场能看到这条请求
  await rPage.goto('/wish-requests');
  await expect(rPage.getByText(SITUATION)).toBeVisible();

  await rPage.goto(`/wish-requests/${requestId}/respond`);
  await expect(rPage.getByText(SITUATION)).toBeVisible();
  await expect(rPage.getByText(SCRIPT)).toBeVisible();
  const phrase = await rPage.locator('b').first().innerText();
  expect(phrase).toMatch(/^\d{3}$/);

  await rPage.getByRole('button', { name: '开始录音' }).click();
  await rPage.waitForTimeout(6000);
  await rPage.getByRole('button', { name: '结束录音' }).click();
  await expect(rPage.getByRole('button', { name: '重录' })).toBeVisible();

  await rPage
    .getByPlaceholder(/把刚才说的话大致写一下/)
    .fill(`${SCRIPT}你已经很努力了，${phrase}`);
  await rPage.getByRole('button', { name: '发出这段祝福' }).click();
  await rPage.waitForURL('**/blessings/**/feedback');

  // 多维标签，绝不是单一分数
  await expect(rPage.getByText(/完整度：/)).toBeVisible({ timeout: 15_000 });
  await expect(rPage.getByText(/专注度：/)).toBeVisible();
  await expect(rPage.getByText(/真诚度：/)).toBeVisible();

  await page.goto(`/wish-requests/${requestId}/responses`);
  await expect(page.getByText(/来自 wr1-回应者/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('audio')).toHaveCount(1);

  await responderCtx.close();
});

test('未同意协议的用户点「回应」→ 跳协议页 → 同意后回到回应页（不是写祝福页）', async ({
  page,
  browser,
}) => {
  const SITUATION = 'wr3-最近考研压力很大，每天都很焦虑，希望有人能鼓励我一下。';
  const r = region(42.0, -72.0);

  await login(page, 'wr3-求祝福');
  await setLocation(page, r.sender);
  await agree(page);
  await page.goto('/wish-requests/new');
  await page.getByPlaceholder('最近遇到了什么，心情怎么样，希望被怎么祝福……').fill(SITUATION);
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.waitForURL('**/wish-requests/wrq_**');
  const requestId = page.url().split('/wish-requests/').pop() ?? '';

  // 全新用户，没同意过协议
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await login(p, 'wr3-回应者');
  await setLocation(p, r.recipient);

  await p.goto(`/wish-requests/${requestId}/respond`);
  await p.waitForURL('**/agreement**');
  await p.getByRole('button', { name: '同意并继续' }).click();
  // 关键断言：回到回应页，而不是被硬编码丢到 /compose
  await p.waitForURL(`**/wish-requests/${requestId}/respond`);
  await expect(p.getByText(SITUATION)).toBeVisible();

  await ctx.close();
});

test('撤回请求后，广场看不到，也不能再回应', async ({ page }) => {
  const SITUATION = 'wr2-最近考研压力很大，每天都很焦虑，希望有人能鼓励我一下。';
  const r = region(41.0, -71.0);
  await login(page, 'wr2-求祝福');
  await setLocation(page, r.sender);
  await agree(page);

  await page.goto('/wish-requests/new');
  await page.getByPlaceholder('最近遇到了什么，心情怎么样，希望被怎么祝福……').fill(SITUATION);
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.waitForURL('**/wish-requests/wrq_**');
  const requestId = page.url().split('/wish-requests/').pop() ?? '';

  await page.goto('/wish-requests/mine');
  await page.getByRole('button', { name: '撤回' }).first().click();
  await expect(page.getByText('已撤回')).toBeVisible();

  await page.goto('/wish-requests');
  await expect(page.getByText(SITUATION)).toHaveCount(0);
});
