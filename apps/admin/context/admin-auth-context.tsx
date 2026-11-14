'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminApi } from '../lib/api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  status?: string;
  avatarUrl?: string | null;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshProfile = useCallback(async () => {
    try {
      const res = await adminApi.getMe();
      if (res.success && res.data) {
        const adminUser = (res.data as any).user || res.data;
        if (adminUser.role !== 'ADMIN') {
          setUser(null);
          await adminApi.logout().catch(() => {});
          if (pathname !== '/login') {
            router.push('/login?error=unauthorized');
          }
          return;
        }
        setUser(adminUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await adminApi.login(credentials);
    if (!res.success || !res.data?.user) {
      throw new Error(res.error?.message || 'Login failed');
    }

    if (res.data.user.role !== 'ADMIN') {
      await adminApi.logout().catch(() => {});
      throw new Error('Access denied. Administrator role required to access this portal.');
    }

    setUser(res.data.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await adminApi.logout();
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
