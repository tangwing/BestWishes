import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSession } from './session';
import s from './app.module.css';

export function App() {
  const { user, logout } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    const tick = () => {
      void api
        .notifications()
        .then((n) => {
          if (active) setUnread(n.unread);
        })
        .catch(() => undefined);
    };
    tick();
    const h = setInterval(tick, 4000);
    return () => {
      active = false;
      clearInterval(h);
    };
  }, [user, loc.pathname]);

  return (
    <div className={s.app}>
      <div className={s.topbar}>
        <span className={s.brand}>BestWishes</span>
        <nav className={s.nav}>
          <NavLink to="/" end>
            首页
          </NavLink>
          {user && (
            <>
              <NavLink to="/compose">写祝福</NavLink>
              <NavLink to="/inbox">
                收件箱{unread > 0 && <span className={s.badge}>{unread}</span>}
              </NavLink>
              <NavLink to="/records">发出的</NavLink>
              <NavLink to="/streak">回响</NavLink>
              <NavLink to="/profile">个人空间</NavLink>
              <NavLink to="/moderation">审核台</NavLink>
              <button
                className="link"
                onClick={() => {
                  void logout().then(() => {
                    nav('/');
                  });
                }}
              >
                退出
              </button>
            </>
          )}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
