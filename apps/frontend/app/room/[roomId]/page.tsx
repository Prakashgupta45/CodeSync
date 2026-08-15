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
import { RoomVideoPanel } from '../../../components/video/room-video-panel';
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
  Video,
  Sparkles,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Dynamic import for Monaco Editor component (CSR only)
const RealtimeEditor = dynamic(
  () => import('../../../components/editor/realtime-editor').then((m) => m.RealtimeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full bg-[#12141a] border border-border-subtle rounded-lg flex items-center justify-center text-text-muted">
        <div className="flex flex-col items-center gap-2 font-mono text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-replit-orange" />
          <span>Initializing Real-Time Monaco Editor...</span>
        </div>
      </div>
    ),
  }
);

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const unwrappedParams = use(params);
  const roomId = unwrappedParams.roomId;

  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [room, setRoom] = useState<RoomDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Real-Time Socket.IO, Chat, Presence, WebRTC, AI & Execution State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const [isWebRtcCallActive, setIsWebRtcCallActive] = useState<boolean>(false);
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
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col relative">
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

            {/* Real-Time Video Call Modal Toggle Button */}
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="btn-replit-secondary text-xs relative flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5 text-replit-orange" />
              <span>Video Call</span>
              {isWebRtcCallActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
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

            {/* AI Pair Programmer Panel (Appears BELOW Output Console when activated) */}
            {isAiPanelOpen && (
              <AiAssistantPanel
                roomId={room.id}
                language={room.language}
                role={currentRole}
                codeGetter={codeGetter}
                socket={socket}
                onClose={() => setIsAiPanelOpen(false)}
              />
            )}
          </div>

          {/* Room Info & Member List Sidebar */}
          <div className="space-y-6">
            {/* Room Metadata Card */}
            <div className="card-replit p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Info className="w-4 h-4 text-replit-orange" />
                  <span>Room Information</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-replit-orange/10 text-replit-orange border border-replit-orange/20 text-xs font-mono font-semibold uppercase">
                  {currentRole}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono text-text-muted">
                <div className="flex justify-between">
                  <span>Room ID:</span>
                  <span className="text-white font-mono">{room.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Language:</span>
                  <span className="text-white capitalize">{room.language}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="text-white flex items-center gap-1">
                    <Clock className="w-3 h-3 text-text-muted" />
                    {new Date(room.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Members:</span>
                  <span className="text-white font-bold">{room.members?.length || 1}</span>
                </div>
              </div>
            </div>

            {/* Members List & Role Management Card */}
            <div className="card-replit p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Users className="w-4 h-4 text-replit-orange" />
                  <span>Members ({room.members?.length || 0})</span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {room.members?.map((member) => {
                  const isSelf = member.userId === user.id;
                  const isMemberOwner = member.role === 'OWNER';

                  return (
                    <div
                      key={member.id}
                      className="p-2.5 rounded bg-bg-secondary border border-border-subtle flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-replit-orange/20 border border-replit-orange/30 text-replit-orange font-bold text-xs flex items-center justify-center font-mono shrink-0">
                          {member.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{member.user?.name}</span>
                            {isSelf && (
                              <span className="text-[10px] text-text-muted font-normal font-mono">(You)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-text-muted truncate font-mono">
                            {member.user?.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Selector (Owner Only) */}
                        {isOwner && !isMemberOwner && !isSelf ? (
                          <select
                            value={member.role}
                            disabled={updatingMemberId === member.userId}
                            onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                            className="bg-bg-surface border border-border-subtle rounded text-[11px] font-mono text-white px-2 py-1 focus:outline-none focus:border-replit-orange cursor-pointer"
                          >
                            <option value="PARTICIPANT">PARTICIPANT</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              isMemberOwner
                                ? 'bg-replit-orange text-white'
                                : member.role === 'VIEWER'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {member.role}
                          </span>
                        )}

                        {/* Kick Member Button (Owner Only) */}
                        {isOwner && !isMemberOwner && !isSelf && (
                          <button
                            onClick={() => handleRemoveMember(member.userId, member.user?.name || 'User')}
                            className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-bg-surface transition-colors"
                            title="Remove Member"
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

            {/* Room Workspace Card (Repositioned Chat & Online Members) */}
            <div className="card-replit p-4">
              <RoomChatPanel
                roomId={room.id}
                user={{ id: user.id, name: user.name }}
                presenceUsers={presenceUsers}
                socket={socket}
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                onUnreadCountChange={(count: number) => setUnreadCount(count)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom-Right Floating AI Pair Programmer Button */}
      <button
        onClick={() => setIsAiPanelOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 w-13 h-13 rounded-full bg-[#1c1f2b] border-2 border-replit-orange text-replit-orange hover:bg-replit-orange hover:text-white shadow-2xl transition-all duration-200 flex items-center justify-center group active:scale-95"
        title="AI Pair Programmer"
        aria-label="Toggle AI Pair Programmer Panel"
      >
        <Sparkles className="w-6 h-6 animate-pulse group-hover:animate-none" />
      </button>

      {/* WebRTC Video Call Floating Modal */}
      <RoomVideoPanel
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        roomId={room.id}
        user={{ id: user.id, name: user.name }}
        role={currentRole}
        socket={socket}
        onCallStateChange={(active) => setIsWebRtcCallActive(active)}
      />
    </div>
  );
}
