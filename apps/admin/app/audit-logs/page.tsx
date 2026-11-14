'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  AlertTriangle,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  FileCode,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details?: any;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');

  // Inspection Modal
  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAuditLogs({
        page: pagination.page,
        limit: pagination.limit,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        targetType: targetTypeFilter !== 'ALL' ? targetTypeFilter : undefined,
      });
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, actionFilter, targetTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    let color = 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
    if (action.includes('DELETED') || action.includes('TERMINATED') || action.includes('SUSPENDED')) {
      color = 'bg-red-500/10 text-red-500 border-red-500/20';
    } else if (action.includes('RECOVERED') || action.includes('REACTIVATED')) {
      color = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    } else if (action.includes('ROLE')) {
      color = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    } else if (action.includes('CANCELLED')) {
      color = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${color}`}>
        {action}
      </span>
    );
  };

  return (
    <AdminShell title="Platform Audit Logs">
      <div className="space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="text-replit-orange" size={24} />
            <span>Platform Audit Logs</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Immutable, tamper-evident audit trail of all sensitive administrator operations and security events.
          </p>
        </div>

        <button
          onClick={() => fetchLogs()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-card text-xs font-semibold text-text-main transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Filter size={13} />
            <span>Action:</span>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-2.5 py-1.5 bg-bg-main border border-border-subtle rounded-lg text-xs text-text-main focus:outline-none focus:border-replit-orange font-mono"
          >
            <option value="ALL">All Actions</option>
            <option value="INTERVIEW_DELETED">INTERVIEW_DELETED</option>
            <option value="INTERVIEW_RECOVERED">INTERVIEW_RECOVERED</option>
            <option value="INTERVIEW_CANCELLED">INTERVIEW_CANCELLED</option>
            <option value="USER_SUSPENDED">USER_SUSPENDED</option>
            <option value="USER_REACTIVATED">USER_REACTIVATED</option>
            <option value="USER_ROLE_UPDATED">USER_ROLE_UPDATED</option>
            <option value="ROOM_TERMINATED">ROOM_TERMINATED</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-text-muted ml-2">
            <span>Target:</span>
          </div>
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-2.5 py-1.5 bg-bg-main border border-border-subtle rounded-lg text-xs text-text-main focus:outline-none focus:border-replit-orange font-mono"
          >
            <option value="ALL">All Targets</option>
            <option value="INTERVIEW">INTERVIEW</option>
            <option value="USER">USER</option>
            <option value="ROOM">ROOM</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
            <RefreshCw size={24} className="animate-spin text-replit-orange" />
            <span>Loading audit log records...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-500 flex flex-col items-center gap-2">
            <AlertTriangle size={24} />
            <span>{error}</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No audit log entries found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-card/50 text-text-muted font-mono uppercase text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Target ID</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {logs.map((item) => (
                  <tr key={item.id} className="hover:bg-bg-card/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-text-muted whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">{getActionBadge(item.action)}</td>
                    <td className="py-3 px-4 font-medium text-text-main">
                      {item.actorEmail || 'System'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-bg-card border border-border-subtle text-text-muted">
                        {item.targetType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-text-muted max-w-xs truncate">
                      {item.targetId}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setInspectLog(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-bg-card hover:bg-neutral-800 text-[11px] font-semibold text-text-main border border-border-subtle transition-colors"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
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
            Showing {logs.length} of {pagination.total} audit records
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

      {/* Inspect Log Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                <ShieldCheck size={16} className="text-replit-orange" />
                <span>Audit Log Entry Details</span>
              </h3>
              <button
                onClick={() => setInspectLog(null)}
                className="text-text-muted hover:text-text-main text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-bg-card">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Action</span>
                  {getActionBadge(inspectLog.action)}
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Actor</span>
                  <span className="font-semibold text-text-main">{inspectLog.actorEmail}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Target Type</span>
                  <span className="font-mono text-text-main">{inspectLog.targetType}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Timestamp</span>
                  <span className="font-mono text-text-main">
                    {new Date(inspectLog.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Target ID</span>
                  <span className="font-mono text-[11px] text-text-main break-all">{inspectLog.targetId}</span>
                </div>
              </div>

              <div>
                <span className="text-text-muted block text-[10px] uppercase font-mono mb-1.5">
                  Payload Metadata (JSON)
                </span>
                <pre className="p-3 rounded-lg bg-bg-main border border-border-subtle text-[11px] font-mono text-text-main overflow-x-auto">
                  {JSON.stringify(inspectLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border-subtle">
              <button
                onClick={() => setInspectLog(null)}
                className="px-4 py-2 rounded-lg bg-bg-card hover:bg-neutral-800 text-text-main text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminShell>
  );
}
