'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { RoomDto } from '@codesync/shared';
import {
  Code2,
  Plus,
  Search,
  Filter,
  LogOut,
  LayoutDashboard,
  FolderGit2,
  Users,
  ArrowUpRight,
  Loader2,
  Terminal,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default function RoomsDashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, logout } = useAuth();

  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.append('search', search.trim());
      if (languageFilter !== 'all') queryParams.append('language', languageFilter);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);

      const res = await fetch(`${API_BASE_URL}/rooms?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          setRooms(result.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, languageFilter, statusFilter]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    } else if (user) {
      fetchRooms();
    }
  }, [user, isAuthLoading, router, fetchRooms]);

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-replit-orange">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-xs font-mono text-text-muted">Loading Coding Rooms Workspace...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col">
      {/* Top Header Navigation */}
      <header className="border-b border-border-subtle bg-bg-surface sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-replit-orange/10 border border-replit-orange/30 text-replit-orange">
                <Code2 className="w-5 h-5" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                CodeSync <span className="text-replit-orange font-mono">AI</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-text-muted hover:text-white transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              <Link
                href="/rooms"
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-bg-secondary text-white border border-border-subtle"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                My Rooms
              </Link>
            </nav>
          </div>

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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Header Title & Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Coding Rooms</h1>
            <p className="text-xs text-text-muted mt-1">
              Manage your real-time collaborative coding environments
            </p>
          </div>

          <Link href="/rooms/create" className="btn-replit-primary text-xs shrink-0">
            <Plus className="w-4 h-4" />
            Create Room
          </Link>
        </div>

        {/* Unified Filter Toolbar */}
        <div className="card-replit p-3.5 flex flex-col md:flex-row items-center gap-3 shadow-md">
          {/* Search Input */}
          <div className="relative flex-1 w-full flex items-center group">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#62687a] group-hover:text-[#9da2b0] group-focus-within:text-replit-orange transition-colors duration-150 z-10"
            />
            <input
              type="text"
              aria-label="Search rooms by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms by name..."
              style={{ paddingLeft: '2.5rem' }}
              className="w-full h-10 py-2 pr-3.5 text-xs text-text-main font-sans rounded-md bg-[#16181d] hover:bg-[#1a1d24] border border-border-subtle hover:border-[#404656] focus:border-replit-orange focus:bg-[#1c1e26] focus:outline-none focus:ring-2 focus:ring-replit-orange/20 transition-all duration-150 placeholder:text-[#62687a]"
            />
          </div>

          {/* Filter Controls Group */}
          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 text-xs text-[#9da2b0] font-mono shrink-0 select-none">
              <Filter className="w-3.5 h-3.5 text-[#62687a]" />
              <span>Filter:</span>
            </div>

            {/* Language Select */}
            <select
              aria-label="Filter by language"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              className="select-replit h-10 w-full sm:w-auto"
            >
              <option value="all">All Languages</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>

            {/* Status Select */}
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-replit h-10 w-full sm:w-auto"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {/* Rooms Table */}
        <div className="card-replit overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center text-text-muted flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-replit-orange" />
              <span className="text-xs font-mono">Fetching rooms...</span>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-16 text-center text-text-muted flex flex-col items-center gap-3">
              <Terminal className="w-8 h-8 text-border-subtle" />
              <p className="text-sm font-medium text-white">No coding rooms found</p>
              <p className="text-xs max-w-sm">
                Create a new room or join an existing room invitation link to get started.
              </p>
              <Link href="/rooms/create" className="btn-replit-primary text-xs mt-2">
                <Plus className="w-4 h-4" />
                Create First Room
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-secondary/40 text-[11px] font-mono text-text-muted uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium">Room Name</th>
                    <th className="px-5 py-3 font-medium">Room ID</th>
                    <th className="px-5 py-3 font-medium">Language</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Members</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-bg-secondary/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-replit-orange" />
                        {room.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-muted text-[11px]">
                        {room.id}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        <span className="px-2 py-0.5 rounded bg-bg-secondary border border-border-subtle text-text-muted">
                          {room.language}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            room.role === 'OWNER'
                              ? 'bg-replit-orange/20 text-replit-orange border border-replit-orange/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {room.role || 'MEMBER'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        <span
                          className={
                            room.status === 'ACTIVE' ? 'text-emerald-400' : 'text-gray-500'
                          }
                        >
                          {room.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-muted">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{room.memberCount || 1}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/room/${room.id}`}
                          className="inline-flex items-center gap-1 text-replit-orange hover:underline font-mono text-[11px] font-semibold"
                        >
                          Open Room
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
