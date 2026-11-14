'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { RoomDto } from '@codesync/shared';
import { AppShell } from '../../components/layout/app-shell';
import {
  Plus,
  GitBranch,
  Code2,
  Radio,
  Check,
  Users,
  ArrowRight,
  Bot,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

function getLanguageColor(lang: string): string {
  switch (lang.toLowerCase()) {
    case 'typescript':
      return 'orange';
    case 'python':
      return 'blue';
    case 'javascript':
      return 'purple';
    case 'java':
      return 'orange';
    case 'cpp':
    case 'c++':
      return 'blue';
    default:
      return 'orange';
  }
}

function formatRelativeTime(dateString?: string | Date): string {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [isRoomsLoading, setIsRoomsLoading] = useState<boolean>(true);

  // Modals controlled by AppShell
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Create room modal state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLanguage, setNewRoomLanguage] = useState<'javascript' | 'typescript' | 'python' | 'cpp' | 'java'>('typescript');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join room modal state
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      setIsRoomsLoading(true);
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setRooms(data.data);
        }
      }
    } catch {
      // Keep silent for smooth UX
    } finally {
      setIsRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/sign-in');
    } else if (user) {
      fetchRooms();
    }
  }, [user, isAuthLoading, router, fetchRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
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
      fetchRooms();
      router.push(`/rooms/${data.data.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) {
      setJoinError('Please enter a valid room ID');
      return;
    }
    setJoinModalOpen(false);
    router.push(`/rooms/${joinRoomId.trim()}`);
  };

  const activeRooms = useMemo(
    () => rooms.filter((r) => r.status?.toUpperCase() === 'ACTIVE'),
    [rooms]
  );
  const completedRooms = useMemo(
    () => rooms.filter((r) => r.status?.toUpperCase() === 'ARCHIVED' || r.status?.toUpperCase() === 'COMPLETED'),
    [rooms]
  );
  const totalCollaborators = useMemo(() => {
    return rooms.reduce((acc, r) => acc + (r.memberCount || 1), 0);
  }, [rooms]);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Developer';

  return (
    <AppShell title="Overview" subtitle={formattedDate} onRoomCreated={fetchRooms}>
      <main className="dashboard-content">
        {/* Welcome Row */}
        <div className="welcome-row">
          <div>
            <div className="kicker">YOUR WORKSPACE</div>
            <h1>
              Welcome back, {firstName}
              <span>.</span>
            </h1>
            <p>Continue collaborating, coding, and building together.</p>
          </div>
          <div className="welcome-actions">
            <button
              className="app-button"
              onClick={() => {
                setCreateError(null);
                setCreateModalOpen(true);
              }}
            >
              <Plus className="lucide" size={16} />
              Create new room
            </button>
            <button
              className="app-button secondary"
              onClick={() => {
                setJoinError(null);
                setJoinModalOpen(true);
              }}
            >
              <GitBranch className="lucide" size={16} />
              Join existing
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon">
              <Code2 className="lucide" size={20} />
            </div>
            <span>Total rooms</span>
            <strong>{rooms.length}</strong>
            <small>{rooms.length === 0 ? 'No rooms yet' : 'In your account'}</small>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Radio className="lucide" size={20} />
            </div>
            <span>Active rooms</span>
            <strong>{activeRooms.length}</strong>
            <small>Live right now</small>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Check className="lucide" size={20} />
            </div>
            <span>Completed sessions</span>
            <strong>{completedRooms.length}</strong>
            <small>Recorded</small>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Users className="lucide" size={20} />
            </div>
            <span>Collaborators</span>
            <strong>{totalCollaborators}</strong>
            <small>Across your rooms</small>
          </article>
        </section>

        {/* Dashboard Grid */}
        <section className="dashboard-grid">
          {/* Left: Rooms Panel */}
          <div className="panel rooms-panel">
            <div className="panel-heading">
              <div>
                <h2>My coding rooms</h2>
                <p>Your most recent collaborative workspaces</p>
              </div>
              <Link href="/rooms">
                View all <ArrowRight className="lucide" size={16} />
              </Link>
            </div>

            <div className="room-table">
              <div className="table-head">
                <span>ROOM</span>
                <span>LANGUAGE</span>
                <span>MEMBERS</span>
                <span>STATUS</span>
                <span>LAST ACTIVITY</span>
                <span></span>
              </div>

              {isRoomsLoading ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                  <Loader2 className="lucide animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px' }}>Loading workspaces...</p>
                </div>
              ) : rooms.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)', marginBottom: '16px' }}>
                    You have not created or joined any coding rooms yet.
                  </p>
                  <button
                    className="app-button"
                    onClick={() => setCreateModalOpen(true)}
                  >
                    <Plus className="lucide" size={14} /> Create your first room
                  </button>
                </div>
              ) : (
                rooms.slice(0, 6).map((room) => {
                  const color = getLanguageColor(room.language);
                  const isRoomActive = (room.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
                  return (
                    <Link
                      key={room.id}
                      className="table-row"
                      href={`/rooms/${room.id}`}
                    >
                      <div>
                        <span className={`room-dot ${color}`} />
                        <strong>{room.name}</strong>
                        <small>{room.id.slice(0, 14)}...</small>
                      </div>
                      <span className="language-tag">{room.language}</span>
                      <span className="member-stack">
                        <i className="avatar purple">
                          {(user?.name || 'DEV').slice(0, 2).toUpperCase()}
                        </i>
                        {room.memberCount && room.memberCount > 1 ? (
                          <b>+{room.memberCount - 1}</b>
                        ) : null}
                      </span>
                      <span className={`status ${isRoomActive ? 'active' : 'completed'}`}>
                        <i />
                        {isRoomActive ? 'Active' : 'Completed'}
                      </span>
                      <span className="muted">{formatRelativeTime(room.updatedAt)}</span>
                      <ArrowRight className="lucide" size={16} />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Activity Panel */}
          <div className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <h2>Recent activity</h2>
                <p>What is happening in your workspace</p>
              </div>
            </div>

            <div className="activity-list">
              {rooms.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 500 }}>No recent activity yet</p>
                  <small style={{ fontSize: '11px', display: 'block' }}>Create a coding room to start collaborating</small>
                </div>
              ) : (
                rooms.slice(0, 3).map((r) => {
                  const isRoomActive = (r.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
                  const color = getLanguageColor(r.language);
                  return (
                    <div key={r.id}>
                      <span className={`activity-icon ${color}`}>
                        <Code2 className="lucide" size={16} />
                      </span>
                      <p>
                        <strong>{r.name}</strong>
                        <br />
                        <span style={{ textTransform: 'capitalize' }}>{r.language}</span> &bull; {isRoomActive ? 'Active' : 'Completed'}
                        <small>{formatRelativeTime(r.updatedAt)}</small>
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <Link className="activity-link" href="/rooms">
              See all activity <ArrowRight className="lucide" size={14} />
            </Link>
          </div>
        </section>
      </main>

      {/* Create Room Modal */}
      {createModalOpen && (
        <div className="modal-backdrop" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Coding Room</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRoom}>
              {createError && (
                <div className="modal-error">
                  <span>{createError}</span>
                </div>
              )}
              <label className="modal-label">
                Room Name
                <input
                  type="text"
                  placeholder="e.g. Algorithms & Data Structures"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <label className="modal-label">
                Programming Language
                <select
                  value={newRoomLanguage}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setNewRoomLanguage(e.target.value as typeof newRoomLanguage)
                  }
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3.11</option>
                  <option value="java">Java 21</option>
                  <option value="cpp">C++ 20</option>
                </select>
              </label>

              <div className="modal-footer">
                <button
                  type="button"
                  className="app-button secondary"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-button"
                  disabled={isCreating}
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
        <div className="modal-backdrop" onClick={() => setJoinModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Join Existing Room</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setJoinModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleJoinRoom}>
              {joinError && (
                <div className="modal-error">
                  <span>{joinError}</span>
                </div>
              )}
              <label className="modal-label">
                Room ID or Invite Code
                <input
                  type="text"
                  placeholder="Paste room UUID or code here"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <div className="modal-footer">
                <button
                  type="button"
                  className="app-button secondary"
                  onClick={() => setJoinModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="app-button">
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
