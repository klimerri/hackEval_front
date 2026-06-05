import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from './api';
import type { AuthResponse, User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(Boolean(getToken()) && !user);

  const refresh = useCallback(async (): Promise<User | null> => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await api.get<User>('/auth/me');
      setSession(getToken()!, me);
      setUser(me);
      setLoading(false);
      return me;
    } catch {
      clearSession();
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    if (getToken() && !user) {
      void refresh();
    } else {
      setLoading(false);
    }

  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password }, false);
    setSession(res.access_token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {

      const res = await api.post<AuthResponse>(
        '/auth/register',
        { name, email, password },
        false,
      );
      setSession(res.access_token, res.user);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
