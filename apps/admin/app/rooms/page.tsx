'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  Code2,
  Search,
  Filter,
  RefreshCw,
  PowerOff,
  Eye,
  AlertTriangle,
  Users,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lock,
  Globe,
} from 'lucide-react';

interface RoomItem {
  id: string;
  name: string;
  language: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  _count?: {
    chatMessages: number;
    aiMessages: number;
  };
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [inspectRoom, setInspectRoom] = useState<RoomItem | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<RoomItem | null>(null);
  const [isTerminating, setIsTerminating] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getRooms({
        page: pagination.page,
        limit: pagination.limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setRooms(res.data.rooms);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleTerminateConfirm = async () => {
    if (!terminateTarget) return;
    setIsTerminating(true);
    try {
      await adminApi.terminateRoom(terminateTarget.id);
      setActionSuccess(`Room "${terminateTarget.name}" administratively terminated.`);
      setTerminateTarget(null);
      await fetchRooms();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to terminate room');
    } finally {
      setIsTerminating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1 w-max">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ACTIVE
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
        CLOSED
      </span>
    );
  };

  return (
    <AdminShell title="Coding Room Management">
      <div className="space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Code2 className="text-replit-orange" size={24} />
            <span>Coding Room Management</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real-time oversight of collaborative coding rooms, active participants, and administrative shutdown.
          </p>
        </div>

        <button
          onClick={() => fetchRooms()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-card text-xs font-semibold text-text-main transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by room name, ID, owner email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full pl-9 pr-3 py-2 bg-bg-main border border-border-subtle rounded-lg text-xs text-text-main focus:outline-none focus:border-replit-orange"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Filter size={13} />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-2.5 py-1.5 bg-bg-main border border-border-subtle rounded-lg text-xs text-text-main focus:outline-none focus:border-replit-orange"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Rooms</option>
            <option value="CLOSED">Closed Rooms</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
            <RefreshCw size={24} className="animate-spin text-replit-orange" />
            <span>Loading coding rooms...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-500 flex flex-col items-center gap-2">
            <AlertTriangle size={24} />
            <span>{error}</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No rooms found matching the query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-card/50 text-text-muted font-mono uppercase text-[10px]">
                  <th className="py-3 px-4">Room Name / ID</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Participants</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-bg-card/40 transition-colors">
                    {/* Name & ID */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-main">{room.name}</div>
                      <span className="font-mono text-[10px] text-text-muted">{room.id}</span>
                    </td>

                    {/* Owner */}
                    <td className="py-3 px-4">
                      <div className="text-text-main font-medium">{room.owner?.name}</div>
                      <div className="text-[11px] text-text-muted">{room.owner?.email}</div>
                    </td>

                    {/* Language */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg-card border border-border-subtle text-text-main uppercase font-bold">
                        {room.language}
                      </span>
                    </td>

                    {/* Participants */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-text-main font-medium">
                        <Users size={14} className="text-text-muted" />
                        <span>{room.members?.length || 0} connected</span>
                      </div>
                    </td>

                    {/* Activity */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          <span>{room._count?.chatMessages || 0}</span>
                        </span>
                        <span className="flex items-center gap-1 text-replit-orange">
                          <Sparkles size={12} />
                          <span>{room._count?.aiMessages || 0}</span>
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">{getStatusBadge(room.status)}</td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setInspectRoom(room)}
                          title="Inspect Room & Participants"
                          className="p-1.5 rounded hover:bg-bg-card text-text-muted hover:text-text-main transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        {room.status === 'ACTIVE' && (
                          <button
                            onClick={() => setTerminateTarget(room)}
                            title="Administratively Terminate Room"
                            className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                          >
                            <PowerOff size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border-subtle bg-bg-card/20 flex items-center justify-between text-xs text-text-muted">
          <div>
            Showing {rooms.length} of {pagination.total} rooms
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="p-1.5 rounded border border-border-subtle disabled:opacity-40 hover:bg-bg-card"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-[11px]">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="p-1.5 rounded border border-border-subtle disabled:opacity-40 hover:bg-bg-card"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Room Modal */}
      {inspectRoom && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                <Code2 size={16} className="text-replit-orange" />
                <span>Room Inspection: {inspectRoom.name}</span>
              </h3>
              <button
                onClick={() => setInspectRoom(null)}
                className="text-text-muted hover:text-text-main text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-bg-card">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Room ID</span>
                  <span className="font-mono text-[11px] text-text-main break-all">{inspectRoom.id}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Status</span>
                  {getStatusBadge(inspectRoom.status)}
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Language</span>
                  <span className="font-mono font-bold text-text-main uppercase">{inspectRoom.language}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Owner</span>
                  <span className="font-semibold text-text-main">{inspectRoom.owner?.name}</span>
                  <span className="text-text-muted block text-[11px]">{inspectRoom.owner?.email}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-text-main mb-2 flex items-center gap-1.5">
                  <Users size={14} />
                  <span>Room Members ({inspectRoom.members?.length || 0})</span>
                </h4>
                <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle overflow-hidden">
                  {inspectRoom.members?.map((m) => (
                    <div key={m.id} className="p-2.5 flex items-center justify-between bg-bg-card/30">
                      <div>
                        <div className="font-medium text-text-main">{m.user?.name}</div>
                        <div className="text-[11px] text-text-muted">{m.user?.email}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-text-muted border border-border-subtle">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border-subtle">
              <button
                onClick={() => setInspectRoom(null)}
                className="px-4 py-2 rounded-lg bg-bg-card hover:bg-neutral-800 text-text-main text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Room Confirmation Modal */}
      {terminateTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-red-500/30 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-main">Terminate Coding Room</h3>
                <span className="text-[11px] text-red-400">Administrative shutdown</span>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to terminate room{' '}
              <strong className="text-text-main font-semibold">&ldquo;{terminateTarget.name}&rdquo;</strong>? All active socket
              sessions will be disconnected immediately and the room marked CLOSED.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
              <button
                disabled={isTerminating}
                onClick={() => setTerminateTarget(null)}
                className="px-3.5 py-2 rounded-lg bg-bg-card hover:bg-neutral-800 text-xs font-semibold text-text-main"
              >
                Cancel
              </button>
              <button
                disabled={isTerminating}
                onClick={handleTerminateConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                {isTerminating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Terminating...</span>
                  </>
                ) : (
                  <>
                    <PowerOff size={13} />
                    <span>Terminate Room</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminShell>
  );
}
