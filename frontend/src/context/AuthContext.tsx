import React, {createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import { User } from '../App';
import { toast } from 'sonner';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshing: boolean;
  login: (studentId: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  fetchWithAuth: (input: RequestInfo | URL, init?: RequestInit & { retry?: boolean }) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshPromiseRef = useRef<Promise<boolean>|null>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me', { credentials: 'include' });
      if (!res.ok) { setUser(null); return false; }
      const data = await res.json();
      const primaryRole = (data.role || 'STUDENT');
      if (!['ADMIN','REVIEWER','STUDENT'].includes(primaryRole)) return false;
      setUser({ id: data.studentId || 'me', studentId: data.studentId, name: data.name || data.studentId || '用户', role: primaryRole, department: data.department });
      return true;
    } catch { setUser(null); return false; }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current; // 并发复用
    const doRefresh = async (): Promise<boolean> => {
      if (refreshing) return false;
      setRefreshing(true);
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!res.ok) return false;
        await loadMe();
        return true;
      } catch {
        return false;
      } finally {
        setRefreshing(false);
        refreshPromiseRef.current = null;
      }
    };
    refreshPromiseRef.current = doRefresh();
    return refreshPromiseRef.current;
  }, [refreshing, loadMe]);

  const login = useCallback(async (studentId: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ studentId, password }) });
      if (!res.ok) return false;
      await loadMe();
      return true;
    } catch { return false; }
  }, [loadMe]);

  const logout = useCallback( async () => {
    try { await fetch('/api/auth/logout', { method:'POST', credentials:'include' }); } catch {}
    setUser(null);
  }, []);

  const fetchWithAuth: AuthContextValue['fetchWithAuth'] = useCallback(async (input, init) => {
    const res = await fetch(input, { ...init, credentials:'include' });
    // 403: 直接提示并重定向（无刷新意义）
    if(res.status === 403){
      toast.error('无权限或登录过期');
      await logout();
      try { window.location.replace('/'); } catch {}
      return res;
    }
    // 401: 若非 retry 则尝试 refresh；retry 时直接返回以避免循环
    if(res.status !== 401 || init?.retry) return res;
    const ok = await refresh();
    if(ok){
      const retryRes = await fetch(input, { ...init, credentials:'include', retry:true });
      if(retryRes.status === 403){
        toast.error('无权限访问');
        await logout();
        try { window.location.replace('/'); } catch {}
      }
      return retryRes;
    }
    toast.error('登录状态失效，请重新登录');
    await logout();
    try { window.location.replace('/'); } catch {}
    return res;
  }, [refresh, logout]);

  useEffect(() => { (async ()=> { await loadMe(); setLoading(false); })(); }, [loadMe]);
  useEffect(() => { const id = setInterval(()=> { refresh(); }, 10 * 60 * 1000); return () => clearInterval(id); }, [refresh]);

  return <AuthContext.Provider value={{user, loading, refreshing, login, logout, refresh, fetchWithAuth}}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
