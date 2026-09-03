import { expect, test } from '@playwright/test';
import { agree, compose, GOOD_BODY, login, shareSlug, SUSPECT_BODY } from './support';

test('命中护栏词 → 停在校验中 → 审核台通过 → 送达', async ({ page, browser }) => {
  await login(page, '小林');
  await agree(page);
  await compose(page, { body: SUSPECT_BODY, toName: '故人', occasion: 'remembrance' });
  const slug = await shareSlug(page);

  const visitor = await browser.newContext();
  const vPage = await visitor.newPage();
  await vPage.goto(`/p/${slug}`);
  await expect(vPage.getByText('这份祝福正在准备中')).toBeVisible();

  // hold 早过了也不会自动发布：进了人工队列
  await page.waitForTimeout(5_000);
  await vPage.reload();
  await expect(vPage.getByText('这份祝福正在准备中')).toBeVisible();

  await page.goto('/moderation');
  await expect(page.getByText('auto_suspect')).toBeVisible();
  await page.getByRole('button', { name: '通过' }).first().click();
  await expect(page.getByText('队列为空')).toBeVisible();

  await expect(vPage.getByText('如需超度收费')).toBeVisible({ timeout: 20_000 });
  await visitor.close();
});

test('访客举报高危 → 即时下架 → 审核台驳回举报 → 恢复可见', async ({ page, browser }) => {
  await login(page, '小林');
  await agree(page);
  await compose(page, { body: GOOD_BODY, toName: '阿明' });
  const slug = await shareSlug(page);

  const visitor = await browser.newContext();
  const vPage = await visitor.newPage();
  await vPage.goto(`/p/${slug}`);
  await expect(vPage.getByText('温柔以待')).toBeVisible({ timeout: 20_000 });

  await vPage.getByRole('button', { name: '举报这份内容' }).click();
  await vPage.getByRole('button', { name: '涉嫌违法' }).click();
  await expect(vPage.getByText('已收到你的反馈')).toBeVisible();

  // 高危举报即时临时下架
  await expect(vPage.getByText('温柔以待')).toBeHidden({ timeout: 20_000 });

  // 审核台：高危举报排在最前，通过（申诉成功）后恢复
  await page.goto('/moderation');
  await expect(page.getByText('优先级 90')).toBeVisible();
  await page.getByRole('button', { name: '通过' }).first().click();

  await expect(vPage.getByText('温柔以待')).toBeVisible({ timeout: 20_000 });
  await visitor.close();
});
