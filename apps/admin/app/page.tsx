'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../context/admin-auth-context';

export default function RootAdminPage() {
  const router = useRouter();
  const { user, isLoading } = useAdminAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-replit-orange border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
