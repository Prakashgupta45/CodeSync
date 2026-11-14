'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/auth-context';
import { ThemeToggle } from './theme-toggle';
import {
  LayoutDashboard,
  FolderGit2,
  Sparkles,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Terminal,
  Plus,
} from 'lucide-react';

interface NavbarProps {
  activeTab?: string;
}

export const AppNavbar: React.FC<NavbarProps> = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/sign-in');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/rooms', label: 'Rooms', icon: FolderGit2 },
    { href: '/interview', label: 'AI Interviewer', icon: Sparkles, badge: 'Active' },
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="border-b border-border-subtle bg-bg-surface sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-text-main group-hover:text-replit-orange transition-colors">
              CodeSync
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-bg-secondary text-text-main font-semibold border border-border-subtle shadow-sm'
                      : 'text-text-muted hover:text-text-main hover:bg-bg-secondary/60'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-replit-orange' : 'text-text-muted'
                    }`}
                  />
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-replit-orange/15 text-replit-orange font-bold border border-replit-orange/30">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: Quick Action, Theme Toggle & User Menu */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/rooms/create"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-replit-orange text-white hover:bg-orange-600 text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Room</span>
          </Link>

          <ThemeToggle />

          {/* User Profile Dropdown */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-bg-secondary hover:bg-bg-secondary/80 border border-border-subtle text-xs transition-colors"
                aria-expanded={userDropdownOpen}
              >
                <div className="w-5 h-5 rounded-full bg-replit-orange/20 border border-replit-orange/40 text-replit-orange flex items-center justify-center font-bold text-[10px]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-medium text-text-main max-w-[120px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="w-3 h-3 text-text-muted" />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-lg bg-bg-surface border border-border-subtle shadow-2xl py-1.5 z-50 text-xs font-sans">
                    <div className="px-3.5 py-2 border-b border-border-subtle">
                      <p className="font-semibold text-text-main truncate">{user.name}</p>
                      <p className="text-[11px] text-text-muted truncate font-mono">{user.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-text-muted hover:text-text-main hover:bg-bg-secondary transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-replit-orange" />
                        <span>Profile & Statistics</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-text-muted hover:text-text-main hover:bg-bg-secondary transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Preferences & Settings</span>
                      </Link>
                    </div>

                    <div className="border-t border-border-subtle pt-1 mt-1">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded text-text-muted hover:text-text-main hover:bg-bg-secondary"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border-subtle bg-bg-surface px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium ${
                  isActive
                    ? 'bg-bg-secondary text-text-main font-semibold'
                    : 'text-text-muted hover:text-text-main hover:bg-bg-secondary/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-replit-orange" />
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-replit-orange/20 text-replit-orange font-bold">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
