import { Link } from 'react-router-dom';
import { useSession } from '../session';
import s from '../app.module.css';

export function Home() {
  const { user, loading } = useSession();
  if (loading) return <div className={s.page}>…</div>;

  if (user) {
    return (
      <div className={s.page}>
        <h1>静一静，为一个人写一段祝福</h1>
        <p className={s.lead}>
          不用急。想好要写给谁，把这一年里 TA 让你记得的一件小事，慢慢写下来。
        </p>
        <div className={s.card}>
          <Link to="/compose">
            <button>写一段祝福</button>
          </Link>{' '}
          <Link to="/records">
            <button className="ghost">看看我写过的</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <h1>BestWishes</h1>
      <p className={s.lead}>练习专注，传递善意。为世界上的某个人，认真写一段祝福。</p>
      <div className={s.card}>
        <Link to="/login">
          <button>开始</button>
        </Link>
        <p className={s.hint}>访客打开分享链接无需登录。</p>
      </div>
    </div>
  );
}
