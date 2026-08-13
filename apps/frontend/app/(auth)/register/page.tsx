'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { Code2, User, Mail, Lock, ArrowRight, AlertCircle, Loader2, Check } from 'lucide-react';
import { FormInput } from '../../../components/ui/form-input';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordReqs = [
    { label: '8+ chars', met: password.length >= 8 },
    { label: 'Uppercase [A-Z]', met: /[A-Z]/.test(password) },
    { label: 'Lowercase [a-z]', met: /[a-z]/.test(password) },
    { label: 'Number [0-9]', met: /[0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({ name, email, password });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
          <h1 className="text-lg font-bold text-white mt-1">Create your developer account</h1>
          <p className="text-xs text-text-muted">Start collaborative pair programming</p>
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
              label="Full Name"
              type="text"
              icon={User}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Mercer"
              autoComplete="name"
            />

            <FormInput
              label="Email Address"
              type="email"
              icon={Mail}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              autoComplete="email"
            />

            <div>
              <FormInput
                label="Password"
                type="password"
                icon={Lock}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
              />

              {/* Password Requirement Chips */}
              <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                {passwordReqs.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[11px] font-mono">
                    <Check
                      className={`w-3 h-3 ${
                        req.met ? 'text-emerald-400' : 'text-gray-600'
                      }`}
                    />
                    <span className={req.met ? 'text-emerald-400' : 'text-gray-500'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-replit-primary w-full py-2.5 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border-subtle text-center text-xs text-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="link-replit">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
