import { Link } from 'react-router-dom';
import { useSession } from '../session';
import s from '../app.module.css';

export function Home() {
  const { user, loading } = useSession();
  if (loading) return <div className={s.page}>…</div>;

  if (user) {
    return (
      <div className={s.page}>
        <h1>给身边的陌生人，写一段祝福</h1>
        <p className={s.lead}>
          你不认识 TA。选一个范围——比如"三公里内、正在熬夜的人"——把一句好话送过去。
        </p>
        <div className={s.card}>
          <Link to="/compose">
            <button>写一段祝福</button>
          </Link>{' '}
          <Link to="/inbox">
            <button className="ghost">看看我收到的</button>
          </Link>
        </div>
        <p className={s.hint}>先去个人空间设好位置和标签，别人才筛得到你、你也才能群发。</p>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <h1>BestWishes</h1>
      <p className={s.lead}>
        练习专注，传递善意。给附近的陌生人写一段认真的祝福；也在收件箱里，收到别人给你的。
      </p>
      <div className={s.card}>
        <Link to="/login">
          <button>开始</button>
        </Link>
        <p className={s.hint}>这里没有聊天，只有一来一回的祝福。</p>
      </div>
    </div>
  );
}
