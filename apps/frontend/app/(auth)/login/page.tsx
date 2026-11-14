'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isAuthLoading, router]);

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
    if (!email || !password) {
      setError('Please fill in both email and password');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="auth-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Loader2 className="lucide animate-spin" size={28} color="#ff5c00" />
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Verifying session...</span>
        </div>
      </div>
    );
  }

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
          <div className="kicker">SIGN IN</div>
          <h1>Welcome back</h1>
          <p className="auth-copy">Sign in to continue building with your team.</p>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <div className="auth-options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />{' '}
                Remember me
              </label>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className="app-button wide"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="lucide animate-spin" size={16} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="lucide" size={16} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            New to CodeSync? <Link href="/sign-up">Create an account</Link>
          </p>
        </div>

        <div className="auth-aside">
          <div
            className="collab-illustration"
            aria-label="Two developers collaborating in a shared code editor"
          >
            <div className="collab-window">
              <div className="collab-window-bar">
                <i />
                <i />
                <i />
                <span>team-room.tsx</span>
              </div>
              <div className="collab-window-body">
                <div className="collab-code">
                  <b />
                  <b />
                  <b />
                  <b />
                  <b />
                  <b />
                </div>
                <div className="collab-editor">
                  <span className="code-line coral">const</span>
                  <span className="code-line"> solution = <i>pair</i>(team);</span>
                  <span className="code-line purple">await</span>
                  <span className="code-line"> solution.sync();</span>
                  <span className="code-line blue">export</span>
                  <span className="code-line"> default solution;</span>
                </div>
                <span className="collab-cursor" />
              </div>
            </div>
            <div className="collab-person person-left">
              <span className="collab-head" />
              <span className="collab-body" />
              <span className="collab-arm" />
            </div>
            <div className="collab-person person-right">
              <span className="collab-head" />
              <span className="collab-body" />
              <span className="collab-arm" />
            </div>
            <span className="collab-spark spark-one" />
            <span className="collab-spark spark-two" />
          </div>

          <h2>
            Build better software,
            <br />
            <em>together.</em>
          </h2>
          <p>
            Real-time collaboration, secure code execution, and AI-powered
            interviews in one focused workspace.
          </p>
          <div className="aside-stats">
            <span>
              <strong style={{ color: theme === 'light' ? '#111827' : '#f8fafc' }}>24</strong>{' '}
              <span style={{ color: theme === 'light' ? '#4b5563' : '#94a3b8' }}>active rooms</span>
            </span>
            <span>
              <strong style={{ color: theme === 'light' ? '#111827' : '#f8fafc' }}>99.9%</strong>{' '}
              <span style={{ color: theme === 'light' ? '#4b5563' : '#94a3b8' }}>sync uptime</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
