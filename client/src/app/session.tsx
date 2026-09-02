import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiCallError, type SessionUser } from '../api/client';

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(): Promise<void> {
    try {
      setUser(await api.me());
    } catch (e) {
      if (e instanceof ApiCallError) setUser(null);
      else throw e;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value: SessionState = {
    user,
    loading,
    refresh,
    login: async (nickname) => {
      setUser(await api.stubLogin(nickname));
    },
    logout: async () => {
      await api.logout();
      setUser(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession 必须在 SessionProvider 内使用');
  return v;
}
