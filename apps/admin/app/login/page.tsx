'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/admin-auth-context';
import { Shield, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'unauthorized') {
        setError('A standard user session was detected. Administrator credentials are required to access this console.');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div className="card-admin w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
        {/* Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-replit-orange via-amber-500 to-replit-orange" />

        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-replit-orange/20 border border-replit-orange/40 flex items-center justify-center text-replit-orange mb-2">
            <Shield size={24} />
          </div>
          <h1 className="text-xl font-extrabold text-text-main tracking-tight">
            CodeSync Administrative Console
          </h1>
          <p className="text-xs text-text-muted">
            Sign in with verified administrator credentials to access platform controls.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-text-muted uppercase font-mono text-[10px] mb-1 font-bold">
              Admin Email
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus-within:border-replit-orange transition-colors">
              <Mail size={14} className="text-text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@codesync.ai"
                className="bg-transparent text-xs text-text-main outline-none w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-text-muted uppercase font-mono text-[10px] mb-1 font-bold">
              Password
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-card border border-border-subtle focus-within:border-replit-orange transition-colors">
              <Lock size={14} className="text-text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-transparent text-xs text-text-main outline-none w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-lg bg-replit-orange hover:bg-replit-orange-hover text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Verifying Administrator Privileges...</span>
              </>
            ) : (
              <span>Sign In to Admin Console</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-border-subtle text-center text-[11px] text-text-muted">
          <span>Protected Administrative Interface • Role-Based Access Control Enforced</span>
        </div>
      </div>
    </div>
  );
}
