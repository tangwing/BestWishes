import { expect, test, type Browser } from '@playwright/test';
import { agree, login, region, setLocation } from './support';

/** 发一条祈福 + 让另一个人录音回应，等它转正（hold + 扫描），供首页/详情页测试用。
 * 返回这条祈福的 id。 */
async function seedPublishedWishRequestWithResponse(
  browser: Browser,
  opts: {
    situation: string;
    authorNickname: string;
    responderNickname: string;
    r: ReturnType<typeof region>;
  },
): Promise<string> {
  const authorCtx = await browser.newContext();
  const authorPage = await authorCtx.newPage();
  await login(authorPage, opts.authorNickname);
  await setLocation(authorPage, opts.r.sender);
  await agree(authorPage);
  await authorPage.goto('/plaza/new');
  await authorPage
    .getByPlaceholder('最近遇到了什么，心情怎么样，希望被怎么祝福……')
    .fill(opts.situation);
  await authorPage.getByRole('button', { name: '发布', exact: true }).click();
  await authorPage.waitForURL('**/plaza/wrq_**');
  const requestId = authorPage.url().split('/plaza/').pop() ?? '';
  await authorCtx.close();

  const responderCtx = await browser.newContext();
  const rPage = await responderCtx.newPage();
  await login(rPage, opts.responderNickname);
  await setLocation(rPage, opts.r.recipient);
  await agree(rPage);
  await rPage.goto(`/plaza/${requestId}/respond`);
  const phrase = await rPage.locator('b').first().innerText();
  await rPage.getByRole('button', { name: '开始录音' }).click();
  await rPage.waitForTimeout(6000);
  await rPage.getByRole('button', { name: '结束录音' }).click();
  await rPage
    .getByPlaceholder(/把刚才说的话大致写一下/)
    .fill(`愿你被这个世界温柔以待，一切都会好起来的，${phrase}`);
  await rPage.getByRole('button', { name: '发出这段祝福' }).click();
  await rPage.waitForURL('**/blessings/**/feedback');
  await responderCtx.close();

  return requestId;
}

test('访客在首页读到一条真实祈福 + 真实回应，无需登录', async ({ page, browser }) => {
  const r = region(66.0, 96.0);
  const SITUATION = 'ke0-最近换了新工作，心里有点没底，希望有人能鼓励我一下。';
  const requestId = await seedPublishedWishRequestWithResponse(browser, {
    situation: SITUATION,
    authorNickname: 'ke0-求祝福',
    responderNickname: 'ke0-回应者',
    r,
  });

  // 确认这条请求已经真的带着回应转正了（不依赖 Home 挑的是不是恰好这一条）
  await page.goto(`/plaza/${requestId}`);
  await expect(page.getByText(/来自 ke0-回应者/)).toBeVisible({ timeout: 20_000 });

  // 访客（无 cookie）打开首页：不报错、不留白，能看到一条真实祈福 + 就地回应入口
  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();
  await guestPage.goto('/');
  await expect(guestPage.getByText('BestWishes')).toBeVisible();
  await expect(guestPage.getByRole('button', { name: '回应这条祈福' })).toBeVisible();
  await expect(guestPage.getByRole('button', { name: '给附近的人写一段祝福' })).toBeVisible();
  await guestCtx.close();
});

test('未登录访客：从首页写祝福 → 提交 → 登录 → 同意协议 → 内容未丢 → 送出成功', async ({
  page,
}) => {
  const nickname = 'ke1-访客';
  const loc = region(67.0, 97.0).sender;

  // 这个账号"曾经"登录过、设好过位置——群发要求发送者有位置是既有的、本变更未触及的约束
  // （spec「不强制填画像」只覆盖回应祈福那条路径，见 redesign-kindness-entry 的实现笔记）。
  // 这里先以登录态把位置设好，再清 cookie 模拟"这次是未登录访客"。
  await login(page, nickname);
  await setLocation(page, loc);
  await page.context().clearCookies();

  await page.goto('/');
  await page.getByRole('button', { name: '给附近的人写一段祝福' }).click();
  await page.waitForURL('**/give');

  const body = '愿你被这个世界温柔以待，一切都会慢慢好起来的呀，别急。';
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill(body);
  await page.getByRole('button', { name: '发送', exact: true }).click();

  // 未登录：引导去登录，不丢内容
  await page.waitForURL('**/login**');
  await page.getByRole('textbox').first().fill(nickname);
  await page.getByRole('button', { name: '登录' }).click();

  await page.waitForURL('**/give');
  await expect(page.getByPlaceholder('慢慢写，写给一个具体的人。')).toHaveValue(body);
  await page.getByRole('button', { name: '发送', exact: true }).click();

  // 登录了但没同意协议：引导去协议页，同样不丢内容
  await page.waitForURL('**/agreement**');
  await page.getByRole('button', { name: '同意并继续' }).click();

  await page.waitForURL('**/give');
  await expect(page.getByPlaceholder('慢慢写，写给一个具体的人。')).toHaveValue(body);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForURL('**/sent/**');
});

test('两步路径：已登录 + 已设位置 + 已同意协议的用户，从首页出发只点两次就送出', async ({
  page,
}) => {
  const nickname = 'ke2-老用户';
  const loc = region(68.0, 98.0).sender;
  await login(page, nickname);
  await setLocation(page, loc);
  await agree(page);

  await page.goto('/');
  // 第 1 次主动操作：进入群发的撰写入口
  await page.getByRole('button', { name: '给附近的人写一段祝福' }).click();
  await page.waitForURL('**/give');

  await page
    .getByPlaceholder('慢慢写，写给一个具体的人。')
    .fill('愿你被这个世界温柔以待，平安喜乐每一天，一切顺遂。');
  // 不碰受众筛选器、不预览——第 2 次主动操作：直接发送
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForURL('**/sent/**');
});

test('访客在详情页点音频 → 提示登录；登录后同一条可播放', async ({ page, browser }) => {
  const r = region(69.0, 99.0);
  const SITUATION = 'ke3-最近状态不太好，希望有人能给我一点力量。';
  const requestId = await seedPublishedWishRequestWithResponse(browser, {
    situation: SITUATION,
    authorNickname: 'ke3-求祝福',
    responderNickname: 'ke3-回应者',
    r,
  });

  await page.goto(`/plaza/${requestId}`);
  await expect(page.getByText(/来自 ke3-回应者/)).toBeVisible({ timeout: 20_000 });

  const guestCtx = await browser.newContext();
  const guestPage = await guestCtx.newPage();
  await guestPage.goto(`/plaza/${requestId}`);
  await expect(guestPage.getByText(SITUATION)).toBeVisible();
  await expect(guestPage.locator('audio')).toHaveCount(0);
  const loginLink = guestPage.getByText('登录后可收听');
  await expect(loginLink).toBeVisible();
  await loginLink.click();
  await guestPage.waitForURL('**/login**');

  await guestPage.getByRole('textbox').first().fill('ke3-回放访客');
  await guestPage.getByRole('button', { name: '登录' }).click();
  await guestPage.waitForURL('**/profile');

  await guestPage.goto(`/plaza/${requestId}`);
  await expect(guestPage.locator('audio')).toHaveCount(1, { timeout: 20_000 });
  await guestCtx.close();
});
