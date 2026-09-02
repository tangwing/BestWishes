// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { store } from '../store/repo';
import { Home } from './pages/Home';
import { PublicPage } from './pages/PublicPage';

function renderAt(entry: string, routePath: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  store.resetAll();
  cleanup();
});

describe('冒烟 — 页面能渲染', () => {
  it('首页（未登录）显示登录卡片', () => {
    renderAt('/', '/', <Home />);
    expect(screen.getByText('BestWishes')).toBeTruthy();
    expect(screen.getByText(/占位登录/)).toBeTruthy();
  });

  it('访客落地页 — 未知 slug 显示"没有找到"', () => {
    renderAt('/p/nope', '/p/:slug', <PublicPage />);
    expect(screen.getByText('没有找到这份祝福')).toBeTruthy();
  });

  it('访客落地页 — 校验中的祝福只显示占位、不显示正文', () => {
    store.loginStub('小林', '杭州', 480);
    store.recordConsent({ featured: true, synthesis: false });
    const { slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天，一切都好。',
      personalization: { toName: '阿明' },
      occasion: 'daily',
    });
    store.logout();
    renderAt(`/p/${slug}`, '/p/:slug', <PublicPage />);
    expect(screen.getByText(/正在准备中/)).toBeTruthy();
    expect(screen.queryByText(/温柔以待/)).toBeNull();
  });

  it('访客落地页 — 已发布祝福显示正文与来源', () => {
    store.loginStub('小林', '杭州', 480);
    store.recordConsent({ featured: true, synthesis: false });
    const { slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天，一切都好。',
      personalization: { toName: '阿明', fromName: '小林', fromCity: '杭州' },
      occasion: 'daily',
    });
    store.advanceClock(7000);
    store.logout();
    renderAt(`/p/${slug}`, '/p/:slug', <PublicPage />);
    expect(screen.getByText(/温柔以待/)).toBeTruthy();
    expect(screen.getByText(/来自 杭州 的 小林/)).toBeTruthy();
  });

  it('访客可举报，提交后显示已收到', () => {
    store.loginStub('小林', '杭州', 480);
    store.recordConsent({ featured: true, synthesis: false });
    const { slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天，一切都好。',
      personalization: { toName: '阿明' },
      occasion: 'daily',
    });
    store.advanceClock(7000);
    store.logout();
    renderAt(`/p/${slug}`, '/p/:slug', <PublicPage />);
    fireEvent.click(screen.getByText('举报这份内容'));
    fireEvent.click(screen.getByText('不实信息')); // 非高危：页面仍显示正文 + 致谢
    expect(screen.getByText(/已收到你的反馈/)).toBeTruthy();
  });

  it('访客举报高危大类 → 页面即时转占位', () => {
    store.loginStub('小林', '杭州', 480);
    store.recordConsent({ featured: true, synthesis: false });
    const { slug } = store.submitBlessing({
      body: '愿你被这个世界温柔以待，平安喜乐每一天，一切都好。',
      personalization: { toName: '阿明' },
      occasion: 'daily',
    });
    store.advanceClock(7000);
    store.logout();
    renderAt(`/p/${slug}`, '/p/:slug', <PublicPage />);
    fireEvent.click(screen.getByText('举报这份内容'));
    fireEvent.click(screen.getByText('涉嫌违法'));
    expect(screen.queryByText(/温柔以待/)).toBeNull();
    expect(screen.getByText(/暂时无法查看/)).toBeTruthy();
  });
});
