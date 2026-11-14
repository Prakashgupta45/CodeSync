'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/admin-auth-context';
import { LogOut, Moon, Sun, Shield, Menu } from 'lucide-react';

export interface AdminTopbarProps {
  title?: string;
  onOpenMobile?: () => void;
}

export function AdminTopbar({ title, onOpenMobile }: AdminTopbarProps) {
  const { user, logout } = useAdminAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('codesync-admin-theme') as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
    } else {
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(isDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('codesync-admin-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  return (
    <header className="h-16 bg-bg-surface border-b border-border-subtle px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        {onOpenMobile && (
          <button
            type="button"
            onClick={onOpenMobile}
            className="md:hidden p-2 -ml-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-card transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu size={20} />
          </button>
        )}

        <h1 className="text-sm sm:text-base font-bold text-text-main tracking-tight truncate">
          {title || 'Administrative Console'}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-card border border-border-subtle transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'dark' ? (
            <Sun size={15} className="text-amber-400" />
          ) : (
            <Moon size={15} className="text-slate-600" />
          )}
        </button>

        {/* User Identity */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-subtle">
          <div className="w-6 h-6 rounded-full bg-replit-orange/20 border border-replit-orange/40 flex items-center justify-center text-replit-orange font-bold text-[11px] shrink-0">
            <Shield size={12} />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-semibold text-text-main text-[11px] leading-tight truncate max-w-[120px]">
              {user?.name || 'Administrator'}
            </span>
            <span className="text-[10px] text-text-muted leading-tight truncate max-w-[120px]">
              {user?.email || 'admin@codesync.ai'}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 font-semibold transition-colors"
          title="Sign out of Admin Console"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
