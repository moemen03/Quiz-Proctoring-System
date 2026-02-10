'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'ta';
  major: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, major: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const session = localStorage.getItem('session');
      if (!session) {
        setLoading(false);
        return;
      }

      const { access_token } = JSON.parse(session);
      if (!access_token) {
        setLoading(false);
        return;
      }

      // Verify token and get user
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('session');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      localStorage.removeItem('session');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('session', JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }));
    
    setUser(data.user);
  };

  const signup = async (email: string, password: string, name: string, major: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, major }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Signup failed');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    localStorage.removeItem('session');
    setUser(null);
    router.push('/login');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
