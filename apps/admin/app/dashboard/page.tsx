'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../context/admin-auth-context';
import { AdminShell } from '../../components/layout/admin-shell';
import { adminApi } from '../../lib/api';
import {
  Users,
  Code2,
  CalendarCheck,
  Activity,
  Bot,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Server,
  Database,
  CheckCircle2,
  Clock,
  Trash2,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAdminAuth();
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    Promise.all([
      adminApi.getStats().catch(() => null),
      adminApi.getSystemHealth().catch(() => null),
    ])
      .then(([statsRes, healthRes]) => {
        if (statsRes?.success) setStats(statsRes.data);
        if (healthRes?.success) setHealth(healthRes.data);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <AdminShell title="Platform Overview & Metrics">
      <div className="space-y-6">
        {/* Welcome Banner */}
      <div className="card-admin p-6 bg-gradient-to-r from-bg-surface via-bg-card to-bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold text-replit-orange uppercase tracking-wider">
            Enterprise Control Hub
          </span>
          <h2 className="text-xl font-extrabold text-text-main tracking-tight mt-1">
            Welcome back, {user?.name || 'Administrator'}
          </h2>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            Real-time observability and governance for users, live collaboration coding rooms, proctored AI technical interviews, and system resources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Systems Operational
          </span>
        </div>
      </div>

          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Users Metric */}
            <div className="card-admin p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-muted uppercase">Platform Users</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Users size={16} />
                </div>
              </div>
              <div>
                <strong className="text-2xl font-black text-text-main">
                  {stats?.users?.total ?? 0}
                </strong>
                <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                  <span>{stats?.users?.hrUsers ?? 0} HR Developers</span>
                  <span>•</span>
                  <span>{stats?.users?.admins ?? 0} Admins</span>
                </div>
              </div>
            </div>

            {/* Coding Rooms Metric */}
            <div className="card-admin p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-muted uppercase">Coding Rooms</span>
                <div className="p-2 rounded-lg bg-orange-500/10 text-replit-orange">
                  <Code2 size={16} />
                </div>
              </div>
              <div>
                <strong className="text-2xl font-black text-text-main">
                  {stats?.rooms?.total ?? 0}
                </strong>
                <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    ● {stats?.rooms?.active ?? 0} Active Live
                  </span>
                </div>
              </div>
            </div>

            {/* AI Interviews Metric */}
            <div className="card-admin p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-muted uppercase">AI Interviews</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <CalendarCheck size={16} />
                </div>
              </div>
              <div>
                <strong className="text-2xl font-black text-text-main">
                  {stats?.interviews?.total ?? 0}
                </strong>
                <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                  <span>{stats?.interviews?.scheduled ?? 0} Sched</span>
                  <span>•</span>
                  <span>{stats?.interviews?.completed ?? 0} Done</span>
                </div>
              </div>
            </div>

            {/* AI Interactions Metric */}
            <div className="card-admin p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-text-muted uppercase">AI Requests</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Bot size={16} />
                </div>
              </div>
              <div>
                <strong className="text-2xl font-black text-text-main">
                  {stats?.ai?.totalRequests ?? 0}
                </strong>
                <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                  <span>Assistant &amp; Evaluator prompts</span>
                </div>
              </div>
            </div>
          </div>

          {/* TWO COLUMN DETAIL SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interview Status Breakdown */}
            <div className="card-admin p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-main flex items-center justify-between">
                <span>Technical Interview Pipeline</span>
                <button
                  type="button"
                  onClick={() => router.push('/interviews')}
                  className="text-xs text-replit-orange hover:underline font-semibold flex items-center gap-1"
                >
                  Manage Interviews <ArrowUpRight size={13} />
                </button>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-text-muted block text-[11px]">Scheduled</span>
                  <strong className="text-lg font-bold text-amber-400 mt-1 block">
                    {stats?.interviews?.scheduled ?? 0}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-text-muted block text-[11px]">In Progress</span>
                  <strong className="text-lg font-bold text-emerald-400 mt-1 block">
                    {stats?.interviews?.active ?? 0}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-text-muted block text-[11px]">Completed</span>
                  <strong className="text-lg font-bold text-blue-400 mt-1 block">
                    {stats?.interviews?.completed ?? 0}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-text-muted block text-[11px]">Cancelled</span>
                  <strong className="text-lg font-bold text-zinc-400 mt-1 block">
                    {stats?.interviews?.cancelled ?? 0}
                  </strong>
                </div>

                <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <span className="text-text-muted block text-[11px]">Admin Deleted</span>
                  <strong className="text-lg font-bold text-red-400 mt-1 block">
                    {stats?.interviews?.deleted ?? 0}
                  </strong>
                </div>
              </div>
            </div>

            {/* System Health Snapshot */}
            <div className="card-admin p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-main flex items-center justify-between">
                <span>Infrastructure Snapshot</span>
                <button
                  type="button"
                  onClick={() => router.push('/system-health')}
                  className="text-xs text-replit-orange hover:underline font-semibold flex items-center gap-1"
                >
                  Deep Health Diagnostics <ArrowUpRight size={13} />
                </button>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Database size={15} className="text-blue-400" />
                    <div>
                      <span className="font-semibold block text-text-main">PostgreSQL Database</span>
                      <span className="text-[11px] text-text-muted">
                        Latency: {health?.database?.latencyMs ?? 0}ms
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[11px]">
                    {health?.database?.status === 'ok' ? 'UP / READY' : 'DEGRADED'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Server size={15} className="text-orange-400" />
                    <div>
                      <span className="font-semibold block text-text-main">Docker Sandbox Runner</span>
                      <span className="text-[11px] text-text-muted">9 Language Runtimes Provisioned</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[11px]">
                    {health?.docker?.status === 'up' ? 'UP / ACTIVE' : 'UNAVAILABLE'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-card border border-border-subtle">
                  <div className="flex items-center gap-2.5">
                    <Activity size={15} className="text-purple-400" />
                    <div>
                      <span className="font-semibold block text-text-main">System Memory</span>
                      <span className="text-[11px] text-text-muted">
                        {health?.system?.memory?.usedMb}MB / {health?.system?.memory?.totalMb}MB ({health?.system?.memory?.usagePercentage}%)
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold font-mono text-[11px]">
                    {health?.system?.cpus ?? 1} CPU Cores
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
    </AdminShell>
  );
}
