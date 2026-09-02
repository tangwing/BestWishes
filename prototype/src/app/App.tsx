import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from './useStore';

export function App() {
  const store = useStore();
  const user = store.currentUser();

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">
          BestWishes <small>静心祝福 · P1 原型</small>
        </span>
        <nav className="nav">
          <NavLink to="/" end>
            首页
          </NavLink>
          {user && (
            <>
              <NavLink to="/compose">写祝福</NavLink>
              <NavLink to="/mine">我的祝福</NavLink>
              <NavLink to="/streak">坚持</NavLink>
              <NavLink to="/moderation">审核台</NavLink>
            </>
          )}
        </nav>
      </div>

      <DemoControls />

      <Outlet />
    </div>
  );
}

function DemoControls() {
  const store = useStore();
  const user = store.currentUser();
  const mode = store.getModerationMode();
  const cfg = store.getConfig();

  return (
    <div className="demo">
      <b>走查工具</b>（仅原型）：时钟偏移{' '}
      {Math.round((store.now().getTime() - Date.now()) / 1000)}s
      <div className="row">
        <button className="ghost" onClick={() => store.advanceClock(7000)}>
          +7 秒（跳过送达 hold）
        </button>
        <button className="ghost" onClick={() => store.advanceClock(121 * 86_400_000)}>
          +121 天（触发过期）
        </button>
        <button className="ghost" onClick={() => store.resetAll()}>
          清空全部数据
        </button>
      </div>
      <div className="row">
        <span>审核模式：</span>
        {(['normal', 'guard_as_violation', 'unavailable'] as const).map((m) => (
          <button
            key={m}
            className={m === mode ? '' : 'ghost'}
            onClick={() => store.setModerationMode(m)}
          >
            {m === 'normal' ? '正常' : m === 'guard_as_violation' ? '护栏词=违规' : '审核服务不可用'}
          </button>
        ))}
      </div>
      <div className="row">
        <span>精选展示默认：</span>
        <button
          className={cfg.featuredDefaultOn ? '' : 'ghost'}
          onClick={() => store.setFeaturedDefault(true)}
        >
          默认开
        </button>
        <button
          className={!cfg.featuredDefaultOn ? '' : 'ghost'}
          onClick={() => store.setFeaturedDefault(false)}
        >
          默认关（opt-in）
        </button>
      </div>
      {user && (
        <div className="hint">
          当前登录：{user.nickname}（{user.city}，UTC{user.utcOffsetMinutes >= 0 ? '+' : ''}
          {user.utcOffsetMinutes / 60}） ·{' '}
          <button className="link" onClick={() => store.logout()}>
            退出
          </button>
        </div>
      )}
    </div>
  );
}
