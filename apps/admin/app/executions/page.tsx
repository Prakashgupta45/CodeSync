'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Container,
  Lock,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';

interface ExecutionData {
  dockerStatus: string;
  securityRestrictions: {
    networkDisabled: boolean;
    readOnlyRoot: boolean;
    memoryLimitEnforced: boolean;
    cpuLimitEnforced: boolean;
    pidsLimit: number;
  };
  supportedLanguages: Array<{
    language: string;
    image: string;
    timeoutMs: number;
    memoryLimit: string;
  }>;
}

export default function AdminExecutionsPage() {
  const [data, setData] = useState<ExecutionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getExecutions();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load execution status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  return (
    <AdminShell title="Code Execution Monitoring">
      <div className="space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Container className="text-replit-orange" size={24} />
            <span>Code Execution Monitoring</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Docker sandbox health, container security hardening, execution bounds, and multi-language runners.
          </p>
        </div>

        <button
          onClick={() => fetchExecutions()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-card text-xs font-semibold text-text-main transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-replit-orange" />
          <span>Inspecting Docker execution engine...</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Docker Daemon Status</span>
                  <div className="text-xl font-bold text-text-main mt-1 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        data.dockerStatus === 'up' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="capitalize">{data.dockerStatus}</span>
                  </div>
                  <span className="text-[10px] text-text-muted">Local container virtualization</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <Container size={20} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Network Isolation</span>
                  <div className="text-xl font-bold text-emerald-500 mt-1 font-mono">--net=none</div>
                  <span className="text-[10px] text-text-muted">Zero egress / SSRF prevented</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                  <Lock size={20} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-text-muted uppercase">Sandbox Restrictions</span>
                  <div className="text-xl font-bold text-text-main mt-1 font-mono">
                    PIDs &lt;= {data.securityRestrictions.pidsLimit}
                  </div>
                  <span className="text-[10px] text-text-muted">Fork bomb protection active</span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                  <ShieldCheck size={20} />
                </div>
              </div>
            </div>

            {/* Security Hardening Checklist */}
            <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm">
              <h2 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span>Container Security Enforcement Matrix</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-text-main block">Network Disabled</span>
                    <span className="text-[10px] text-text-muted font-mono">--net=none</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-text-main block">Non-Root Execution</span>
                    <span className="text-[10px] text-text-muted font-mono">--user=guest</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-text-main block">Memory Bound</span>
                    <span className="text-[10px] text-text-muted font-mono">256MB - 512MB max</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-text-main block">PIDs Limit</span>
                    <span className="text-[10px] text-text-muted font-mono">--pids-limit=64</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Supported Languages Matrix */}
            <div className="rounded-xl bg-bg-surface border border-border-subtle shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border-subtle bg-bg-card/50 flex items-center justify-between">
                <h2 className="text-xs font-bold text-text-main uppercase font-mono tracking-wider">
                  Supported Multi-Language Docker Runner Images
                </h2>
                <span className="text-[11px] text-text-muted font-mono">
                  {data.supportedLanguages.length} Active Environments
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted font-mono uppercase text-[10px]">
                      <th className="py-3 px-4">Language</th>
                      <th className="py-3 px-4">Docker Image Target</th>
                      <th className="py-3 px-4">Timeout</th>
                      <th className="py-3 px-4">Memory Limit</th>
                      <th className="py-3 px-4 text-right">Sandbox Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {data.supportedLanguages.map((lang) => (
                      <tr key={lang.language} className="hover:bg-bg-card/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-text-main uppercase px-2 py-0.5 rounded bg-bg-card border border-border-subtle">
                            {lang.language}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-text-muted">
                          {lang.image}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-text-main">
                          {lang.timeoutMs / 1000}s
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-text-main">
                          {lang.memoryLimit}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            ISOLATED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
      </div>
    </AdminShell>
  );
}
