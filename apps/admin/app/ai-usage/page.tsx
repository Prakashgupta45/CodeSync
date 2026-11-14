'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  Bot,
  RefreshCw,
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Activity,
  Code2,
} from 'lucide-react';

interface AiUsageData {
  totalRequests: number;
  recentRequests: Array<{
    id: string;
    action: string;
    prompt: string;
    createdAt: string;
    user: { id: string; name: string; email: string };
    room: { id: string; name: string; language: string };
  }>;
  actionBreakdown: Array<{ action: string; count: number }>;
  geminiModel: string;
  geminiStatus: string;
  llmTimeoutMs: number;
}

export default function AdminAiUsagePage() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAiUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAiUsage();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load AI usage statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiUsage();
  }, [fetchAiUsage]);

  return (
    <AdminShell title="AI Usage Monitoring">
      <div className="space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Bot className="text-replit-orange" size={24} />
            <span>AI Usage Monitoring</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real-time telemetry, provider configuration, token trends, and prompt audit trails.
          </p>
        </div>

        <button
          onClick={() => fetchAiUsage()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-card text-xs font-semibold text-text-main transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-replit-orange" />
          <span>Fetching AI telemetry...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-xs text-red-500 flex flex-col items-center gap-2">
          <AlertCircle size={24} />
          <span>{error}</span>
        </div>
      ) : (
        data && (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Total AI Requests</span>
                  <div className="text-2xl font-black text-text-main mt-1">{data.totalRequests}</div>
                  <span className="text-[10px] text-text-muted">Lifetime platform prompts</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-replit-orange/10 border border-replit-orange/20 flex items-center justify-center text-replit-orange">
                  <Sparkles size={20} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Active Model</span>
                  <div className="text-base font-bold text-text-main mt-1 font-mono">{data.geminiModel}</div>
                  <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={11} /> Provider Active
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                  <Cpu size={20} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Effective LLM Timeout</span>
                  <div className="text-2xl font-black text-text-main mt-1 font-mono">
                    {Math.round(data.llmTimeoutMs / 1000)}s
                  </div>
                  <span className="text-[10px] text-text-muted">Hard execution boundary</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                  <Clock size={20} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Provider Engine</span>
                  <div className="text-base font-bold text-text-main mt-1">Google Gemini API</div>
                  <span className="text-[10px] text-text-muted">Gemini 2.5 Flash / Flash-Lite</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Zap size={20} />
                </div>
              </div>
            </div>

            {/* Action Breakdown */}
            <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm">
              <h2 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
                <Activity size={16} className="text-replit-orange" />
                <span>AI Action Category Breakdown</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {data.actionBreakdown.length > 0 ? (
                  data.actionBreakdown.map((item) => (
                    <div
                      key={item.action}
                      className="p-3 rounded-lg bg-bg-card border border-border-subtle flex flex-col justify-between"
                    >
                      <span className="text-[10px] font-mono text-text-muted uppercase">{item.action}</span>
                      <span className="text-xl font-bold text-text-main mt-1 font-mono">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-xs text-text-muted text-center py-4">
                    No categorical AI request data recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Recent AI Requests Table */}
            <div className="rounded-xl bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border-subtle bg-bg-card/50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-text-main uppercase font-mono tracking-wider">
                  Recent AI Requests Audit Trail
                </h2>
                <span className="text-[11px] text-text-muted font-mono">Last 20 events</span>
              </div>

              {data.recentRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">No recent AI requests found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle text-text-muted font-mono uppercase text-[10px]">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Room / Lang</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Prompt Preview</th>
                        <th className="py-3 px-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.recentRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-bg-card/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-text-main">{req.user?.name}</div>
                            <div className="text-[11px] text-text-muted">{req.user?.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-text-main">{req.room?.name}</div>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border-subtle text-text-muted uppercase">
                              {req.room?.language}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-replit-orange/10 text-replit-orange font-bold border border-replit-orange/20 uppercase">
                              {req.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-text-muted font-mono text-[11px]">
                            {req.prompt}
                          </td>
                          <td className="py-3 px-4 text-right text-text-muted font-mono text-[11px]">
                            {new Date(req.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}
      </div>
    </AdminShell>
  );
}
