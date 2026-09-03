import { expect, test } from '@playwright/test';
import { agree, broadcast, GOOD_BODY, login, region, setLocation, SUSPECT_BODY } from './support';

test('命中拉客护栏词 → 停在校验中 → 审核台通过 → 投递到收件箱', async ({ page, browser }) => {
  const r = region(0.0, 20.0);

  const recipientCtx = await browser.newContext();
  const rPage = await recipientCtx.newPage();
  await login(rPage, 'mod1-收件人');
  await setLocation(rPage, r.recipient);

  await login(page, 'mod1-发送者');
  await setLocation(page, r.sender);
  await agree(page);
  await broadcast(page, { body: SUSPECT_BODY });

  await rPage.goto('/inbox');
  await expect(rPage.getByText('还没有收到祝福。')).toBeVisible();

  await page.goto('/moderation');
  await expect(page.getByText('auto_suspect')).toBeVisible();
  await page.getByRole('button', { name: '通过' }).first().click();
  await expect(page.getByText('队列为空')).toBeVisible();

  await rPage.goto('/inbox');
  await expect(rPage.getByText('如需超度收费')).toBeVisible({ timeout: 20_000 });
  await recipientCtx.close();
});

test('访客举报高危 → 公开页即时下架 → 审核台通过 → 恢复可见', async ({ page, browser }) => {
  const r = region(50.0, -100.0);

  const recipientCtx = await browser.newContext();
  const rPage = await recipientCtx.newPage();
  await login(rPage, 'mod2-收件人');
  await setLocation(rPage, r.recipient);

  await login(page, 'mod2-发送者');
  await setLocation(page, r.sender);
  await agree(page);
  await broadcast(page, { body: GOOD_BODY });
  const slug = await page
    .locator('a[href^="/p/"]')
    .first()
    .getAttribute('href')
    .then((h) => h?.split('/p/').pop() ?? '');

  const visitor = await browser.newContext();
  const vPage = await visitor.newPage();
  await vPage.goto(`/p/${slug}`);
  await expect(vPage.getByText('温柔以待')).toBeVisible({ timeout: 20_000 });

  await vPage.getByRole('button', { name: '举报这份内容' }).click();
  await vPage.getByRole('button', { name: '涉嫌违法' }).click();
  await expect(vPage.getByText('已收到你的反馈')).toBeVisible();
  await expect(vPage.getByText('温柔以待')).toBeHidden({ timeout: 20_000 });

  await page.goto('/moderation');
  await expect(page.getByText('优先级 90')).toBeVisible();
  await page.getByRole('button', { name: '通过' }).first().click();
  await expect(vPage.getByText('温柔以待')).toBeVisible({ timeout: 20_000 });

  await visitor.close();
  await recipientCtx.close();
});
