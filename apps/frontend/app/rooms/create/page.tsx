'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { FormInput } from '../../../components/ui/form-input';
import { Code2, FolderPlus, ArrowLeft, Loader2, AlertCircle, Terminal } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'javascript' | 'python' | 'cpp' | 'java'>('javascript');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, language }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to create room');
      }

      router.push(`/room/${result.data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-replit-orange">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6">
          <Link href="/rooms" className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Rooms
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-replit-orange/10 border border-replit-orange/30 text-replit-orange">
              <FolderPlus className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Create Coding Room</h1>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Initialize a new collaborative environment
          </p>
        </div>

        {/* Card */}
        <div className="card-replit p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs font-mono" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Room Name"
              type="text"
              icon={Terminal}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Algorithm Pairing Session"
              autoFocus
            />

            <div>
              <label className="block text-xs font-mono font-medium text-text-muted mb-1.5 uppercase tracking-wider">
                Target Language *
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="input-replit py-2.5 text-sm"
              >
                <option value="javascript">JavaScript (Node.js)</option>
                <option value="python">Python 3</option>
                <option value="cpp">C++ (GCC)</option>
                <option value="java">Java 21</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/rooms" className="btn-replit-secondary text-xs">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-replit-primary text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    Create Room
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
