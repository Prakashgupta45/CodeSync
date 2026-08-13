'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import {
  Code2,
  LogOut,
  User,
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  Plus,
  LogIn,
  LayoutDashboard,
  FolderGit2,
  Terminal,
  Loader2,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rooms'>('dashboard');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-replit-orange">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-mono text-text-muted">Loading Replit Developer Workspace...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Mock list of recent room environments for UI workspace display (Phase 2 preview)
  const recentRooms = [
    {
      id: 'rm-9a8b7c6d',
      name: 'Algorithm Pairing Session',
      language: 'TypeScript',
      status: 'Ready (Phase 2)',
      updated: '2 mins ago',
    },
    {
      id: 'rm-5e4d3c2b',
      name: 'Backend API Code Review',
      language: 'Node.js',
      status: 'Ready (Phase 2)',
      updated: '1 hour ago',
    },
    {
      id: 'rm-1f2e3d4c',
      name: 'Data Structures Interview',
      language: 'Python',
      status: 'Ready (Phase 2)',
      updated: 'Yesterday',
    },
  ];

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col">
      {/* Replit Top Navigation Bar */}
      <header className="border-b border-border-subtle bg-bg-surface sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-replit-orange/10 border border-replit-orange/30 text-replit-orange">
                <Code2 className="w-5 h-5" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                CodeSync <span className="text-replit-orange font-mono">AI</span>
              </span>
            </div>

            {/* Nav Tabs */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-bg-secondary text-white border border-border-subtle'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'rooms'
                    ? 'bg-bg-secondary text-white border border-border-subtle'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                Rooms
              </button>
            </nav>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-bg-secondary border border-border-subtle text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-text-main font-medium">{user.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className="btn-replit-secondary text-xs px-3 py-1 text-red-400 hover:text-red-300 border-red-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Phase 1 Auth Active -- Replit Theme Verified
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Logged in as <span className="font-mono text-text-main">{user.email}</span>. Your session is protected by HTTP-Only cookies & token rotation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Room creation will be enabled in Phase 2!')}
              className="btn-replit-primary text-xs"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </button>
            <button
              onClick={() => alert('Joining rooms will be enabled in Phase 2!')}
              className="btn-replit-secondary text-xs"
            >
              <LogIn className="w-4 h-4" />
              Join Room
            </button>
          </div>
        </div>

        {/* Recent Rooms Table Container */}
        <div className="card-replit overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-subtle bg-bg-surface flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-replit-orange" />
              <h2 className="text-sm font-bold text-white">Recent Coding Rooms</h2>
            </div>
            <span className="text-[11px] font-mono text-text-muted">Phase 2 Coding Rooms Module</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-secondary/40 text-[11px] font-mono text-text-muted uppercase tracking-wider">
                  <th className="px-5 py-2.5 font-medium">Room Name</th>
                  <th className="px-5 py-2.5 font-medium">Room ID</th>
                  <th className="px-5 py-2.5 font-medium">Language</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {recentRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-replit-orange" />
                      {room.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-text-muted">{room.id}</td>
                    <td className="px-5 py-3 font-mono">
                      <span className="px-2 py-0.5 rounded bg-bg-secondary border border-border-subtle text-text-muted">
                        {room.language}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-emerald-400">{room.status}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => alert(`Room ${room.id} is queued for Phase 2 implementation.`)}
                        className="inline-flex items-center gap-1 text-replit-orange hover:underline font-mono text-[11px]"
                      >
                        Open
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Account & Security Grid */}
        <div className="grid md:grid-cols-3 gap-5">
          <div className="card-replit p-5">
            <div className="flex items-center gap-2 text-replit-orange mb-3">
              <User className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">User Details</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] text-text-muted block font-mono">NAME</span>
                <span className="text-white font-medium">{user.name}</span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block font-mono">USER ID</span>
                <span className="font-mono text-[11px] text-text-muted break-all">{user.id}</span>
              </div>
            </div>
          </div>

          <div className="card-replit p-5">
            <div className="flex items-center gap-2 text-replit-orange mb-3">
              <Mail className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Account Config</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] text-text-muted block font-mono">EMAIL</span>
                <span className="text-white font-medium">{user.email}</span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block font-mono">ROLE</span>
                <span className="inline-block px-2 py-0.5 rounded bg-replit-orange/20 text-replit-orange font-mono text-[11px]">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="card-replit p-5">
            <div className="flex items-center gap-2 text-replit-orange mb-3">
              <Shield className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Security State</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] text-text-muted block font-mono">AUTH STRATEGY</span>
                <span className="text-emerald-400 font-mono text-[11px] block">
                  HTTP-Only Cookie + Rotation
                </span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block font-mono">CREATED AT</span>
                <span className="text-text-muted font-mono text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-text-muted" />
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-bg-surface py-4 text-center text-xs text-text-muted font-mono">
        CodeSync AI Platform -- Replit Developer Theme Workspace
      </footer>
    </div>
  );
}
