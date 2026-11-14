'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { AppShell } from '../../../components/layout/app-shell';
import { ArrowLeft, Loader2, Plus, Terminal } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python' | 'cpp' | 'java'>('typescript');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/sign-in');
    }
  }, [user, isAuthLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a room name');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), language }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create room');
      }
      router.push(`/rooms/${data.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create room. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Create Room" subtitle="Initialize a new collaborative environment">
      <main className="dashboard-content" style={{ maxWidth: '640px', margin: '40px auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link
            href="/rooms"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-muted, #94a3b8)',
              textDecoration: 'none',
              marginBottom: '16px',
            }}
          >
            <ArrowLeft size={14} /> Back to Rooms
          </Link>
          <div className="kicker">WORKSPACE SETUP</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 8px' }}>
            Create Coding Room
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)' }}>
            Initialize a real-time collaborative workspace with isolated Docker execution and AI pair programming.
          </p>
        </div>

        <div className="panel" style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                marginBottom: '18px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
              }}
            >
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: '18px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Room Name
              </span>
              <input
                type="text"
                placeholder="e.g. DSA Practice - Trees & Graphs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  background: 'var(--bg-surface, rgba(255,255,255,0.03))',
                  color: 'inherit',
                  fontSize: '14px',
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '24px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Target Language
              </span>
              <select
                value={language}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setLanguage(e.target.value as typeof language)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  background: 'var(--bg-surface, rgba(255,255,255,0.03))',
                  color: 'inherit',
                  fontSize: '14px',
                }}
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript (Node.js)</option>
                <option value="python">Python 3.11</option>
                <option value="java">Java 21</option>
                <option value="cpp">C++ 20</option>
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Link href="/rooms" className="app-button secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="app-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="lucide animate-spin" size={16} /> Creating...
                  </>
                ) : (
                  <>
                    <Plus className="lucide" size={16} /> Create Room
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
