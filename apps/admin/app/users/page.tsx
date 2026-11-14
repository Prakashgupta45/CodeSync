'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../../context/admin-auth-context';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAdminAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await adminApi.getUsers({
        page,
        limit: 15,
        search,
        role: roleFilter,
        status: statusFilter,
      });
      if (res.success && res.data) {
        setUsers(res.data.users);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (currentAdmin) {
      fetchUsers(1);
    }
  }, [currentAdmin, fetchUsers]);

  const handleStatusToggle = async (targetUser: any) => {
    const nextStatus = targetUser.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const confirmMsg =
      nextStatus === 'SUSPENDED'
        ? `Are you sure you want to suspend account access for ${targetUser.email}?`
        : `Reactivate account for ${targetUser.email}?`;

    if (!window.confirm(confirmMsg)) return;

    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.updateUserStatus(targetUser.id, nextStatus);
      setActionSuccess(`User ${targetUser.email} status updated to ${nextStatus}.`);
      fetchUsers(pagination.page);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user status');
    }
  };

  const handleRoleToggle = async (targetUser: any) => {
    const nextRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const confirmMsg =
      nextRole === 'ADMIN'
        ? `Elevate ${targetUser.email} to ADMINISTRATOR? This grants full platform control.`
        : `Demote ${targetUser.email} to regular USER?`;

    if (!window.confirm(confirmMsg)) return;

    setActionError(null);
    setActionSuccess(null);
    try {
      await adminApi.updateUserRole(targetUser.id, nextRole);
      setActionSuccess(`User ${targetUser.email} role updated to ${nextRole}.`);
      fetchUsers(pagination.page);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user role');
    }
  };

  return (
    <AdminShell title="User Management & Governance">
      <div className="space-y-6">
        {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-text-main tracking-tight">
                All Platform Users ({pagination.total})
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Manage user permissions, monitor registration activity, and control account statuses.
              </p>
            </div>
          </div>

          {/* Feedback Toasts */}
          {actionError && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="card-admin p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[260px] px-3 py-2 rounded-lg bg-bg-card border border-border-subtle focus-within:border-replit-orange">
              <Search size={14} className="text-text-muted" />
              <input
                type="text"
                placeholder="Search by name, email, or user ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-text-main outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-bg-card border border-border-subtle text-text-main text-xs outline-none"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-bg-card border border-border-subtle text-text-main text-xs outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="card-admin overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg-card text-text-muted font-mono uppercase text-[11px] border-b border-border-subtle">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Rooms</th>
                    <th className="p-3.5">Interviews</th>
                    <th className="p-3.5">Registered</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-muted">
                        <Loader2 size={18} className="animate-spin mx-auto mb-2 text-replit-orange" />
                        <span>Loading user directory...</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-muted">
                        No users match the search filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === currentAdmin?.id;
                      return (
                        <tr key={u.id} className="hover:bg-bg-card/50 transition-colors">
                          <td className="p-3.5">
                            <strong className="text-text-main block">{u.name}</strong>
                            <span className="text-text-muted text-[11px] font-mono">{u.email}</span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                  : 'bg-bg-card text-text-muted border border-border-subtle'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.status === 'SUSPENDED'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              ● {u.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-text-main">
                            {u._count?.ownedRooms ?? 0}
                          </td>
                          <td className="p-3.5 font-mono text-text-main">
                            {u._count?.ownedInterviews ?? 0}
                          </td>
                          <td className="p-3.5 text-text-muted text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Toggle Role */}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleRoleToggle(u)}
                                className="px-2.5 py-1 rounded bg-bg-card hover:bg-bg-surface border border-border-subtle text-[11px] font-semibold text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isSelf ? 'Cannot demote yourself' : 'Toggle role'}
                              >
                                {u.role === 'ADMIN' ? 'Demote' : 'Make Admin'}
                              </button>

                              {/* Toggle Suspend */}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => handleStatusToggle(u)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold border disabled:opacity-30 disabled:cursor-not-allowed ${
                                  u.status === 'SUSPENDED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                }`}
                                title={isSelf ? 'Cannot suspend yourself' : 'Toggle status'}
                              >
                                {u.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total users)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUsers(pagination.page - 1)}
                  className="p-1.5 rounded hover:bg-bg-card disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchUsers(pagination.page + 1)}
                  className="p-1.5 rounded hover:bg-bg-card disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
    </AdminShell>
  );
}
