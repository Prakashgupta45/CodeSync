'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserDto, RegisterInput, LoginInput } from '@codesync/shared';

interface AuthContextType {
  user: UserDto | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch current authenticated user via HTTP-only cookie
  const fetchCurrentUser = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Includes HTTP-only cookies
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.user) {
          setUser(result.data.user);
          return true;
        }
      }
      setUser(null);
      return false;
    } catch (err) {
      setUser(null);
      return false;
    }
  }, []);

  // Silent Token Refresh Handler
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.user) {
          setUser(result.data.user);
          return true;
        }
      }
      setUser(null);
      return false;
    } catch (err) {
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const isSuccess = await fetchCurrentUser();
      if (!isSuccess) {
        // Try refreshing if access token expired
        await refreshSession();
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchCurrentUser, refreshSession]);

  const login = async (input: LoginInput) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error?.message || 'Login failed');
    }

    setUser(result.data.user);
  };

  const register = async (input: RegisterInput) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error?.message || 'Registration failed');
    }

    setUser(result.data.user);
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
