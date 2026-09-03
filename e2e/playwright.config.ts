import { defineConfig, devices } from '@playwright/test';

// 用系统安装的 Chrome（channel: 'chrome'），不下载 Playwright 自带的 chromium
// —— 本机是 macOS 12，新版 Playwright 不再为它提供 chromium 构建。
const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command:
      'pnpm --filter @bestwishes/client build && pnpm --filter @bestwishes/server exec tsx src/main.ts',
    cwd: '..',
    port: PORT,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: String(PORT),
      HOST: '127.0.0.1',
      // hold 缩到 1 秒，扫描任务每 3 秒跑一次：提交后几秒内即发布
      BW_HOLD_SECONDS: '1',
      BW_DB: 'memory',
    },
  },
});
