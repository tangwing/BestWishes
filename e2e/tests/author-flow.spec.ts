import { expect, test } from '@playwright/test';
import { agree, broadcast, GOOD_BODY, login, region, setLocation } from './support';

test('新用户没同意协议：进写祝福页不拦，写完点发送才引导去协议页（登录/协议延后到提交那一刻）', async ({
  page,
}) => {
  await login(page, 'af-新来的');
  await page.goto('/give');
  // 进页不再是前置门槛——不弹协议墙，能直接开始写
  await expect(page.getByRole('heading', { name: '传播善意' })).toBeVisible();
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill('愿你被这个世界温柔以待，一切安好顺遂。');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForURL('**/agreement**');
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

  await page.goto('/give');
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill(GOOD_BODY);
  // 范本不能粘贴
  await page.evaluate(() => navigator.clipboard.writeText('从别处复制来的祝福词'));
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(page.getByText('用你自己的话写出来')).toBeVisible();

  // 受众筛选器默认收起，展开后才有"预览收件人"（受众预览已降级为可选辅助，不再是发送前置）
  await page.getByRole('button', { name: '调整范围' }).click();
  await page.getByRole('button', { name: '预览收件人' }).click();
  await expect(page.getByText(/将送达 1 人/)).toBeVisible();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForURL('**/sent/**');
  await expect(page.getByText(/送往.*1 位陌生人/)).toBeVisible();

  await rPage.goto('/pouch');
  await expect(rPage.getByText(GOOD_BODY)).toBeVisible({ timeout: 20_000 });
  await expect(rPage.getByText(/来自 af2-发送者/)).toBeVisible();

  // 回一段祝福
  await rPage.goto('/agreement');
  await rPage.getByRole('button', { name: '同意并继续' }).click();
  await rPage.goto('/pouch');
  await rPage.getByRole('button', { name: '回一段祝福' }).click();
  await rPage.waitForURL('**/give**');
  await rPage
    .getByPlaceholder('慢慢写，写给一个具体的人。')
    .fill('谢谢你的祝福，也愿你一切都顺，平安喜乐安稳。');
  await rPage.getByRole('button', { name: '回过去' }).click();
  await rPage.waitForURL('**/sent/**');

  await page.goto('/pouch');
  await expect(page.getByText('谢谢你的祝福，也愿你一切都顺，平安喜乐安稳。')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(`回的是你那条：「${GOOD_BODY}」`)).toBeVisible();

  await recipientCtx.close();
});

test('范围里没有人 → 提交后收到 audience_empty 提示（受众预览已降级，不再是发送前置门槛）', async ({
  page,
}) => {
  const r = region(60.0, 30.0); // 一个没有其他测试用户的偏远区域
  await login(page, 'af3-孤独');
  await setLocation(page, r.sender);
  await agree(page);
  await page.goto('/give');
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill(GOOD_BODY);
  // 不碰筛选器、不预览，直接发送——按钮不再因为没预览过而被禁用
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText(/命中 0 人/)).toBeVisible();
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

  await rPage.goto('/pouch');
  await expect(rPage.getByText(GOOD_BODY)).toBeVisible({ timeout: 20_000 });

  await page.goto('/give');
  await page.getByRole('button', { name: '撤回' }).first().click();
  await expect(page.getByText('已撤回')).toBeVisible();

  await rPage.goto('/pouch');
  await expect(rPage.getByText('这份祝福已被收回')).toBeVisible({ timeout: 20_000 });

  await recipientCtx.close();
});

test('撤回后没有「重新发布」按钮，只能「复制以供编辑」；复制不会让对方重新收到旧的那条', async ({
  page,
  browser,
}) => {
  const r = region(15.0, -40.0);

  const recipientCtx = await browser.newContext();
  const rPage = await recipientCtx.newPage();
  await login(rPage, 'af5-阿离');
  await setLocation(rPage, r.recipient);

  await login(page, 'af5-发送者');
  await setLocation(page, r.sender);
  await agree(page);
  await broadcast(page, { body: GOOD_BODY });

  await rPage.goto('/pouch');
  await expect(rPage.getByText(GOOD_BODY)).toBeVisible({ timeout: 20_000 });

  await page.goto('/give');
  await page.getByRole('button', { name: '撤回' }).first().click();
  await expect(page.getByText('已撤回')).toBeVisible();

  // 没有重新发布的路子了
  await expect(page.getByRole('button', { name: '重新发布' })).toHaveCount(0);

  // 只能复制正文去编辑；跳转到写祝福页，正文已预填，但没有重新触发投递
  await page.getByRole('button', { name: '复制以供编辑' }).click();
  await page.waitForURL('**/give');
  await expect(page.getByPlaceholder('慢慢写，写给一个具体的人。')).toHaveValue(GOOD_BODY);

  // 撤回的那条对收件人仍然是占位，没有因为「复制」而重新送达
  await rPage.goto('/pouch');
  await expect(rPage.getByText('这份祝福已被收回')).toBeVisible({ timeout: 20_000 });

  await recipientCtx.close();
});
