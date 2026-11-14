'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  Activity,
  RefreshCw,
  Database,
  Container,
  Cpu,
  HardDrive,
  Clock,
  Server,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface SystemHealthData {
  status: string;
  timestamp: string;
  database: {
    status: string;
    latencyMs: number;
  };
  docker: {
    status: string;
  };
  system: {
    platform: string;
    arch: string;
    uptimeSeconds: number;
    memory: {
      totalMb: number;
      usedMb: number;
      freeMb: number;
      usagePercentage: number;
    };
    cpus: number;
  };
}

export default function AdminSystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getSystemHealth();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load system health diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  return (
    <AdminShell title="System Health & Diagnostics">
      <div className="space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Activity className="text-replit-orange" size={24} />
            <span>System Health & Diagnostics</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Real-time infrastructure probes, PostgreSQL latency, container health, and memory telemetry.
          </p>
        </div>

        <button
          onClick={() => fetchHealth()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-card text-xs font-semibold text-text-main transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
          <RefreshCw size={24} className="animate-spin text-replit-orange" />
          <span>Probing system services...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-xs text-red-500 flex flex-col items-center gap-2">
          <AlertTriangle size={24} />
          <span>{error}</span>
        </div>
      ) : (
        data && (
          <>
            {/* Health Status Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                data.status === 'healthy'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={22} />
                <div>
                  <h2 className="font-bold text-sm text-text-main capitalize">System Status: {data.status}</h2>
                  <span className="text-[11px] text-text-muted">
                    Last probe: {new Date(data.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-bg-surface border border-border-subtle text-text-main">
                Auto-refresh: 15s
              </span>
            </div>

            {/* Core Infrastructure Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Database */}
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted uppercase">PostgreSQL</span>
                  <Database
                    size={18}
                    className={data.database.status === 'ok' ? 'text-emerald-500' : 'text-red-500'}
                  />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-main capitalize flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        data.database.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <span>{data.database.status === 'ok' ? 'Connected' : 'Unavailable'}</span>
                  </div>
                  <div className="text-[11px] font-mono text-text-muted mt-1">
                    Latency: <span className="font-bold text-text-main">{data.database.latencyMs}ms</span>
                  </div>
                </div>
              </div>

              {/* Docker */}
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted uppercase">Docker Engine</span>
                  <Container
                    size={18}
                    className={data.docker.status === 'up' ? 'text-emerald-500' : 'text-amber-500'}
                  />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-main capitalize flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        data.docker.status === 'up' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span>{data.docker.status}</span>
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">Execution sandbox daemon</div>
                </div>
              </div>

              {/* Memory */}
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted uppercase">RAM Utilization</span>
                  <HardDrive size={18} className="text-purple-500" />
                </div>
                <div>
                  <div className="text-xl font-bold text-text-main font-mono">
                    {data.system.memory.usagePercentage}%
                  </div>
                  <div className="text-[11px] text-text-muted font-mono mt-1">
                    {data.system.memory.usedMb}MB / {data.system.memory.totalMb}MB
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-bg-card rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${data.system.memory.usagePercentage}%` }}
                  />
                </div>
              </div>

              {/* Uptime */}
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-text-muted uppercase">Host Uptime</span>
                  <Clock size={18} className="text-blue-500" />
                </div>
                <div>
                  <div className="text-base font-bold text-text-main font-mono">
                    {formatUptime(data.system.uptimeSeconds)}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">Continuous daemon service</div>
                </div>
              </div>
            </div>

            {/* Host Details Grid */}
            <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <Server size={16} className="text-replit-orange" />
                <span>Host Environment Specifications</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-[10px] text-text-muted font-mono uppercase block">Operating System</span>
                  <span className="font-semibold text-text-main mt-0.5 capitalize">{data.system.platform}</span>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-[10px] text-text-muted font-mono uppercase block">Architecture</span>
                  <span className="font-mono font-semibold text-text-main mt-0.5">{data.system.arch}</span>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-[10px] text-text-muted font-mono uppercase block">Logical CPU Cores</span>
                  <span className="font-mono font-semibold text-text-main mt-0.5">{data.system.cpus} Cores</span>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-[10px] text-text-muted font-mono uppercase block">Free Memory</span>
                  <span className="font-mono font-semibold text-text-main mt-0.5">
                    {data.system.memory.freeMb} MB
                  </span>
                </div>
              </div>
            </div>
          </>
        )
      )}
      </div>
    </AdminShell>
  );
}
