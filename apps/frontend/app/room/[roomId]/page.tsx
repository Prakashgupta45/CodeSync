'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { RoomDto, RoomMemberDto, RoomPresenceUserDto, RoomRole } from '@codesync/shared';
import { Socket } from 'socket.io-client';
import { RoomChatPanel } from '../../../components/chat/room-chat-panel';
import { ExecutionConsole } from '../../../components/editor/execution-console';
import { AiAssistantPanel } from '../../../components/ai/ai-assistant-panel';
import { RoomVideoPanel } from '../../../components/video/room-video-panel';
import { LanguageDropdown, getLanguageDisplay } from '../../../components/editor/language-dropdown';
import {
  getStarterCode,
  checkLanguageMismatch,
  isCodeEmptyOrWhitespace,
  getDefaultFilenameForLanguage,
  getLanguageForFilename,
  normalizeLang,
} from '../../../components/editor/language-templates';
import {
  ArrowLeft,
  Copy,
  Check,
  Video,
  Bot,
  Plus,
  Loader2,
  Trash2,
  Users,
  MessageSquare,
  Sparkles,
  ChevronDown,
  UserX,
  Shield,
  FileCode,
  Zap,
  FolderTree,
  AlertTriangle,
  X,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Dynamic import for Monaco Editor component (CSR only)
const RealtimeEditor = nextDynamic(
  () => import('../../../components/editor/realtime-editor').then((m) => m.RealtimeEditor),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #0f172a)', color: 'var(--text-muted, #94a3b8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
          <Loader2 className="animate-spin" size={20} color="#ff5c00" />
          <span>Initializing Monaco & Yjs engine...</span>
        </div>
      </div>
    ),
  }
);

import type { editor as MonacoEditor } from 'monaco-editor';
export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId || '';

  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const stableUser = React.useMemo(
    () => ({ id: user?.id || '', name: user?.name || '' }),
    [user?.id, user?.name]
  );
  const editorInstanceRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const docApiRef = useRef<{
    addFile: (name: string, initialCode?: string) => void;
    removeFile: (name: string) => void;
    renameFile: (oldName: string, newName: string) => void;
    setActiveFileContent?: (content: string) => void;
  } | null>(null);
  const [currentEditorCode, setCurrentEditorCode] = useState<string>('');
  const [dismissedMismatchKey, setDismissedMismatchKey] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [formatNotice, setFormatNotice] = useState<string | null>(null);

  const [room, setRoom] = useState<RoomDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const currentEditorCodeRef = useRef<string>('');
  const codeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCodeChange = useCallback((code: string) => {
    currentEditorCodeRef.current = code;
    if (codeDebounceTimerRef.current) {
      clearTimeout(codeDebounceTimerRef.current);
    }
    codeDebounceTimerRef.current = setTimeout(() => {
      setCurrentEditorCode(code);
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (codeDebounceTimerRef.current) {
        clearTimeout(codeDebounceTimerRef.current);
      }
    };
  }, []);

  const handleWorkspaceFilesSync = useCallback((syncedFiles: string[]) => {
    if (syncedFiles.length > 0) {
      setFiles(syncedFiles);
    }
  }, []);

  const handleLanguageUpdate = useCallback((newLang: string) => {
    setRoom((prev) => (prev ? { ...prev, language: newLang } : prev));
  }, []);

  const handleDocInit = useCallback((api: any) => {
    docApiRef.current = api;
  }, []);

  const handleEditorMount = useCallback((ed: any) => {
    editorInstanceRef.current = ed;
    const val = ed.getValue();
    currentEditorCodeRef.current = val;
    setCurrentEditorCode(val);
  }, []);

  const handleSocketInit = useCallback((s: Socket) => {
    setSocket(s);
  }, []);

  const handleCodeGetterInit = useCallback((getter: () => string) => {
    setCodeGetter(() => getter);
  }, []);
  const [sidebarTab, setSidebarTab] = useState<'members' | 'chat' | 'assistant'>('members');
  const [isExplorerOpen, setIsExplorerOpen] = useState<boolean>(true);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const [isWebRtcCallActive, setIsWebRtcCallActive] = useState<boolean>(false);

  // Files in workspace
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('solution.ts');

  // Real-Time Socket.IO, Presence, & Execution
  const [socket, setSocket] = useState<Socket | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<RoomPresenceUserDto[]>([]);
  const [codeGetter, setCodeGetter] = useState<(() => string) | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const roomMembersRef = useRef<RoomMemberDto[]>([]);
  const isRefreshingMembersRef = useRef<boolean>(false);

  useEffect(() => {
    roomMembersRef.current = room?.members || [];
  }, [room?.members]);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    if (saved === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
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

  const fetchRoomDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.status === 403) {
        const joinRes = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (joinRes.ok) {
          res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Unable to join or find room');
      }

      const result = await res.json();
      if (result.success && result.data) {
        setRoom(result.data);

        // Populate virtual workspace files based on language
        const lang = result.data.language || 'typescript';
        const initialFile = getDefaultFilenameForLanguage(lang);
        setFiles([initialFile]);
        setActiveFile(initialFile);
      } else {
        throw new Error('Invalid room response format');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to room');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const refreshMembers = useCallback(async () => {
    if (!roomId || isRefreshingMembersRef.current) return;
    isRefreshingMembersRef.current = true;
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/members`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return;
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const fetchedMembers: RoomMemberDto[] = result.data;
        roomMembersRef.current = fetchedMembers;
        setRoom((prev) => {
          if (!prev) return prev;
          const selfMember = fetchedMembers.find((m) => m.userId === user?.id);
          return {
            ...prev,
            members: fetchedMembers,
            memberCount: fetchedMembers.length,
            ...(selfMember ? { role: selfMember.role } : {}),
          };
        });
      }
    } catch (_) {
      // Transient fetch failure should not break existing workspace state
    } finally {
      isRefreshingMembersRef.current = false;
    }
  }, [roomId, user?.id]);

  const applyAuthoritativeRole = useCallback(
    (targetUserId: string, nextRole: RoomRole, updatedMember?: RoomMemberDto) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const currentMembers = prev.members || [];
        const hasMember = currentMembers.some((m) => m.userId === targetUserId);
        const nextMembers = hasMember
          ? currentMembers.map((m) =>
              m.userId === targetUserId
                ? { ...m, ...(updatedMember || {}), role: nextRole }
                : m
            )
          : updatedMember
          ? [...currentMembers, updatedMember]
          : currentMembers;

        roomMembersRef.current = nextMembers;

        return {
          ...prev,
          members: nextMembers,
          ...(targetUserId === user?.id ? { role: nextRole } : {}),
        };
      });

      setPresenceUsers((prev) =>
        prev.map((u) => (u.userId === targetUserId ? { ...u, role: nextRole } : u))
      );
    },
    [user?.id]
  );

  const handleRoleUpdate = useCallback(
    (nextRole: any) => {
      if (user?.id) {
        applyAuthoritativeRole(user.id, nextRole);
      }
    },
    [user?.id, applyAuthoritativeRole]
  );

  const handlePresenceUpdate = useCallback(
    (users: RoomPresenceUserDto[]) => {
      setPresenceUsers(users);
      const knownIds = new Set(roomMembersRef.current.map((m) => m.userId));
      const hasUnknownActiveUser = users.some((u) => !knownIds.has(u.userId));
      if (hasUnknownActiveUser) {
        refreshMembers();
      }
    },
    [refreshMembers]
  );

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleMembersUpdated = (data: { roomId: string; action?: string; userId?: string }) => {
      if (data?.roomId === roomId) {
        refreshMembers();
      }
    };

    const handlePresenceJoin = (data: { userId?: string }) => {
      if (!data?.userId) return;
      const alreadyKnown = roomMembersRef.current.some((m) => m.userId === data.userId);
      if (!alreadyKnown) {
        refreshMembers();
      }
    };

    const handleRoleUpdated = (data: {
      roomId: string;
      userId: string;
      role: RoomRole;
      member?: RoomMemberDto;
    }) => {
      if (!data || data.roomId !== roomId || !data.userId || !data.role) return;
      const alreadyKnown = roomMembersRef.current.some((m) => m.userId === data.userId);
      applyAuthoritativeRole(data.userId, data.role, data.member);
      if (!alreadyKnown && !data.member) {
        refreshMembers();
      }
    };

    const handleLanguageUpdated = (data: { roomId: string; language: string; targetFile?: string; userId?: string }) => {
      if (!data || data.roomId !== roomId || !data.language) return;
      setRoom((prev) => (prev ? { ...prev, language: data.language } : prev));
      if (data.targetFile) {
        setFiles((prev) => (prev.includes(data.targetFile!) ? prev : [...prev, data.targetFile!]));
        setActiveFile(data.targetFile);
      }
    };

    socket.on('room:members-updated', handleMembersUpdated);
    socket.on('presence:join', handlePresenceJoin);
    socket.on('room:role-updated', handleRoleUpdated);
    socket.on('room:language-updated', handleLanguageUpdated);

    return () => {
      socket.off('room:members-updated', handleMembersUpdated);
      socket.off('presence:join', handlePresenceJoin);
      socket.off('room:role-updated', handleRoleUpdated);
      socket.off('room:language-updated', handleLanguageUpdated);
    };
  }, [socket, roomId, refreshMembers, applyAuthoritativeRole]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/sign-in');
    } else if (user) {
      fetchRoomDetails();
    }
  }, [user, isAuthLoading, router, fetchRoomDetails]);

  const handleCopyLink = () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = async () => {
    if (!confirm('Leave this coding room?')) return;
    try {
      setIsLeaving(true);
      await fetch(`${API_BASE_URL}/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      router.push('/rooms');
    } catch {
      router.push('/rooms');
    }
  };

  const handleDeleteRoom = async () => {
    if (!confirm('Are you sure you want to permanently delete this room? This action cannot be undone.')) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to delete room');
      }
      router.push('/rooms');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete room');
      setIsDeleting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Remove member ${memberName} from this room?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/members/${memberUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to remove member');
      }
      fetchRoomDetails();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: string) => {
    try {
      setUpdatingMemberId(memberUserId);
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/members/${memberUserId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update member role');
      }
      await fetchRoomDetails();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update member role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const userMember = room?.members?.find((m) => m.userId === user?.id);
  const isOwner = Boolean(
    room && user && (room.ownerId === user.id || room.role === 'OWNER' || userMember?.role === 'OWNER')
  );
  const currentRole = userMember?.role || room?.role || (isOwner ? 'OWNER' : 'PARTICIPANT');

  const handleLanguageChange = useCallback(
    async (newLanguage: string) => {
      if (!room || currentRole === 'VIEWER') return;
      const normalized = normalizeLang(newLanguage);
      const targetFile = getDefaultFilenameForLanguage(normalized);

      // 1. Immediately update local state
      setRoom((prev) => (prev ? { ...prev, language: normalized } : prev));

      // 2. Ensure targetFile is added to workspace and seeded with starter code if absent
      setFiles((prev) => {
        if (!prev.includes(targetFile)) {
          const starter = getStarterCode(normalized);
          docApiRef.current?.addFile(targetFile, starter);
          return [...prev, targetFile];
        }
        return prev;
      });

      // 3. Switch active file to targetFile
      setActiveFile(targetFile);

      // 4. Broadcast via Socket.IO to all room participants
      if (socket && socket.connected) {
        socket.emit('room:language-change', {
          roomId: room.id,
          language: normalized,
          targetFile,
        });
      }

      // 5. Persist to PostgreSQL backend via REST API
      try {
        await fetch(`${API_BASE_URL}/rooms/${room.id}/language`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ language: normalized }),
        });
      } catch (err) {
        console.error('Failed to persist room language:', err);
      }
    },
    [room, currentRole, socket]
  );

  if (isAuthLoading || isLoading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #0b0f19)', color: 'var(--text-main, #f8fafc)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 className="animate-spin" size={32} color="#ff5c00" />
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
            Loading CodeSync IDE...
          </p>
        </div>
      </div>
    );
  }

  if (error || !room || !user) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #0b0f19)' }}>
        <div className="panel" style={{ maxWidth: '420px', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Room Error</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginBottom: '20px' }}>
            {error || 'Room not found'}
          </p>
          <Link href="/rooms" className="app-button">
            <ArrowLeft size={14} /> Back to Rooms
          </Link>
        </div>
      </div>
    );
  }

  const onlineCount = Math.max(1, presenceUsers.length);

  return (
    <div className="ide-shell">
      {/* 1. IDE Toolbar */}
      <header className="ide-toolbar">
        <Link className="ide-back" href="/dashboard">
          <ArrowLeft size={16} /> Dashboard
        </Link>

        <div className="ide-room-name">
          <strong>{room.name}</strong>
          <span>{room.id.slice(0, 12)}...</span>
          <button
            onClick={handleCopyLink}
            title={copied ? 'Copied!' : 'Copy Room ID'}
          >
            {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
          </button>
        </div>

        <LanguageDropdown
          value={room.language}
          onChange={handleLanguageChange}
          disabled={currentRole === 'VIEWER'}
          theme={theme}
        />

        <span className="ide-live">
          <i /> Active
        </span>

        <div className="ide-toolbar-spacer" />

        <button
          className="ide-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>

        <button
          className="ide-invite-button"
          onClick={handleCopyLink}
        >
          {copied ? <Check size={14} /> : <Plus size={14} />}
          {copied ? 'Copied Link' : 'Invite link'}
        </button>

        <span className="ide-participants">
          <i className="avatar purple">
            {user.name.slice(0, 2).toUpperCase()}
          </i>
          {room.members && room.members.length > 1 && (
            <i className="avatar blue">
              {(room.members[1].user?.name || 'CO').slice(0, 2).toUpperCase()}
            </i>
          )}
        </span>

        <button
          className="ide-tool"
          onClick={() => setIsVideoModalOpen(true)}
          style={isWebRtcCallActive ? { borderColor: 'rgba(34, 197, 94, 0.4)', color: '#22c55e' } : {}}
        >
          <Video size={15} /> Video call
        </button>

        <Link
          className="ide-tool"
          href={`/rooms/${room.id}/interview`}
        >
          <Bot size={15} /> Interview
        </Link>

        {isOwner && (
          <button
            className="ide-tool"
            onClick={handleDeleteRoom}
            disabled={isDeleting}
            title="Delete Room (Owner)"
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={14} />
          </button>
        )}

        <button
          className="ide-leave"
          onClick={handleLeaveRoom}
          disabled={isLeaving}
        >
          Leave room
        </button>
      </header>

      {/* 2. IDE Workspace */}
      <div className="ide-workspace">
        {/* Main Center Area */}
        <main className="ide-center">
          {/* Breadcrumb Header */}
          <div className="ide-breadcrumb" style={{ background: theme === 'light' ? '#ffffff' : '#151719', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))' }}>
            <span style={{ color: theme === 'light' ? '#0f172a' : '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <FileCode size={14} color="#ff5c00" /> src
            </span>
            <ChevronDown size={14} style={{ color: theme === 'light' ? '#64748b' : '#94a3b8' }} />
            <span style={{ color: theme === 'light' ? '#0f172a' : '#f8fafc', fontWeight: 700 }}>
              {activeFile}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                if (codeGetter) {
                  navigator.clipboard.writeText(codeGetter());
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }
              }}
              style={{ color: theme === 'light' ? '#334155' : '#cbd5e1' }}
            >
              {copiedCode ? <Check size={13} color="#22c55e" /> : <Copy size={13} />} {copiedCode ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={async () => {
                const action = editorInstanceRef.current?.getAction('editor.action.formatDocument');
                if (action) {
                  await action.run();
                  setFormatNotice('Formatted');
                } else {
                  setFormatNotice('No formatter for language');
                }
                setTimeout(() => setFormatNotice(null), 2000);
              }}
              style={{ color: theme === 'light' ? '#334155' : '#cbd5e1' }}
            >
              <Zap size={13} /> {formatNotice || 'Format'}
            </button>
          </div>

          {/* Editor Container */}
          <div className="code-editor">
            {/* File Tree Explorer (Collapsible) */}
            {isExplorerOpen && (
              <div
                className="file-tree"
                style={{
                  background: theme === 'light' ? '#f8fafc' : '#141618',
                  borderRight: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                }}
              >
                <div
                  className="file-tree-title"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: theme === 'light' ? '#64748b' : '#94a3b8',
                  }}
                >
                  <span>EXPLORER</span>
                  {currentRole !== 'VIEWER' && (
                    <button
                      onClick={() => {
                        const name = prompt('Enter new file name:');
                        const clean = name?.trim();
                        if (clean && !files.includes(clean)) {
                          const starter = getStarterCode(room.language);
                          docApiRef.current?.addFile(clean, starter);
                          setFiles([...files, clean]);
                          setActiveFile(clean);
                          setCurrentEditorCode(starter);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
                      title="New File"
                    >
                      +
                    </button>
                  )}
                </div>
                <div
                  className="tree-item"
                  onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                  style={{ color: theme === 'light' ? '#334155' : '#cbd5e1', fontWeight: 600 }}
                >
                  <ChevronDown size={14} /> src
                </div>
                {files.map((file, idx) => {
                  const isActive = activeFile === file;
                  return (
                    <div
                      key={file}
                      className={`tree-item ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveFile(file)}
                      style={{
                        cursor: 'pointer',
                        color: isActive ? '#ff5c00' : theme === 'light' ? '#1e293b' : '#cbd5e1',
                        background: isActive ? (theme === 'light' ? '#fff0e9' : 'rgba(255, 92, 0, 0.15)') : 'transparent',
                        fontWeight: isActive ? 700 : 500,
                        borderLeft: isActive ? '2px solid #ff5c00' : '2px solid transparent',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FileCode size={14} color={isActive ? '#ff5c00' : theme === 'light' ? '#64748b' : '#94a3b8'} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{file}</span>
                      {idx > 0 && currentRole !== 'VIEWER' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            docApiRef.current?.removeFile(file);
                            const remaining = files.filter((f) => f !== file);
                            setFiles(remaining);
                            if (activeFile === file && remaining.length > 0) {
                              setActiveFile(remaining[0]);
                            }
                          }}
                          title="Delete File"
                          style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.65, cursor: 'pointer', fontSize: '12px' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Editor Main with Monaco */}
            <div className="editor-main">
              <div
                className="editor-tabs"
                style={{
                  background: theme === 'light' ? '#ffffff' : '#141618',
                  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  display: 'flex',
                  overflowX: 'auto',
                }}
              >
                {files.map((file) => {
                  const isActive = file === activeFile;
                  return (
                    <span
                      key={file}
                      onClick={() => setActiveFile(file)}
                      data-active={isActive ? 'true' : 'false'}
                      style={{
                        cursor: 'pointer',
                        color: isActive ? '#ff5c00' : theme === 'light' ? '#475569' : '#94a3b8',
                        fontWeight: isActive ? 700 : 500,
                        borderBottom: isActive ? '2px solid #ff5c00' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: isActive ? (theme === 'light' ? '#f1f5f9' : 'rgba(255, 92, 0, 0.08)') : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <FileCode size={14} color={isActive ? '#ff5c00' : theme === 'light' ? '#94a3b8' : '#64748b'} /> {file}
                    </span>
                  );
                })}
              </div>

              {/* Non-blocking Language Mismatch Warning Banner */}
              {(() => {
                const mismatchInfo = checkLanguageMismatch(currentEditorCode, room.language);
                const isMismatchDismissed = dismissedMismatchKey === `${room.language}:${activeFile}`;
                if (!mismatchInfo.isMismatch || isMismatchDismissed) return null;

                return (
                  <div
                    role="status"
                    data-testid="language-mismatch-banner"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      background: theme === 'light' ? '#fff7ed' : 'rgba(249, 115, 22, 0.12)',
                      borderBottom: '1px solid ' + (theme === 'light' ? '#fed7aa' : 'rgba(249, 115, 22, 0.25)'),
                      color: theme === 'light' ? '#c2410c' : '#fb923c',
                      zIndex: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, color: '#f97316' }} />
                      <span>
                        Active file contains <strong>{getLanguageDisplay(mismatchInfo.detectedLanguage || '')}</strong> code, while the room language is set to <strong>{getLanguageDisplay(room.language)}</strong>. Existing code is preserved.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Replace editor content with starter template for ${getLanguageDisplay(room.language)}?`)) {
                            const starter = getStarterCode(room.language);
                            docApiRef.current?.setActiveFileContent?.(starter);
                            setCurrentEditorCode(starter);
                          }
                        }}
                        style={{
                          background: theme === 'light' ? '#fed7aa' : 'rgba(249, 115, 22, 0.2)',
                          border: '1px solid ' + (theme === 'light' ? '#fdba74' : 'rgba(249, 115, 22, 0.4)'),
                          color: theme === 'light' ? '#9a3412' : '#fdba74',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Use {getLanguageDisplay(room.language)} Template
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedMismatchKey(`${room.language}:${activeFile}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: 0.75,
                        }}
                        title="Dismiss warning"
                        aria-label="Dismiss language mismatch warning"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Monaco Editor Container with Yjs Collaboration */}
              <div key={activeFile} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                <RealtimeEditor
                  key={activeFile}
                  roomId={room.id}
                  language={getLanguageForFilename(activeFile) || room.language}
                  role={currentRole}
                  user={stableUser}
                  activeFile={activeFile}
                  primaryFile={files[0]}
                  workspaceFiles={files}
                  onWorkspaceFilesSync={handleWorkspaceFilesSync}
                  onLanguageUpdate={handleLanguageUpdate}
                  onDocInit={handleDocInit}
                  onEditorMount={handleEditorMount}
                  onCodeChange={handleCodeChange}
                  onSocketInit={handleSocketInit}
                  onPresenceUpdate={handlePresenceUpdate}
                  onRoleUpdate={handleRoleUpdate}
                  onCodeGetterInit={handleCodeGetterInit}
                />
              </div>

              {/* Editor Footer */}
              <div className="editor-footer">
                <span>{getLanguageDisplay(getLanguageForFilename(activeFile) || room.language)}</span>
                <span>
                  <i className="sync-dot" /> Synced
                </span>
                <span>{currentRole}</span>
              </div>
            </div>
          </div>

          {/* Docker Output Console */}
          <div style={{ flexShrink: 0, marginTop: '0' }}>
            <ExecutionConsole
              roomId={room.id}
              language={getLanguageForFilename(activeFile) || room.language}
              role={currentRole}
              codeGetter={codeGetter}
              socket={socket}
            />
          </div>
        </main>

        {/* Right Sidebar: Members / Chat / AI Assistant */}
        <aside className="room-sidebar" style={{ background: theme === 'light' ? '#ffffff' : undefined }}>
          <div className="room-sidebar-tabs" style={{ background: theme === 'light' ? '#ffffff' : undefined }}>
            <button
              className={sidebarTab === 'members' ? 'active' : ''}
              onClick={() => setSidebarTab('members')}
              style={{
                color: sidebarTab === 'members' ? '#ff5c00' : theme === 'light' ? '#334155' : '#94a3b8',
                fontWeight: sidebarTab === 'members' ? 700 : 500,
                borderBottom: sidebarTab === 'members' ? '2px solid #ff5c00' : 'none',
              }}
            >
              <Users size={15} /> Members
            </button>
            <button
              className={sidebarTab === 'chat' ? 'active' : ''}
              onClick={() => setSidebarTab('chat')}
              style={{
                color: sidebarTab === 'chat' ? '#ff5c00' : theme === 'light' ? '#334155' : '#94a3b8',
                fontWeight: sidebarTab === 'chat' ? 700 : 500,
                borderBottom: sidebarTab === 'chat' ? '2px solid #ff5c00' : 'none',
              }}
            >
              <MessageSquare size={15} /> Chat
              {unreadCount > 0 && <span className="nav-plus">{unreadCount}</span>}
            </button>
            <button
              className={sidebarTab === 'assistant' ? 'active' : ''}
              onClick={() => setSidebarTab('assistant')}
              style={{
                color: sidebarTab === 'assistant' ? '#ff5c00' : theme === 'light' ? '#334155' : '#94a3b8',
                fontWeight: sidebarTab === 'assistant' ? 700 : 500,
                borderBottom: sidebarTab === 'assistant' ? '2px solid #ff5c00' : 'none',
              }}
            >
              <Sparkles size={15} /> AI Assistant
            </button>
          </div>

          {/* Tab 1: Members View */}
          {sidebarTab === 'members' && (
            <div className="members-view" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div className="sidebar-section-title">
                IN THIS ROOM <span>{onlineCount} online</span>
              </div>

              {/* Current user */}
              <div className="member-row">
                <span className="avatar orange">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{user.name} (You)</strong>
                  <small>Editing {activeFile}</small>
                </div>
                <span className={`role ${currentRole.toLowerCase()}`}>
                  {currentRole}
                </span>
              </div>

              {/* Other members */}
              {room.members
                ?.filter((m) => m.userId !== user.id)
                .map((member) => {
                  const roleClass = (member.role || 'PARTICIPANT').toLowerCase();
                  const mName = member.user?.name || 'Collaborator';
                  const isOnline = presenceUsers.some((p) => p.userId === member.userId);
                  return (
                    <div key={member.id} className="member-row">
                      <span className="avatar purple">
                        {mName.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{mName}</strong>
                        <small>{isOnline ? 'Collaborating (Online)' : 'Offline'}</small>
                      </div>
                      <span className={`role ${roleClass}`}>
                        {member.role}
                      </span>
                      {isOwner && (
                        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                            disabled={updatingMemberId === member.userId}
                            style={{
                              fontSize: '11px',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              background: 'var(--bg-surface, rgba(255,255,255,0.05))',
                              border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                              color: 'inherit',
                            }}
                          >
                            <option value="PARTICIPANT">PARTICIPANT</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.userId, mName)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                            title="Remove Member"
                          >
                            <UserX size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Tab 2: Chat View */}
          {sidebarTab === 'chat' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <RoomChatPanel
                roomId={room.id}
                socket={socket}
                user={{ id: user.id, name: user.name }}
                isOpen={true}
                onClose={() => setSidebarTab('members')}
                onUnreadCountChange={(count: number) => setUnreadCount(count)}
                presenceUsers={presenceUsers}
              />
            </div>
          )}

          {/* Tab 3: AI Assistant View */}
          {sidebarTab === 'assistant' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <AiAssistantPanel
                roomId={room.id}
                language={getLanguageForFilename(activeFile) || room.language}
                role={currentRole}
                codeGetter={codeGetter}
                socket={socket}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Video Call Modal */}
      {isVideoModalOpen && (
        <RoomVideoPanel
          isOpen={isVideoModalOpen}
          roomId={room.id}
          user={{ id: user.id, name: user.name }}
          role={currentRole}
          socket={socket}
          onClose={() => setIsVideoModalOpen(false)}
          onCallStateChange={(active: boolean) => setIsWebRtcCallActive(active)}
        />
      )}
    </div>
  );
}
