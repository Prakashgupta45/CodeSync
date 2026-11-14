'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../context/admin-auth-context';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { Loader2 } from 'lucide-react';

export interface AdminShellProps {
  title?: string;
  children: React.ReactNode;
}

export function AdminShell({ title, children }: AdminShellProps) {
  const router = useRouter();
  const { user, isLoading } = useAdminAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 text-replit-orange animate-spin" />
          <span className="text-xs text-text-muted font-medium">Verifying Administrator Privileges...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main flex">
      {/* Sidebar (Desktop sticky & Mobile drawer) */}
      <AdminSidebar isMobileOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar title={title} onOpenMobile={() => setIsMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
