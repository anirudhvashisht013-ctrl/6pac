import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { login, logout, signUp, restoreSession, isProfileComplete } from '@/lib/auth';
import { usersRepo } from '@/lib/storage';
import { seedUserData } from '@/lib/seed';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession().then(async (u) => {
      if (u) {
        setUser(u);
        await seedUserData(u.id);
      }
      setIsLoading(false);
    });
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const u = await login(email, password);
    await seedUserData(u.id);
    setUser(u);
  };

  const handleSignUp = async (email: string, password: string) => {
    const u = await signUp(email, password);
    await seedUserData(u.id);
    setUser(u);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    await usersRepo.save(updated);
    setUser(updated);
  };

  const handleRefreshUser = async () => {
    if (!user) return;
    const u = await usersRepo.getById(user.id);
    if (u) setUser(u);
  };

  const profileComplete = user ? isProfileComplete(user) : false;

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isProfileComplete: profileComplete,
    login: handleLogin,
    signUp: handleSignUp,
    logout: handleLogout,
    updateUser: handleUpdateUser,
    refreshUser: handleRefreshUser,
  }), [user, isLoading, profileComplete]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
