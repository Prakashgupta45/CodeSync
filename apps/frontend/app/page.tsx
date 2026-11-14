'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  Play,
  Check,
  CodeXml,
  ChevronRight,
  Users,
  Box,
  BrainCircuit,
  Sparkles,
  Zap,
  GitBranch,
} from 'lucide-react';
import HeroCollabAnimation from '@/components/ui/hero-collab-animation';
import { useAuth } from './context/auth-context';

const HERO_TYPEWRITER_LINE = 'Infinite Possibilities.';

const HERO_SUBTITLES = [
  'Real-Time Collaboration',
  'Collaborative Coding',
  'Technical Interviews',
  'AI-Assisted Development',
] as const;

export default function HomePage() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedLength, setTypedLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(saved);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  // Typewriter loop for the third headline line when motion is allowed
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    let delay = 85;
    if (!isDeleting && typedLength === HERO_TYPEWRITER_LINE.length) {
      delay = 1800;
    } else if (isDeleting && typedLength === 0) {
      delay = 400;
    } else if (isDeleting) {
      delay = 42;
    } else if (HERO_TYPEWRITER_LINE[typedLength] === ' ') {
      delay = 135;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && typedLength < HERO_TYPEWRITER_LINE.length) {
        setTypedLength((count) => count + 1);
      } else if (!isDeleting && typedLength === HERO_TYPEWRITER_LINE.length) {
        setIsDeleting(true);
      } else if (isDeleting && typedLength > 0) {
        setTypedLength((count) => count - 1);
      } else {
        setIsDeleting(false);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [typedLength, isDeleting, prefersReducedMotion]);

  // Subtle fade rotation for hero subtitle phrases when motion is allowed
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setSubtitleIndex((current) => (current + 1) % HERO_SUBTITLES.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

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

  return (
    <main className={`landing ${theme === 'dark' ? 'dark' : ''}`}>
      {/* 1. Navbar */}
      <nav className="navbar">
        <Link className="brand" href="#top">
          Code<span>Sync</span>
        </Link>

        <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#ai" onClick={() => setMobileMenuOpen(false)}>AI Interviewer</a>
          {user && (
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              Dashboard
            </Link>
          )}
        </div>

        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user ? (
            <>
              <Link className="button button-small" href="/dashboard">
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                className="sign-in"
                onClick={() => logout()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Sign out of your account"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link className="sign-in" href="/sign-in">
                Sign In
              </Link>
              <Link className="button button-small" href="/sign-up">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
          <button
            className="menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* 2. Hero Section with Animated Collaboration Showcase on the Right */}
      <section className="hero" id="top">
        <div className="hero-grid">
          {/* Left Column: Headlines, CTAs & Trust Badges */}
          <div className="hero-content">
            <h1
              className="hero-title"
              aria-label="Two Minds. One Codebase. Infinite Possibilities."
            >
              <span className="hero-line">Two Minds.</span>
              <span className="hero-line hero-line-accent">One Codebase.</span>
              <span className="hero-line hero-line-typewriter" aria-hidden="true">
                <span className="hero-type-sizer">
                  {HERO_TYPEWRITER_LINE}
                  <span className="hero-type-cursor" />
                </span>
                <span className="hero-type-live">
                  {prefersReducedMotion
                    ? HERO_TYPEWRITER_LINE
                    : HERO_TYPEWRITER_LINE.slice(0, typedLength)}
                  {!prefersReducedMotion && <span className="hero-type-cursor" />}
                </span>
              </span>
            </h1>

            <p className="hero-subtitle" aria-live="polite" aria-atomic="true">
              {HERO_SUBTITLES.map((phrase, index) => {
                const isActive = index === subtitleIndex;
                const stateClass = prefersReducedMotion
                  ? isActive
                    ? 'is-active is-static'
                    : 'is-hidden-static'
                  : isActive
                    ? 'is-active'
                    : 'is-inactive';

                return (
                  <span
                    key={phrase}
                    className={`hero-subtitle-phrase ${stateClass}`}
                    aria-hidden={!isActive}
                  >
                    {phrase}
                  </span>
                );
              })}
            </p>

            <p className="hero-copy">
              Work side by side in a shared coding environment with real-time editing, secure code execution, and seamless developer collaboration.
            </p>

            <div className="hero-actions">
              {user ? (
                <>
                  <Link className="button" href="/dashboard">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link className="button button-ghost" href="/rooms">
                    Browse Rooms
                  </Link>
                </>
              ) : (
                <>
                  <Link className="button" href="/sign-up">
                    Create Free Account <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link className="button button-ghost" href="/sign-in">
                    Sign In to IDE
                  </Link>
                </>
              )}
            </div>

            <p className="trust">
              <span>Real-Time Collaboration</span>
              <i />
              <span>Secure Code Execution</span>
              <i />
              <span>AI-Powered Interviews</span>
            </p>
          </div>

          {/* Right Column: Animated Collaborative Coding Card */}
          <div className="hero-visual">
            <HeroCollabAnimation />
          </div>
        </div>
      </section>

      {/* 3. Live IDE Preview Section (Image 1) */}
      <section className="preview-section" id="preview">
        <div className="ide-preview" aria-label="CodeSync collaborative IDE preview">
          <div className="ide-top">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <span className="room-pill">
              <span className="live" /> Two Sum challenge
            </span>
            <span className="language">
              TypeScript <ChevronRight className="w-3 h-3" />
            </span>
            <div className="ide-people">
              <span className="person purple">AM</span>
              <span className="person orange">JK</span>
              <span className="person blue">RL</span>
            </div>
          </div>

          <div className="ide-body">
            <div className="editor-panel">
              <div className="editor-tabs">
                <span className="tab active">
                  <CodeXml className="w-3.5 h-3.5" /> solution.ts <X className="w-3 h-3" />
                </span>
                <span className="tab-muted">+</span>
              </div>

              <div className="code-wrap">
                <div className="code-row">
                  <span className="line-no">01</span>
                  <span className="syntax">function </span>
                  <span>twoSum(nums: number[], target: number) &#123;</span>
                </div>
                <div className="code-row">
                  <span className="line-no">02</span>
                  <span className="syntax">&nbsp;&nbsp;const </span>
                  <span>seen = new Map&lt;number, number&gt;();</span>
                </div>
                <div className="code-row">
                  <span className="line-no">03</span>
                  <span />
                  <span />
                </div>
                <div className="code-row">
                  <span className="line-no">04</span>
                  <span className="syntax">&nbsp;&nbsp;for </span>
                  <span>(let i = 0; i &lt; nums.length; i++) &#123;</span>
                </div>
                <div className="code-row">
                  <span className="line-no">05</span>
                  <span className="syntax">&nbsp;&nbsp;&nbsp;&nbsp;const </span>
                  <span>complement = target - nums[i];</span>
                </div>
                <div className="code-row">
                  <span className="line-no">06</span>
                  <span className="syntax">&nbsp;&nbsp;&nbsp;&nbsp;if </span>
                  <span>(seen.has(complement)) &#123;</span>
                </div>
                <div className="code-row">
                  <span className="line-no">07</span>
                  <span className="syntax">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return </span>
                  <span>[seen.get(complement)!, i];</span>
                </div>
                <div className="code-row">
                  <span className="line-no">08</span>
                  <span className="syntax">&nbsp;&nbsp;&nbsp;&nbsp;&#125;</span>
                  <span />
                </div>
                <div className="code-row">
                  <span className="line-no">09</span>
                  <span className="syntax">&nbsp;&nbsp;&nbsp;&nbsp;</span>
                  <span>seen.set(nums[i], i);</span>
                </div>
                <div className="code-row">
                  <span className="line-no">10</span>
                  <span className="syntax">&nbsp;&nbsp;&#125;</span>
                  <span />
                </div>
                <div className="code-row">
                  <span className="line-no">11</span>
                  <span className="syntax">&nbsp;&nbsp;</span>
                  <span>return [];</span>
                </div>
                <div className="code-row">
                  <span className="line-no">12</span>
                  <span className="syntax">&#125;</span>
                  <span />
                </div>
              </div>

              <div className="editor-status">
                <span>main <span className="status-sep">/</span> solution.ts</span>
                <span className="collab"><span className="cursor orange-cursor" /> Jamie is editing</span>
              </div>
            </div>

            <aside className="ai-panel">
              <div className="ai-panel-head">
                <span className="ai-orb">
                  <CodeXml className="w-3.5 h-3.5" />
                </span>
                <div>
                  <strong>CodeSync AI</strong>
                  <small>Ready to help</small>
                </div>
                <span className="online-dot" />
              </div>

              <div className="ai-message">
                <span className="ai-label">AI ASSISTANT</span>
                <p>
                  This solution uses a hash map to find the complement in O(n) time. Want me to add edge case tests?
                </p>
                <div className="ai-code">
                  <span>const</span> result = twoSum([2, 7, 11, 15], 9)
                </div>
              </div>

              <div className="ai-actions">
                <button type="button">Explain code</button>
                <button type="button">Generate tests</button>
              </div>
            </aside>
          </div>

          <div className="console">
            <div>
              <span className="console-chevron">⌄</span>
              <strong>Output console</strong>
              <span className="passed">
                <Check className="w-3 h-3" /> Passed
              </span>
            </div>
            <span>2 tests passed <span className="console-sep">·</span> 42ms</span>
            <button type="button" className="run">
              <Play className="w-3.5 h-3.5" /> Run code
            </button>
          </div>
        </div>
      </section>

      {/* 4. Features Grid Section */}
      <section className="section features" id="features">
        <div className="section-heading">
          <p className="eyebrow">PLATFORM CAPABILITIES</p>
          <h2>
            Everything you need to<br />
            <em>code and evaluate together.</em>
          </h2>
          <p>
            Shared editing, isolated runtime containers, AI coding support, and structured technical interviews in one workspace.
          </p>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon">
              <Users className="w-5 h-5" />
            </div>
            <h3>Real-Time Pair Programming</h3>
            <ul className="feature-points">
              <li>
                <Check />
                <span>Shared Monaco code editor</span>
              </li>
              <li>
                <Check />
                <span>Live collaborative editing</span>
              </li>
              <li>
                <Check />
                <span>Multiple participant presence</span>
              </li>
              <li>
                <Check />
                <span>Real-time chat</span>
              </li>
            </ul>
            <a className="feature-card-link" href="#how-it-works">
              See workflow <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <Box className="w-5 h-5" />
            </div>
            <h3>Secure Code Execution</h3>
            <ul className="feature-points">
              <li>
                <Check />
                <span>Isolated Docker execution</span>
              </li>
              <li>
                <Check />
                <span>Multiple programming languages</span>
              </li>
              <li>
                <Check />
                <span>Custom input and test cases</span>
              </li>
              <li>
                <Check />
                <span>Execution results and errors</span>
              </li>
            </ul>
            <a className="feature-card-link" href="#preview">
              Inspect runtime <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3>AI Coding Assistant</h3>
            <ul className="feature-points">
              <li>
                <Check />
                <span>Context-aware coding assistance</span>
              </li>
              <li>
                <Check />
                <span>Programming problem explanations</span>
              </li>
              <li>
                <Check />
                <span>Development support</span>
              </li>
            </ul>
            <Link className="feature-card-link" href="/sign-up">
              Start building <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h3>AI Technical Interviews</h3>
            <ul className="feature-points">
              <li>
                <Check />
                <span>HR interview creation</span>
              </li>
              <li>
                <Check />
                <span>Candidate coding workspace</span>
              </li>
              <li>
                <Check />
                <span>Automated test evaluation</span>
              </li>
              <li>
                <Check />
                <span>Interview reports</span>
              </li>
            </ul>
            <a className="feature-card-link" href="#ai">
              Explore AI Interviewer <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </article>
        </div>
      </section>

      {/* 5. How It Works Section */}
      <section className="section process" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>
            Two structured workflows,<br />
            <em>built for real teams.</em>
          </h2>
          <p>
            Launch live pair programming sessions with teammates or run end-to-end technical interviews.
          </p>
        </div>

        <div className="workflow-tracks">
          {/* Workflow 1: Pair Programming */}
          <div className="workflow-track workflow-track-pair">
            <div className="workflow-track-head">
              <span className="workflow-tag">Pair Programming Workflow</span>
              <span className="workflow-track-note">Real-time shared workspace for engineering teams</span>
            </div>

            <div className="workflow-timeline">
              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">01</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>Create or Join a Room.</h3>
                <p>Start a dedicated collaborative session or enter an existing room link.</p>
              </div>

              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">02</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>Invite Your Teammate.</h3>
                <p>Share room access and coordinate participant roles in real time.</p>
              </div>

              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">03</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>Collaborate in the Shared Editor.</h3>
                <p>Write code together with synced edits, live presence, and room chat.</p>
              </div>

              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">04</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>Run Code and Build Together.</h3>
                <p>Execute multi-language solutions in isolated containers and debug output.</p>
              </div>
            </div>
          </div>

          {/* Workflow 2: AI Interview */}
          <div className="workflow-track workflow-track-interview">
            <div className="workflow-track-head">
              <span className="workflow-tag">AI Interview Workflow</span>
              <span className="workflow-track-note">Structured technical assessments from invite to report</span>
            </div>

            <div className="workflow-timeline">
              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">01</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>HR Creates an Interview.</h3>
                <p>Define coding problems, target languages, and test cases for the role.</p>
              </div>

              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">02</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>Candidate Joins Through Invitation.</h3>
                <p>Candidates open their private invitation link straight in the browser.</p>
              </div>

              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">03</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>Candidate Solves Coding Problems.</h3>
                <p>Write code in the live workspace, run tests, and engage the AI interviewer.</p>
              </div>

              <div className="workflow-step">
                <div className="workflow-step-top">
                  <span className="workflow-step-badge">04</span>
                  <span className="workflow-step-connector" aria-hidden="true" />
                </div>
                <h3>HR Reviews the Evaluation Report.</h3>
                <p>Inspect visible and hidden test scores alongside the candidate report.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. AI Interviewer Section */}
      <section className="section ai-section" id="ai">
        <div className="ai-copy">
          <p className="eyebrow">AI INTERVIEWER</p>
          <h2>
            Technical Interviews,<br />
            <em>Reimagined.</em>
          </h2>
          <p>
            Create structured coding interviews, assess problem-solving skills, and review candidate performance through a unified interview workspace.
          </p>

          <ul className="ai-highlights">
            <li>
              <Check />
              <div>
                <strong>Custom interview creation by HR</strong>{' '}
                <span>with configurable coding problems and programming languages.</span>
              </div>
            </li>
            <li>
              <Check />
              <div>
                <strong>Candidate invitation links</strong>{' '}
                <span>leading directly into a live coding workspace.</span>
              </div>
            </li>
            <li>
              <Check />
              <div>
                <strong>AI interviewer conversation</strong>{' '}
                <span>for interactive technical follow-ups during the session.</span>
              </div>
            </li>
            <li>
              <Check />
              <div>
                <strong>Visible and hidden test evaluation</strong>{' '}
                <span>checked automatically upon code submission.</span>
              </div>
            </li>
            <li>
              <Check />
              <div>
                <strong>Interview completion &amp; HR evaluation reports</strong>{' '}
                <span>capturing test outcomes and code quality metrics.</span>
              </div>
            </li>
          </ul>

          <div className="ai-cta-row">
            <Link className="button" href="/interview">
              Explore AI Interviewer <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="assistant-demo interview-demo" aria-label="CodeSync AI Interviewer workspace preview">
          <div className="demo-head">
            <span className="ai-orb">
              <BrainCircuit className="w-3.5 h-3.5" />
            </span>
            <div>
              <strong>AI Interview Workspace</strong>
              <small>Two Sum Optimization · TypeScript</small>
            </div>
            <span className="interview-demo-status">
              <span className="online-dot" /> Live Session
            </span>
          </div>

          <div className="demo-thread">
            <div className="interview-demo-problem">
              <span className="ai-label">CODING WORKSPACE</span>
              <div className="demo-code">
                <span className="syntax">function</span> <span className="blue-text">twoSum</span>(nums: number[], target: number) &#123;<br />
                &nbsp;&nbsp;<span className="syntax">const</span> seen = <span className="syntax">new</span> Map&lt;number, number&gt;();<br />
                &nbsp;&nbsp;<span className="syntax">return</span> findComplementIndices(nums, target, seen);<br />
                &#125;
              </div>
            </div>

            <div className="demo-answer">
              <span className="ai-label">AI INTERVIEWER</span>
              <p>
                Good O(n) single-pass lookup. What happens if the input contains duplicate numbers matching half the target?
              </p>
            </div>
          </div>

          <div className="interview-demo-footer">
            <span className="passed">
              <Check className="w-3 h-3" /> Visible 3/3
            </span>
            <span className="passed">
              <Check className="w-3 h-3" /> Hidden 5/5
            </span>
            <span className="report-pill">HR Report Ready</span>
          </div>
        </div>
      </section>

      {/* 7. CTA Section */}
      <section className="cta" id="cta">
        <div className="cta-icon">
          <Zap className="w-6 h-6" />
        </div>
        <h2>
          Build and evaluate code,<br />
          <em>together.</em>
        </h2>
        <p>Start a real-time pair programming room or launch a structured coding interview in minutes.</p>
        <div className="hero-actions">
          {user ? (
            <Link className="button" href="/dashboard">
              Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link className="button" href="/sign-up">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
          <a className="button button-ghost" href="#features">
            Explore Features
          </a>
        </div>
      </section>

      {/* 8. Footer */}
      <footer id="footer">
        <div className="footer-brand-col">
          <Link className="brand" href="#top">
            Code<span>Sync</span>
          </Link>
          <p>
            Real-time pair programming, isolated code execution, and AI technical interviews for software engineering teams.
          </p>
        </div>

        <div className="footer-col">
          <strong>Product</strong>
          <a href="#preview">IDE Preview</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#ai">AI Interviewer</a>
        </div>

        <div className="footer-col">
          <strong>Workspace</strong>
          <Link href="/rooms">Rooms</Link>
          <Link href="/interview">AI Interviewer</Link>
          {user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <button
                onClick={() => logout()}
                style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0 }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in">Sign In</Link>
              <Link href="/sign-up">Get Started</Link>
            </>
          )}
        </div>

        <div className="footer-mark" aria-hidden="true">
          <GitBranch className="w-5 h-5" />
        </div>

        <div className="copyright">
          © 2026 CodeSync AI. Built for collaborative engineering.
        </div>
      </footer>
    </main>
  );
}
