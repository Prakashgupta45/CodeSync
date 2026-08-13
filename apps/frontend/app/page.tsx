'use client';

import Link from 'next/link';
import { useAuth } from './context/auth-context';
import { Code2, Terminal, Cpu, Shield, ArrowRight, UserCheck, Code } from 'lucide-react';

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="border-b border-border-subtle bg-bg-surface/90 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-replit-orange/10 border border-replit-orange/30 text-replit-orange">
              <Code2 className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">CodeSync</span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-replit-orange/20 text-replit-orange border border-replit-orange/30">
                AI IDE
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-24 h-8 bg-bg-secondary animate-pulse rounded-md" />
            ) : user ? (
              <Link href="/dashboard" className="btn-replit-primary">
                <UserCheck className="w-4 h-4" />
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-replit-secondary text-xs">
                  Sign In
                </Link>
                <Link href="/register" className="btn-replit-primary text-xs">
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 text-center py-16 flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-surface border border-border-subtle text-xs font-mono text-text-muted mb-6">
          <Terminal className="w-3.5 h-3.5 text-replit-orange" />
          <span>codesync-ai v0.1.0 --phase-1 active</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 tracking-tight leading-tight">
          AI-Powered Real-Time Pair Programming <br />
          <span className="text-replit-orange">& Coding Interview Platform</span>
        </h1>

        <p className="text-base text-text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
          Collaborative code editor, secure isolated Docker runtimes, AI coding assistants, and technical interview reports designed for high-performance software engineering teams.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mb-16">
          <Link
            href={user ? '/dashboard' : '/register'}
            className="btn-replit-primary w-full sm:w-auto px-6 py-2.5 text-sm"
          >
            {user ? 'Open Workspace Dashboard' : 'Create Free Account'}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="btn-replit-secondary w-full sm:w-auto px-6 py-2.5 text-sm"
          >
            Sign In to IDE
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-3 gap-5 text-left w-full">
          <div className="card-replit p-5">
            <div className="p-2 w-fit rounded bg-bg-secondary text-replit-orange mb-3 border border-border-subtle">
              <Code className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">Real-Time CRDT Sync</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Sub-millisecond collaborative editor sync built with Yjs, Monaco, and WebSockets.
            </p>
          </div>

          <div className="card-replit p-5">
            <div className="p-2 w-fit rounded bg-bg-secondary text-replit-orange mb-3 border border-border-subtle">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">Docker Execution</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Isolated multi-language code execution workers with memory and CPU time limits.
            </p>
          </div>

          <div className="card-replit p-5">
            <div className="p-2 w-fit rounded bg-bg-secondary text-replit-orange mb-3 border border-border-subtle">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">AI Interviewer</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Automated coding evaluation, code quality feedback, and real-time candidate assistance.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-bg-surface py-5 text-center text-xs text-text-muted font-mono">
        CodeSync AI Platform -- Replit Developer Theme -- Phase 1 Verified
      </footer>
    </div>
  );
}
