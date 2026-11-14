'use client';

import React from 'react';
import { useAdminAuth } from '../../context/admin-auth-context';
import { AdminShell } from '../../components/layout/admin-shell';
import {
  Settings,
  Shield,
  User,
  Key,
  Database,
  Server,
  Lock,
  ExternalLink,
  LogOut,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { user, logout } = useAdminAuth();

  return (
    <AdminShell title="Platform Settings">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <Settings className="text-replit-orange" size={24} />
          <span>Platform Settings & Administration</span>
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Administrator profile, platform configuration, authentication policies, and security guardrails.
        </p>
      </div>

      {/* Admin Profile Card */}
      <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-replit-orange/20 border border-replit-orange/30 flex items-center justify-center text-replit-orange font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <h2 className="font-bold text-sm text-text-main flex items-center gap-2">
                <span>{user?.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-replit-orange/20 text-replit-orange border border-replit-orange/30">
                  {user?.role}
                </span>
              </h2>
              <span className="text-xs text-text-muted">{user?.email}</span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-semibold transition-colors"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
            <span className="text-text-muted block text-[10px] uppercase font-mono">User ID</span>
            <span className="font-mono text-[11px] text-text-main">{user?.id}</span>
          </div>

          <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
            <span className="text-text-muted block text-[10px] uppercase font-mono">Session Mode</span>
            <span className="font-semibold text-emerald-500">HttpOnly Cookie + JWT Session</span>
          </div>
        </div>
      </div>

      {/* Security Policies */}
      <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
          <Shield size={16} className="text-replit-orange" />
          <span>Security & Authorization Policies</span>
        </h2>

        <div className="divide-y divide-border-subtle text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-text-main block">Strict Server-Side Authorization</span>
              <span className="text-text-muted text-[11px]">
                All administrative endpoints require requireAdmin middleware verification.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ENFORCED
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-text-main block">Last Administrator Protection</span>
              <span className="text-text-muted text-[11px]">
                The platform prevents demoting or suspending the final active administrator.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ACTIVE
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-text-main block">Interview Safe Deletion Protocol</span>
              <span className="text-text-muted text-[11px]">
                Active socket sessions are terminated before soft-deletion with permanent audit logging.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Platform Endpoints */}
      <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
          <Server size={16} className="text-replit-orange" />
          <span>Platform Network Configuration</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
            <span className="text-text-muted block text-[10px] uppercase font-mono">Backend API URL</span>
            <span className="font-mono text-text-main text-[11px]">http://localhost:5000/api/v1</span>
          </div>

          <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
            <span className="text-text-muted block text-[10px] uppercase font-mono">Admin Panel Port</span>
            <span className="font-mono text-text-main text-[11px]">http://localhost:3001</span>
          </div>

          <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
            <span className="text-text-muted block text-[10px] uppercase font-mono">User App Port</span>
            <span className="font-mono text-text-main text-[11px]">http://localhost:3000</span>
          </div>

          <div className="p-3 rounded-lg bg-bg-card border border-border-subtle">
            <span className="text-text-muted block text-[10px] uppercase font-mono">PostgreSQL Database</span>
            <span className="font-mono text-text-main text-[11px]">localhost:5432 (codesync)</span>
          </div>
        </div>
      </div>
      </div>
    </AdminShell>
  );
}
