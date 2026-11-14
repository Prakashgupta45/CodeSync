'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Code2,
  ShieldCheck,
  Activity,
  Settings,
  Sparkles,
  Bot,
  ExternalLink,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/users', label: 'User Management', icon: Users },
  { href: '/interviews', label: 'Interview Management', icon: CalendarCheck },
  { href: '/rooms', label: 'Coding Rooms', icon: Code2 },
  { href: '/ai-usage', label: 'AI Usage Monitoring', icon: Bot },
  { href: '/executions', label: 'Code Executions', icon: Sparkles },
  { href: '/system-health', label: 'System Health', icon: Activity },
  { href: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isMobileOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // Close mobile drawer on route navigation
  useEffect(() => {
    if (isMobileOpen && onClose) {
      onClose();
    }
  }, [pathname, isMobileOpen, onClose]);

  // Close mobile drawer on Escape key press and prevent background scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onClose) {
        onClose();
      }
    };

    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onClose]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Branding Header */}
      <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-replit-orange/20 border border-replit-orange/40 flex items-center justify-center text-replit-orange font-bold text-sm">
            {'</>'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-text-main tracking-tight">CodeSync</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-replit-orange/20 text-replit-orange font-bold border border-replit-orange/30 uppercase">
                Admin
              </span>
            </div>
            <span className="text-[11px] text-text-muted">Central Management</span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-card transition-colors"
            aria-label="Close mobile sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-replit-orange text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-bg-card'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-text-muted'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Cross link to main app */}
      <div className="p-3 border-t border-border-subtle shrink-0">
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded text-xs text-text-muted hover:text-text-main hover:bg-bg-card transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink size={13} />
            <span>Open User App</span>
          </span>
          <span className="text-[10px] font-mono text-text-muted">:3000</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border-subtle flex-col shrink-0 min-h-screen sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Element */}
          <aside
            className="relative w-64 max-w-[80vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
