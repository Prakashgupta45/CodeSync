'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { RoomDto, RoomPresenceUserDto } from '@codesync/shared';
import { Socket } from 'socket.io-client';
import { RoomChatPanel } from '../../../components/chat/room-chat-panel';
import { ExecutionConsole } from '../../../components/editor/execution-console';
import { AiAssistantPanel } from '../../../components/ai/ai-assistant-panel';
import {
  Code2,
  Copy,
  Check,
  LogOut,
  Trash2,
  Users,
  Terminal,
  Loader2,
  AlertCircle,
  UserX,
  ArrowLeft,
  Info,
  Clock,
  MessageSquare,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Dynamically import RealtimeEditor with SSR disabled for Monaco & Yjs DOM compatibility
const RealtimeEditor = dynamic(
  () => import('../../../components/editor/realtime-editor').then((m) => m.RealtimeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 card-replit bg-[#1e1e1e] flex items-center justify-center text-text-muted text-xs font-mono gap-2 min-h-[450px]">
        <Loader2 className="w-5 h-5 animate-spin text-replit-orange" />
        Loading Real-Time Collaborative Workspace...
      </div>
    ),
  }
);

export default function RoomWorkspacePage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;

  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [room, setRoom] = useState<RoomDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Real-Time Socket.IO, Chat, Presence & Execution State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [presenceUsers, setPresenceUsers] = useState<RoomPresenceUserDto[]>([]);
  const [codeGetter, setCodeGetter] = useState<(() => string) | undefined>(undefined);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchRoomDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Try fetching room details
      let res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      // 2. If 403 (Not a member), auto-attempt joining the room
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

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to load room details');
      }

      setRoom(result.data);
    } catch (err: any) {
      setError(err.message || 'Unable to access room');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchRoomDetails();
    }
  }, [user, isAuthLoading, router, fetchRoomDetails]);

  const handleCopyInvite = () => {
    if (typeof window !== 'undefined') {
      const inviteUrl = window.location.href;
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) return;
    if (room.ownerId === user?.id) {
      alert('Room owner cannot leave the room. Please delete the room to terminate the workspace.');
      return;
    }

    if (!confirm('Are you sure you want to leave this coding room?')) return;

    try {
      setIsLeaving(true);
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to leave room');
      }

      router.push('/rooms');
    } catch (err: any) {
      alert(err.message || 'Failed to leave room');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room) return;
    if (!confirm('CAUTION: Deleting this room will permanently remove all member access. Continue?')) {
      return;
    }

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
    } catch (err: any) {
      alert(err.message || 'Failed to delete room');
    } finally {
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
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
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
    } catch (err: any) {
      alert(err.message || 'Failed to update member role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-replit-orange">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-mono text-text-muted">Loading Room Workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !room || !user) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
        <div className="card-replit p-6 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">Room Access Error</h1>
          <p className="text-xs text-text-muted">{error || 'Room not found'}</p>
          <Link href="/rooms" className="btn-replit-primary text-xs inline-flex">
            <ArrowLeft className="w-4 h-4" />
            Back to Coding Rooms
          </Link>
        </div>
      </div>
    );
  }

  const userMember = room.members?.find((m) => m.userId === user.id);
  const isOwner = room.ownerId === user.id || room.role === 'OWNER' || userMember?.role === 'OWNER';
  const currentRole = userMember?.role || room.role || (isOwner ? 'OWNER' : 'PARTICIPANT');

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col">
      {/* Top Header Bar */}
      <header className="border-b border-border-subtle bg-bg-surface sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/rooms" className="p-1.5 rounded hover:bg-bg-secondary text-text-muted hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-replit-orange" />
              <h1 className="text-base font-bold text-white">{room.name}</h1>
              <span className="px-2 py-0.5 rounded bg-bg-secondary border border-border-subtle text-[11px] font-mono text-text-muted">
                {room.language}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                  room.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}
              >
                {room.status}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Real-Time Chat & Presence Toggle Button */}
            <button
              onClick={() => setIsChatOpen((prev) => !prev)}
              className="btn-replit-secondary text-xs relative flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-replit-orange" />
              <span>Chat & Members</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-replit-orange text-white text-[10px] font-bold font-mono">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Copy Invite Link */}
            <button
              onClick={handleCopyInvite}
              className="btn-replit-secondary text-xs relative"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Invitation Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-replit-orange" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>

            {/* Leave Room */}
            {!isOwner && (
              <button
                onClick={handleLeaveRoom}
                disabled={isLeaving}
                className="btn-replit-secondary text-xs text-red-400 border-red-500/20 hover:text-red-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                Leave Room
              </button>
            )}

            {/* Delete Room (Owner Only) */}
            {isOwner && (
              <button
                onClick={handleDeleteRoom}
                disabled={isDeleting}
                className="btn-replit-secondary text-xs text-red-400 border-red-500/30 hover:bg-red-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Room
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full overflow-y-auto">
        {/* Main Grid: Editor + Room Info Sidebar */}
        <div className="flex-1 grid md:grid-cols-3 gap-6 min-h-[500px]">
          {/* Real-Time Monaco Editor + Execution Console Container */}
          <div className="md:col-span-2 flex flex-col space-y-4 min-h-0 min-w-0">
            <RealtimeEditor
              roomId={room.id}
              language={room.language}
              role={currentRole}
              user={{ id: user.id, name: user.name }}
              onSocketInit={(s) => setSocket(s)}
              onPresenceUpdate={(users) => setPresenceUsers(users)}
              onCodeGetterInit={(getter) => setCodeGetter(() => getter)}
            />

            <ExecutionConsole
              roomId={room.id}
              language={room.language}
              role={currentRole}
              codeGetter={codeGetter}
              socket={socket}
            />

            <AiAssistantPanel
              roomId={room.id}
              language={room.language}
              role={currentRole}
              codeGetter={codeGetter}
              socket={socket}
            />
          </div>

          {/* Room Info & Member List Sidebar */}
          <div className="space-y-6">
            {/* Room Metadata Card */}
            <div className="card-replit p-5 space-y-3">
              <div className="flex items-center gap-2 text-replit-orange pb-2 border-b border-border-subtle">
                <Info className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  Room Info
                </h3>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[11px] text-text-muted block">ROOM ID</span>
                  <span className="text-white text-[11px] break-all">{room.id}</span>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">YOUR ROLE</span>
                  <span className="inline-block px-2 py-0.5 rounded bg-replit-orange/20 text-replit-orange font-semibold mt-0.5">
                    {currentRole}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">CREATED AT</span>
                  <span className="text-text-muted text-[11px] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-text-muted" />
                    {new Date(room.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Members List Card */}
            <div className="card-replit p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2 text-replit-orange">
                  <Users className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                    Members ({room.members?.length || 0})
                  </h3>
                </div>
              </div>

              <div className="space-y-2.5">
                {room.members?.map((m) => {
                  const isOnline = presenceUsers.some((p) => p.userId === m.userId);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded bg-bg-secondary/60 border border-border-subtle text-xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded bg-replit-orange/20 border border-replit-orange/30 text-replit-orange font-mono font-bold flex items-center justify-center text-xs">
                            {m.user.name.charAt(0).toUpperCase()}
                          </div>
                          {isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-bg-main" />
                          )}
                        </div>
                        <div className="truncate">
                          <span className="text-white font-medium block truncate">{m.user.name}</span>
                          <span className="text-[10px] text-text-muted font-mono block truncate">
                            {m.user.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Badge / Owner Selector */}
                        {isOwner && m.userId !== user.id ? (
                          <div className="relative">
                            <select
                              value={m.role}
                              disabled={updatingMemberId === m.userId}
                              onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                              className="px-2 py-0.5 rounded bg-bg-surface text-text-main border border-border-subtle text-[10px] font-mono font-semibold focus:outline-none focus:border-replit-orange transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <option value="PARTICIPANT">PARTICIPANT</option>
                              <option value="VIEWER">VIEWER</option>
                            </select>
                          </div>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              m.role === 'OWNER'
                                ? 'bg-replit-orange/20 text-replit-orange'
                                : 'bg-bg-surface text-text-muted border border-border-subtle'
                            }`}
                          >
                            {m.role}
                          </span>
                        )}

                        {/* Remove Member Button (Owner Only, Cannot Remove Self) */}
                        {isOwner && m.userId !== user.id && (
                          <button
                            onClick={() => handleRemoveMember(m.userId, m.user.name)}
                            className="p-1 rounded text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            title="Remove member"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Room Workspace (Chat + Online Members) Card */}
            <RoomChatPanel
              roomId={room.id}
              user={{ id: user.id, name: user.name }}
              socket={socket}
              isOpen={true}
              onClose={() => {}}
              onUnreadCountChange={(count) => setUnreadCount(count)}
              presenceUsers={presenceUsers}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
