import { expect, type Page } from '@playwright/test';

export const GOOD_BODY = '愿你被这个世界温柔以待，平安喜乐每一天，一切都顺遂安稳。';
export const SUSPECT_BODY = '愿你平安，如需超度收费请私信我们，价格公道，服务周到周全。';

// 内存 server 在整个 E2E 里是同一个实例、状态会累积。给每个测试一个相距很远的
// "区域"，同区域内 sender 和 recipient 约 1.3km（默认 5km 半径能覆盖），
// 跨区域相距 >100km，互不干扰。
export interface Region {
  sender: { lat: number; lng: number };
  recipient: { lat: number; lng: number };
}

export function region(centerLat: number, centerLng: number): Region {
  return {
    sender: { lat: centerLat, lng: centerLng },
    recipient: { lat: centerLat + 0.01, lng: centerLng + 0.01 },
  };
}

/** 占位登录 → 落到个人空间。 */
export async function login(page: Page, nickname: string): Promise<void> {
  await page.goto('/login');
  await page.getByRole('textbox').first().fill(nickname);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/profile');
}

/** 在个人空间设置经纬度（受众距离筛选需要）。 */
export async function setLocation(page: Page, loc: { lat: number; lng: number }): Promise<void> {
  await page.goto('/profile');
  await page.getByLabel('纬度').fill(String(loc.lat));
  await page.getByLabel('纬度').blur();
  await page.getByLabel('经度').fill(String(loc.lng));
  await page.getByLabel('经度').blur();
  await expect(page.getByText('位置已设置，可以群发。')).toBeVisible();
}

/** 同意授权协议 → 落到写祝福页。 */
export async function agree(page: Page): Promise<void> {
  await page.goto('/agreement');
  await page.getByRole('button', { name: '同意并继续' }).click();
  await page.waitForURL('**/compose');
}

/** 在写祝福页填正文 → 预览受众 → 群发。返回落地的 sent 页 id。 */
export async function broadcast(page: Page, opts: { body: string }): Promise<string> {
  await page.goto('/compose');
  await page.getByPlaceholder('慢慢写，写给一个具体的人。').fill(opts.body);
  await page.getByRole('button', { name: '预览收件人' }).click();
  await expect(page.getByText(/将送达/)).toBeVisible();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.waitForURL('**/sent/**');
  const id = new URL(page.url()).pathname.split('/').pop();
  expect(id).toBeTruthy();
  return id ?? '';
}

/** 从 sent 页拿到公开链接的 slug。 */
export async function shareSlug(page: Page): Promise<string> {
  const href = await page.locator('a[href^="/p/"]').first().getAttribute('href');
  const slug = href?.split('/p/').pop();
  expect(slug).toBeTruthy();
  return slug ?? '';
}
