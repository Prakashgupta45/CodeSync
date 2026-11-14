'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  CalendarCheck,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Eye,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  User,
  Clock,
  Code2,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldAlert,
} from 'lucide-react';

interface InterviewItem {
  id: string;
  title: string;
  candidateName?: string;
  candidateEmail?: string;
  jobRole?: string;
  status: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  candidate?: {
    id: string;
    name: string;
    email: string;
  };
  problem?: {
    id: string;
    title: string;
    difficulty: string;
  };
  report?: {
    overallScore?: number;
    verdict?: string;
    feedbackSummary?: string;
  };
  _count?: {
    messages: number;
    events: number;
  };
}

export default function AdminInterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [includeDeleted, setIncludeDeleted] = useState<boolean>(true);

  // Modals
  const [inspectItem, setInspectItem] = useState<InterviewItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InterviewItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getInterviews({
        page: pagination.page,
        limit: pagination.limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        jobRole: roleFilter !== 'ALL' ? roleFilter : undefined,
        includeDeleted,
      });
      if (res.success && res.data) {
        setInterviews(res.data.interviews);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, roleFilter, includeDeleted]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminApi.deleteInterview(deleteTarget.id);
      setActionSuccess(`Interview "${deleteTarget.title}" safely deleted.`);
      setDeleteTarget(null);
      await fetchInterviews();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete interview');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecover = async (interview: InterviewItem) => {
    try {
      await adminApi.recoverInterview(interview.id);
      setActionSuccess(`Interview "${interview.title}" restored.`);
      await fetchInterviews();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to recover interview');
    }
  };

  const handleCancel = async (interview: InterviewItem) => {
    if (!confirm(`Cancel interview "${interview.title}"?`)) return;
    try {
      await adminApi.cancelInterview(interview.id);
      setActionSuccess(`Interview "${interview.title}" cancelled.`);
      await fetchInterviews();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel interview');
    }
  };

  const getStatusBadge = (status: string, isDeleted: boolean) => {
    if (isDeleted) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-red-500/10 text-red-500 border border-red-500/20">
          DELETED
        </span>
      );
    }
    switch (status) {
      case 'IN_PROGRESS':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 w-max">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> LIVE
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            COMPLETED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
            CANCELLED
          </span>
        );
      case 'READY':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            READY
          </span>
        );
    }
  };

  return (
    <AdminShell title="Interview Management">
      <div className="space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarCheck className="text-replit-orange" size={24} />
            <span>Interview Management</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Central oversight of all AI interviews, candidate evaluations, reports, and safe deletion.
          </p>
        </div>

        <button
          onClick={() => fetchInterviews()}
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
            placeholder="Search by title, ID, candidate, owner..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full pl-9 pr-3 py-2 bg-bg-main border border-border-subtle rounded-lg text-xs text-text-main focus:outline-none focus:border-replit-orange"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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
            <option value="READY">Ready</option>
            <option value="IN_PROGRESS">Live In-Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded border-border-subtle accent-replit-orange"
            />
            <span>Show Deleted</span>
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
            <RefreshCw size={24} className="animate-spin text-replit-orange" />
            <span>Loading interviews platform-wide...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-500 flex flex-col items-center gap-2">
            <AlertTriangle size={24} />
            <span>{error}</span>
          </div>
        ) : interviews.length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No interviews found matching the query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-card/50 text-text-muted font-mono uppercase text-[10px]">
                  <th className="py-3 px-4">Interview / ID</th>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Owner (HR)</th>
                  <th className="py-3 px-4">Role / Problem</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verdict / Score</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {interviews.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-bg-card/40 transition-colors ${
                      item.isDeleted ? 'opacity-60 bg-red-500/[0.02]' : ''
                    }`}
                  >
                    {/* Title & ID */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-main flex items-center gap-1.5">
                        <span>{item.title}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">{item.id.slice(0, 12)}...</span>
                    </td>

                    {/* Candidate */}
                    <td className="py-3 px-4">
                      <div className="text-text-main font-medium">
                        {item.candidateName || item.candidate?.name || 'Unassigned'}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {item.candidateEmail || item.candidate?.email || '—'}
                      </div>
                    </td>

                    {/* Owner HR */}
                    <td className="py-3 px-4">
                      <div className="text-text-main">{item.owner?.name}</div>
                      <div className="text-[11px] text-text-muted">{item.owner?.email}</div>
                    </td>

                    {/* Role / Problem */}
                    <td className="py-3 px-4">
                      <div className="text-text-main font-mono text-[11px]">
                        {item.jobRole || 'Software Engineer'}
                      </div>
                      <div className="text-[11px] text-text-muted flex items-center gap-1">
                        <Code2 size={11} />
                        <span>{item.problem?.title || 'General Coding'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">{getStatusBadge(item.status, item.isDeleted)}</td>

                    {/* Verdict / Score */}
                    <td className="py-3 px-4">
                      {item.report?.verdict ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.report.verdict === 'STRONG_HIRE' || item.report.verdict === 'HIRE'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {item.report.verdict}
                          </span>
                          <span className="font-mono text-text-muted text-[11px]">
                            {item.report.overallScore ?? '—'}/100
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px] italic">Pending</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setInspectItem(item)}
                          title="Inspect Details"
                          className="p-1.5 rounded hover:bg-bg-card text-text-muted hover:text-text-main transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        {item.isDeleted ? (
                          <button
                            onClick={() => handleRecover(item)}
                            title="Recover Interview"
                            className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-500 transition-colors"
                          >
                            <RotateCcw size={15} />
                          </button>
                        ) : (
                          <>
                            {item.status === 'READY' && (
                              <button
                                onClick={() => handleCancel(item)}
                                title="Cancel Interview"
                                className="p-1.5 rounded hover:bg-neutral-500/10 text-neutral-400 hover:text-text-main transition-colors"
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(item)}
                              title="Delete Interview (Admin Exclusive)"
                              className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
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
            Showing {interviews.length} of {pagination.total} interviews
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

      {/* Inspect Details Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                <FileText size={16} className="text-replit-orange" />
                <span>Interview Inspection</span>
              </h3>
              <button
                onClick={() => setInspectItem(null)}
                className="text-text-muted hover:text-text-main text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-bg-card">
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Title</span>
                  <span className="font-semibold text-text-main">{inspectItem.title}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Status</span>
                  {getStatusBadge(inspectItem.status, inspectItem.isDeleted)}
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Candidate</span>
                  <span className="font-semibold text-text-main">
                    {inspectItem.candidateName || inspectItem.candidate?.name || 'Unassigned'}
                  </span>
                  <span className="text-text-muted block text-[11px]">
                    {inspectItem.candidateEmail || inspectItem.candidate?.email || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Owner (HR)</span>
                  <span className="font-semibold text-text-main">{inspectItem.owner?.name}</span>
                  <span className="text-text-muted block text-[11px]">{inspectItem.owner?.email}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Job Role</span>
                  <span className="font-mono text-text-main">{inspectItem.jobRole || 'Software Engineer'}</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-mono">Problem</span>
                  <span className="text-text-main">{inspectItem.problem?.title || 'General Coding'}</span>
                </div>
              </div>

              {inspectItem.report && (
                <div className="p-3 rounded-lg bg-bg-card space-y-1.5 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-text-muted uppercase">Verdict & Score</span>
                    <span className="font-bold text-replit-orange font-mono">
                      Score: {inspectItem.report.overallScore ?? 'N/A'}/100
                    </span>
                  </div>
                  <div className="font-semibold text-text-main">{inspectItem.report.verdict}</div>
                  {inspectItem.report.feedbackSummary && (
                    <p className="text-text-muted text-[11px] italic mt-1 leading-relaxed">
                      &ldquo;{inspectItem.report.feedbackSummary}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {inspectItem.isDeleted && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Soft-Deleted By Administrator</span>
                    <span className="text-[11px] text-text-muted">
                      Deleted at: {new Date(inspectItem.deletedAt!).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border-subtle">
              <button
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 rounded-lg bg-bg-card hover:bg-neutral-800 text-text-main text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Permanent Deletion Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-red-500/30 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-main">Confirm Administrative Deletion</h3>
                <span className="text-[11px] text-red-400">Strict safety protocol enforced</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-text-muted leading-relaxed">
              <p>
                Are you sure you want to delete the interview{' '}
                <strong className="text-text-main font-semibold">&ldquo;{deleteTarget.title}&rdquo;</strong>?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-text-muted">
                <li>Active socket connections and live interview sessions will be terminated immediately.</li>
                <li>Normal HR users will immediately lose access to this interview and reports.</li>
                <li>The action will be recorded permanently in the platform <strong className="text-text-main">Audit Logs</strong> with your administrator credentials.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-lg bg-bg-card hover:bg-neutral-800 text-xs font-semibold text-text-main"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Confirm Delete</span>
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
