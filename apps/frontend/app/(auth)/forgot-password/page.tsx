'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('codesync-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSent(true);
    }, 1000);
  };

  return (
    <div className="auth-shell">
      <div className="auth-header">
        <Link className="auth-brand" href="/">
          <span>Code</span>Sync <small>AI</small>
        </Link>
        <button
          className="app-icon-btn auth-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☼' : '☾'}
        </button>
      </div>

      <div className="auth-layout">
        <div className="auth-card">
          <div className="kicker">RECOVERY</div>
          <h1>Reset password</h1>
          <p className="auth-copy">
            Enter your email and we&apos;ll send you recovery instructions.
          </p>

          {isSent ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                Check your inbox
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginBottom: '24px' }}>
                We sent a password reset link to <strong>{email}</strong>.
              </p>
              <Link href="/sign-in" className="app-button wide">
                Back to Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label>
                Email address
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <button
                type="submit"
                className="app-button wide"
                disabled={isSubmitting}
                style={{ marginTop: '16px' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="lucide animate-spin" size={16} />
                    Sending link...
                  </>
                ) : (
                  <>
                    Send recovery link
                    <ArrowRight className="lucide" size={16} />
                  </>
                )}
              </button>

              <p className="auth-switch">
                <Link href="/sign-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowLeft size={14} /> Back to Sign in
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="auth-aside">
          <h2>
            Secure by design,
            <br />
            <em>always.</em>
          </h2>
          <p>
            Enterprise-grade token rotation, isolated container sandboxes, and encrypted real-time state synchronization.
          </p>
        </div>
      </div>
    </div>
  );
}
