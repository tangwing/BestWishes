import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSession } from './session';
import s from './app.module.css';

export function App() {
  const { user, logout } = useSession();
  const nav = useNavigate();

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
              <NavLink to="/records">收发记录</NavLink>
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
