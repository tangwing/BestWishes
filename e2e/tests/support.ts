import { expect, type Page } from '@playwright/test';

export const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺遂安稳。';
export const SUSPECT_BODY = '愿你平安，如需超度收费请私信我们，价格公道，服务周到周全。';

/** 占位登录 → 落到个人空间。 */
export async function login(page: Page, nickname: string): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox').first().fill(nickname);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/profile');
}

/** 同意授权协议 → 落到写祝福页。 */
export async function agree(page: Page): Promise<void> {
  await page.goto('/agreement');
  await page.getByRole('button', { name: '同意并继续' }).click();
  await page.waitForURL('**/compose');
}

/** 在写祝福页填正文 + 称呼并发送，返回落地的 sent 页 id。 */
export async function compose(
  page: Page,
  opts: { body: string; toName: string; occasion?: string },
): Promise<string> {
  await page.goto('/compose');
  const textarea = page.getByPlaceholder('慢慢写，写给一个具体的人。');
  await textarea.fill(opts.body);
  await page.getByPlaceholder('称呼，如 阿明 / 妈妈').fill(opts.toName);
  await page.getByRole('button', { name: '写好了，发送' }).click();
  await page.waitForURL('**/sent/**');
  const url = new URL(page.url());
  const id = url.pathname.split('/').pop();
  expect(id).toBeTruthy();
  return id ?? '';
}

/** 从 sent 页拿到访客分享链接的 slug。 */
export async function shareSlug(page: Page): Promise<string> {
  const href = await page.locator('a[href^="/p/"]').first().getAttribute('href');
  const slug = href?.split('/p/').pop();
  expect(slug).toBeTruthy();
  return slug ?? '';
}
