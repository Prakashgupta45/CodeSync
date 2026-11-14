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
  Search,
  LayoutGrid,
  CodeXml,
  ArrowRight,
  Loader2,
  MoreVertical,
  Check,
  Copy,
  Trash2,
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
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RoomsDashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
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

  // Check URL params for ?join=1 or ?create=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('join') === '1') {
        setJoinModalOpen(true);
      } else if (searchParams.get('create') === '1') {
        setCreateModalOpen(true);
      }
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.append('search', search.trim());
      if (languageFilter !== 'all') queryParams.append('language', languageFilter);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);

      const res = await fetch(`${API_BASE_URL}/rooms?${queryParams.toString()}`, {
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
      // Graceful error handling
    } finally {
      setIsLoading(false);
    }
  }, [search, languageFilter, statusFilter]);

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

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        !search.trim() ||
        room.name.toLowerCase().includes(search.toLowerCase()) ||
        room.id.toLowerCase().includes(search.toLowerCase());
      const matchesLang =
        languageFilter === 'all' ||
        room.language.toLowerCase() === languageFilter.toLowerCase();
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (room.status || 'ACTIVE').toUpperCase() === 'ACTIVE') ||
        (statusFilter === 'completed' && (room.status || '').toUpperCase() !== 'ACTIVE');
      return matchesSearch && matchesLang && matchesStatus;
    });
  }, [rooms, search, languageFilter, statusFilter]);

  return (
    <AppShell title="My rooms" subtitle="All your collaborative coding workspaces" onRoomCreated={fetchRooms}>
      <main className="dashboard-content">
        {/* Page Heading */}
        <div className="page-heading">
          <div>
            <div className="kicker">WORKSPACES</div>
            <h1>My coding rooms</h1>
            <p>Pick up where you left off or start something new.</p>
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
              Create room
            </button>
            <button
              className="app-button secondary"
              onClick={() => {
                setJoinError(null);
                setJoinModalOpen(true);
              }}
            >
              <GitBranch className="lucide" size={16} />
              Join room
            </button>
          </div>
        </div>

        {/* Toolbar Row */}
        <div className="toolbar-row">
          <label className="search-box room-search">
            <Search className="lucide" size={16} />
            <input
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
          >
            <option value="all">All languages</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          <div className="view-toggle">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid className="lucide" size={16} />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <CodeXml className="lucide" size={16} />
            </button>
          </div>
        </div>

        {/* Room List or Grid */}
        {isLoading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
            <Loader2 className="lucide animate-spin" size={28} style={{ margin: '0 auto 12px' }} />
            <p>Loading your rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: 'var(--text-muted, #94a3b8)', marginBottom: '16px' }}>
              {search || languageFilter !== 'all' || statusFilter !== 'all'
                ? 'No rooms matched your filters.'
                : 'You have no coding rooms yet.'}
            </p>
            <button
              className="app-button"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="lucide" size={16} /> Create Room
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="room-cards">
            {filteredRooms.map((room) => {
              const color = getLanguageColor(room.language);
              const isRoomActive = (room.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
              return (
                <Link
                  key={room.id}
                  className="room-card"
                  href={`/rooms/${room.id}`}
                >
                  <div className="room-card-top">
                    <span className={`room-dot ${color}`} />
                    <span className="status">
                      <i />
                      {isRoomActive ? 'Active' : 'Completed'}
                    </span>
                    <MoreVertical className="lucide" size={16} style={{ color: 'var(--text-muted, #94a3b8)' }} />
                  </div>
                  <h3>{room.name}</h3>
                  <p>{room.id}</p>
                  <div className="room-card-meta">
                    <span className="language-tag">{room.language}</span>
                    <span>{formatRelativeTime(room.updatedAt)}</span>
                  </div>
                  <div className="room-card-footer">
                    <span className="member-stack">
                      <i className="avatar purple">
                        {(user?.name || 'DEV').slice(0, 2).toUpperCase()}
                      </i>
                      {room.memberCount && room.memberCount > 1 ? (
                        <b>+{room.memberCount - 1}</b>
                      ) : null}
                    </span>
                    <span className="open-room">
                      Open room <ArrowRight className="lucide" size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel rooms-panel" style={{ marginTop: '16px' }}>
            <div className="room-table">
              <div className="table-head">
                <span>ROOM</span>
                <span>LANGUAGE</span>
                <span>MEMBERS</span>
                <span>STATUS</span>
                <span>LAST ACTIVITY</span>
                <span></span>
              </div>
              {filteredRooms.map((room) => {
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
              })}
            </div>
          </div>
        )}
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
                  placeholder="e.g. System Design Mock Interview"
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
