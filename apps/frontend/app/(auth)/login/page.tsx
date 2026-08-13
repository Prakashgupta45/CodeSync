'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { Code2, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { FormInput } from '../../../components/ui/form-input';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
            <div className="p-2 rounded bg-replit-orange/10 border border-replit-orange/30 text-replit-orange group-hover:bg-replit-orange/20 transition-colors">
              <Code2 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              CodeSync <span className="text-replit-orange font-mono">AI</span>
            </span>
          </Link>
          <h1 className="text-lg font-bold text-white mt-1">Sign in to your account</h1>
          <p className="text-xs text-text-muted">Access your real-time developer workspace</p>
        </div>

        {/* Card */}
        <div className="card-replit p-6 shadow-xl border border-border-subtle">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs font-mono" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Email Address"
              type="email"
              icon={Mail}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@codesync.ai"
              autoComplete="email"
            />

            <FormInput
              label="Password"
              type="password"
              icon={Lock}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-replit-primary w-full py-2.5 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border-subtle text-center text-xs text-text-muted">
            Don't have an account?{' '}
            <Link href="/register" className="link-replit">
              Create one now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
