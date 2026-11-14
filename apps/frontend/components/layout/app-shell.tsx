'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/auth-context';
import {
  LayoutDashboard,
  FolderGit2,
  FolderPlus,
  GitBranch,
  Bot,
  Settings,
  Users,
  LogOut,
  Search,
  Bell,
  X,
  Plus,
  Loader2,
  Terminal,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  contentClassName?: string;
  onRoomCreated?: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  subtitle,
  contentClassName = '',
  onRoomCreated,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Create room state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLanguage, setNewRoomLanguage] = useState<'javascript' | 'typescript' | 'python' | 'cpp' | 'java'>('typescript');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join room state
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('codesync-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/sign-in');
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      setCreateError('Please enter a room name');
      return;
    }
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newRoomName.trim(), language: newRoomLanguage }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create room');
      }
      setCreateModalOpen(false);
      setNewRoomName('');
      if (onRoomCreated) onRoomCreated();
      router.push(`/rooms/${data.data.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) {
      setJoinError('Please enter a valid room ID');
      return;
    }
    setJoinModalOpen(false);
    router.push(`/rooms/${joinRoomId.trim()}`);
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DEV';

  return (
    <div className="app-shell">
      {/* 1. App Sidebar */}
      <aside className="app-sidebar">
        <Link className="app-brand" href="/">
          <span>Code</span>Sync <small>AI</small>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav>
          <Link
            className={pathname === '/dashboard' ? 'active' : ''}
            href="/dashboard"
          >
            <LayoutDashboard className="lucide" />
            Overview
          </Link>
          <Link
            className={pathname.startsWith('/rooms') && !pathname.includes('interview') ? 'active' : ''}
            href="/rooms"
          >
            <FolderGit2 className="lucide" />
            My Rooms
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateModalOpen(true);
            }}
          >
            <FolderPlus className="lucide" />
            Create Room
            <span className="nav-plus">+</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setJoinError(null);
              setJoinModalOpen(true);
            }}
          >
            <GitBranch className="lucide" />
            Join Room
          </button>
          <Link
            className={pathname.includes('/interview') ? 'active' : ''}
            href="/interview"
          >
            <Bot className="lucide" />
            AI Interviewer
          </Link>
        </nav>

        <div className="sidebar-label">ACCOUNT</div>
        <nav>
          <Link
            className={pathname === '/settings' ? 'active' : ''}
            href="/settings"
          >
            <Settings className="lucide" />
            Settings
          </Link>
          <Link
            className={pathname === '/profile' ? 'active' : ''}
            href="/profile"
          >
            <Users className="lucide" />
            Profile
          </Link>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-user">
          <span className="avatar orange">{initials}</span>
          <div>
            <strong>{user?.name || 'Developer'}</strong>
            <small>{user?.role || 'Developer'}</small>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-logout"
          onClick={handleLogout}
        >
          <LogOut className="lucide" />
          Log out
        </button>
      </aside>

      {/* 2. App Main Content Area */}
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <div className="topbar-title">{title}</div>
            <div className="topbar-subtitle">{subtitle}</div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search className="lucide" />
              <input
                placeholder="Search rooms..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    router.push(`/rooms?search=${encodeURIComponent(target.value)}`);
                  }
                }}
              />
            </label>
            <button
              className="app-icon-btn"
              onClick={toggleTheme}
              aria-label="Switch theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☼' : '☾'}
            </button>
            <button
              className="app-icon-btn"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="lucide" />
              <i />
            </button>
            <Link className="avatar orange" href="/profile">
              {initials}
            </Link>
          </div>
        </header>

        <main className={`dashboard-content ${contentClassName}`}>
          {children}
        </main>
      </div>

      {/* Create Room Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="auth-card" style={{ maxWidth: 440, width: '100%', margin: 0, padding: 24 }}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle">
              <div className="kicker">NEW WORKSPACE</div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-text-muted hover:text-text-main p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Create coding room</h1>
            <p className="auth-copy" style={{ marginBottom: 16 }}>
              Initialize an isolated environment with real-time CRDT sync.
            </p>

            {createError && (
              <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 12 }}>{createError}</p>
            )}

            <form onSubmit={handleCreateRoomSubmit} className="space-y-4">
              <label>
                Room title
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Distributed Consensus Engine"
                  autoFocus
                />
              </label>

              <label>
                Target Language Runtime
                <select
                  value={newRoomLanguage}
                  onChange={(e) => setNewRoomLanguage(e.target.value as typeof newRoomLanguage)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  <option value="typescript">TypeScript (Node.js 20)</option>
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3 (CPython 3.11)</option>
                  <option value="cpp">C++ (GCC 13)</option>
                  <option value="java">Java (OpenJDK 21)</option>
                </select>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  className="app-button secondary"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="app-button"
                >
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="auth-card" style={{ maxWidth: 420, width: '100%', margin: 0, padding: 24 }}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle">
              <div className="kicker">COLLABORATE</div>
              <button
                onClick={() => setJoinModalOpen(false)}
                className="text-text-muted hover:text-text-main p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Join existing room</h1>
            <p className="auth-copy" style={{ marginBottom: 16 }}>
              Paste the room ID or invite link from your team.
            </p>

            {joinError && (
              <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 12 }}>{joinError}</p>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <label>
                Room ID
                <input
                  type="text"
                  required
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="e.g. 4bb544ce-4e56-4785-a4d8-30727149d25d"
                  autoFocus
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  className="app-button secondary"
                  onClick={() => setJoinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-button"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
