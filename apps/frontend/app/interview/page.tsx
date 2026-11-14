'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { AppNavbar } from '../../components/ui/navbar';
import {
  getInterviews,
  InterviewItem,
  QUESTION_LIBRARY,
  ProblemDefinition,
} from '../../lib/interview-service';
import { CreateInterviewWizard } from '../../components/interview/create-interview-wizard';
import {
  Bot,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Award,
  BookOpen,
  Code2,
  FileText,
  ShieldCheck,
  Layers,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export default function InterviewDashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Interviews Registry State
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'interviews' | 'library' | 'candidates' | 'reports'>('interviews');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Question Library Preview Modal
  const [previewProblem, setPreviewProblem] = useState<ProblemDefinition | null>(null);

  // Copy toast state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/sign-in');
    }
  }, [user, isAuthLoading, router]);

  // Load interviews from server store and merge with localStorage registry
  useEffect(() => {
    if (!user) return;
    setInterviews(getInterviews());
    fetch('/api/interviews', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setInterviews(res.data);
          try {
            localStorage.setItem('codesync_interviews_registry_v1', JSON.stringify(res.data));
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, [user]);

  const handleCancelInterview = async (item: InterviewItem) => {
    try {
      const res = await fetch(`/api/interviews/${item.token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (res.ok) {
        const updatedList = interviews.map((i) =>
          i.id === item.id ? { ...i, status: 'CANCELLED' as const } : i
        );
        setInterviews(updatedList);
        try {
          localStorage.setItem('codesync_interviews_registry_v1', JSON.stringify(updatedList));
        } catch (_) {}
      }
    } catch (_) {}
  };

  const handleInterviewCreated = (newInterview: InterviewItem) => {
    setInterviews((prev) => [newInterview, ...prev.filter((i) => i.id !== newInterview.id)]);
  };

  const handleCopyLink = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/interview/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Filtered Interviews
  const filteredInterviews = interviews.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesDiff = difficultyFilter === 'ALL' || item.difficulty === difficultyFilter;
    const matchesRole = roleFilter === 'ALL' || item.role === roleFilter;

    return matchesSearch && matchesStatus && matchesDiff && matchesRole;
  });

  // Summary Metrics
  const scheduledCount = interviews.filter((i) => i.status === 'SCHEDULED').length;
  const activeCount = interviews.filter((i) => i.status === 'ACTIVE').length;
  const completedCount = interviews.filter((i) => i.status === 'COMPLETED').length;

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col font-sans">
        <AppNavbar activeTab="/interview" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-text-muted">Loading interview suite...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col font-sans">
      <AppNavbar activeTab="/interview" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* TOP HERO & HEADER ACTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-replit-orange text-xs font-mono font-semibold mb-2">
              <Bot className="w-3.5 h-3.5" />
              <span>AI Interviewer Proctor &amp; Assessment Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
              Technical Interview Management
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Configure adaptive coding problems, monitor live proctored sessions, and evaluate candidate performance reports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="iw-btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px' }}
            >
              <Plus size={16} />
              <span>Create New Interview</span>
            </button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card-replit p-4 border border-border-subtle flex flex-col gap-1">
            <span className="text-xs font-mono text-text-muted uppercase">Scheduled</span>
            <strong className="text-2xl font-black text-text-main">{scheduledCount}</strong>
            <span className="text-[11px] text-text-muted">Upcoming Assessments</span>
          </div>

          <div className="card-replit p-4 border border-border-subtle flex flex-col gap-1">
            <span className="text-xs font-mono text-text-muted uppercase">Active Now</span>
            <strong className="text-2xl font-black text-replit-orange flex items-center gap-2">
              <span className="sync-dot" /> {activeCount}
            </strong>
            <span className="text-[11px] text-text-muted">Live In-Progress Rooms</span>
          </div>

          <div className="card-replit p-4 border border-border-subtle flex flex-col gap-1">
            <span className="text-xs font-mono text-text-muted uppercase">Completed</span>
            <strong className="text-2xl font-black text-green-500">{completedCount}</strong>
            <span className="text-[11px] text-text-muted">Evaluated &amp; Submitted</span>
          </div>

          <div className="card-replit p-4 border border-border-subtle flex flex-col gap-1">
            <span className="text-xs font-mono text-text-muted uppercase">Question Library</span>
            <strong className="text-2xl font-black text-text-main">{QUESTION_LIBRARY.length}</strong>
            <span className="text-[11px] text-text-muted">Top Algorithmic Challenges</span>
          </div>
        </div>

        {/* SUB-NAVIGATION TABS */}
        <div className="flex border-b border-border-subtle space-x-6 text-sm font-semibold">
          <button
            type="button"
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'interviews'
                ? 'border-replit-orange text-replit-orange font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
            onClick={() => setActiveTab('interviews')}
          >
            My Interviews ({interviews.length})
          </button>

          <button
            type="button"
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'library'
                ? 'border-replit-orange text-replit-orange font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
            onClick={() => setActiveTab('library')}
          >
            Question Library ({QUESTION_LIBRARY.length})
          </button>

          <button
            type="button"
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'candidates'
                ? 'border-replit-orange text-replit-orange font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
            onClick={() => setActiveTab('candidates')}
          >
            Candidates &amp; Verdicts
          </button>

          <button
            type="button"
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'reports'
                ? 'border-replit-orange text-replit-orange font-bold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
            onClick={() => setActiveTab('reports')}
          >
            HR Evaluation Reports
          </button>
        </div>

        {/* TAB 1: MY INTERVIEWS LIST & FILTERS */}
        {activeTab === 'interviews' && (
          <div className="space-y-4">
            {/* Filter Controls Row */}
            <div className="card-replit p-3 border border-border-subtle flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Search size={14} className="text-text-muted" />
                <input
                  type="text"
                  placeholder="Search by title, candidate name, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-text-main outline-none w-full"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Status Pills */}
                <div className="flex rounded bg-bg-surface border border-border-subtle p-0.5">
                  {(['ALL', 'SCHEDULED', 'ACTIVE', 'COMPLETED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                        statusFilter === st
                          ? 'bg-replit-orange text-white'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Difficulty Select */}
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="wizard-select-sm"
                >
                  <option value="ALL">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>

                {/* Role Select */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="wizard-select-sm"
                >
                  <option value="ALL">All Roles</option>
                  <option value="SDE">SDE</option>
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                </select>
              </div>
            </div>

            {/* Interviews List Cards */}
            {filteredInterviews.length === 0 ? (
              <div className="card-replit p-10 text-center border border-border-subtle space-y-3">
                <Bot size={36} className="text-text-muted mx-auto" />
                <h3 className="text-sm font-bold text-text-main">No Interviews Found</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  No interviews match your search and filter criteria. Create a new interview or adjust filters.
                </p>
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(true)}
                  className="iw-btn-primary mx-auto"
                >
                  <Plus size={14} /> Create New Interview
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInterviews.map((item) => (
                  <div
                    key={item.id}
                    className="card-replit p-4 border border-border-subtle hover:border-replit-orange/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`iw-difficulty-pill ${item.difficulty.toLowerCase()}`}
                          style={{ fontSize: '10px' }}
                        >
                          {item.difficulty}
                        </span>
                        <span className="text-xs font-mono font-semibold text-text-muted bg-bg-surface px-2 py-0.5 rounded border border-border-subtle">
                          {item.role}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'COMPLETED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}
                        >
                          ● {item.status}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-text-main tracking-tight">
                        {item.title}
                      </h3>

                      <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <User size={13} />
                          <strong className="text-text-main">{item.candidateName}</strong> ({item.candidateEmail})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} />
                          {item.duration} Mins
                        </span>
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} />
                          {item.problems.length} Problem(s)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-start md:self-center">
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(item.token, e)}
                        className="iw-btn-secondary"
                        title="Copy Candidate Invitation Link"
                      >
                        {copiedToken === item.token ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        <span>{copiedToken === item.token ? 'Link Copied!' : 'Copy Invite Link'}</span>
                      </button>

                      <Link
                        href={`/interview/join/${item.token}`}
                        className="iw-btn-primary"
                        style={{ textDecoration: 'none' }}
                        title="Open candidate briefing view"
                      >
                        <span>Join / Proctor</span>
                        <ExternalLink size={13} />
                      </Link>

                      {item.status === 'COMPLETED' && (
                        <Link
                          href={`/interview/${item.id}/report`}
                          className="iw-btn-report"
                          style={{ textDecoration: 'none' }}
                          title="View Technical Evaluation Report"
                        >
                          <Award size={13} />
                          <span>View Report</span>
                        </Link>
                      )}

                      {item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => handleCancelInterview(item)}
                          className="iw-btn-secondary"
                          style={{ color: '#f87171' }}
                          title="Revoke / Cancel Interview Invitation"
                        >
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUESTION LIBRARY */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            <div className="card-replit p-4 border border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-main">CodeSync Question Library</h3>
                <p className="text-xs text-text-muted">
                  Pre-configured data structures and algorithms questions with starter templates in C++, Java, Python, JavaScript, and TypeScript.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                className="iw-btn-primary"
              >
                <Plus size={14} /> Add Problem to Interview
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {QUESTION_LIBRARY.map((prob) => (
                <div
                  key={prob.id}
                  className="card-replit p-4 border border-border-subtle hover:border-replit-orange/50 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-text-muted">{prob.category}</span>
                      <span className={`iw-difficulty-pill ${prob.difficulty.toLowerCase()}`}>
                        {prob.difficulty}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-text-main">{prob.title}</h4>
                    <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                      {prob.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
                    <span className="text-text-muted font-mono">
                      Target: <strong className="text-text-main">{prob.expectedTimeComplexity}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewProblem(prob)}
                      className="text-replit-orange font-bold hover:underline"
                    >
                      Inspect Problem &amp; Code Templates →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CANDIDATES & VERDICTS */}
        {activeTab === 'candidates' && (
          <div className="card-replit p-4 border border-border-subtle space-y-4">
            <h3 className="text-sm font-bold text-text-main">Candidate Assessment Directory</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-bg-surface text-text-muted font-mono uppercase">
                  <tr>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Interview Title</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Verdict</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {interviews.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-muted">
                        No candidates or evaluations recorded yet.
                      </td>
                    </tr>
                  ) : (
                    interviews.map((cand) => (
                    <tr key={cand.id} className="hover:bg-bg-surface/50">
                      <td className="p-3">
                        <strong className="text-text-main block">{cand.candidateName}</strong>
                        <span className="text-text-muted">{cand.candidateEmail}</span>
                      </td>
                      <td className="p-3">{cand.role}</td>
                      <td className="p-3 text-text-main font-semibold">{cand.title}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cand.status === 'COMPLETED'
                              ? 'bg-green-500/10 text-green-400'
                              : cand.status === 'ACTIVE'
                              ? 'bg-orange-500/10 text-orange-400'
                              : 'bg-text-muted/10 text-text-muted'
                          }`}
                        >
                          {cand.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-replit-orange">
                        {cand.submission?.score !== undefined ? `${cand.submission.score} / 100` : 'Pending'}
                      </td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {cand.submission?.verdict ? 'STRONG HIRE' : 'Awaiting Review'}
                      </td>
                      <td className="p-3">
                        {cand.status === 'COMPLETED' ? (
                          <Link
                            href={`/interview/${cand.id}/report`}
                            className="text-replit-orange font-bold hover:underline"
                          >
                            View Report
                          </Link>
                        ) : (
                          <Link
                            href={`/interview/join/${cand.token}`}
                            className="text-text-muted hover:text-text-main"
                          >
                            Join Session
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: HR EVALUATION REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="card-replit p-4 border border-border-subtle">
              <h3 className="text-sm font-bold text-text-main">Candidate Assessment Reports</h3>
              <p className="text-xs text-text-muted">
                Detailed algorithmic breakdown, test case validation, and communication reports generated after session completion.
              </p>
            </div>

            {interviews.filter((i) => i.status === 'COMPLETED' || i.submission).length === 0 ? (
              <div className="card-replit p-10 text-center border border-border-subtle space-y-3">
                <Award size={36} className="text-text-muted mx-auto" />
                <h3 className="text-sm font-bold text-text-main">No Evaluation Reports Yet</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  Completed candidate assessments and evaluation scorecards will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {interviews
                  .filter((i) => i.status === 'COMPLETED' || i.submission)
                  .map((rep) => (
                    <div
                      key={rep.id}
                      className="card-replit p-4 border border-border-subtle flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-emerald-400 font-bold uppercase tracking-wider">
                            ✓ {rep.submission?.verdict === 'ACCEPTED' ? 'Strong Hire' : 'Evaluated'}
                          </span>
                          <span className="text-text-muted font-mono">
                            {rep.submission?.runtimeMs !== undefined ? `${rep.submission.runtimeMs}ms` : '—'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-text-main">{rep.candidateName}</h4>
                        <p className="text-xs text-text-muted">{rep.role}</p>
                      </div>

                      <div className="p-3 rounded bg-bg-surface border border-border-subtle flex items-center justify-between">
                        <span className="text-xs text-text-muted">Final Score:</span>
                        <strong className="text-lg font-mono font-black text-replit-orange">
                          {rep.submission?.score !== undefined ? `${rep.submission.score} / 100` : 'Pending'}
                        </strong>
                      </div>

                      <Link
                        href={`/interview/${rep.id}/report`}
                        className="iw-btn-report"
                        style={{ justifyContent: 'center', textDecoration: 'none' }}
                      >
                        <Award size={14} />
                        <span>Open Full Evaluation Report</span>
                      </Link>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* CREATE INTERVIEW WIZARD MODAL */}
      <CreateInterviewWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onInterviewCreated={handleInterviewCreated}
      />

      {/* QUESTION PREVIEW MODAL */}
      {previewProblem && (
        <div className="modal-backdrop" onClick={() => setPreviewProblem(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '720px', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className={`iw-difficulty-pill ${previewProblem.difficulty.toLowerCase()}`}>
                  {previewProblem.difficulty}
                </span>
                <h3 className="text-lg font-bold text-text-main mt-1">{previewProblem.title}</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPreviewProblem(null)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-4 text-xs">
              <div>
                <strong className="text-text-muted block mb-1 uppercase font-mono">Description</strong>
                <p className="text-text-main leading-relaxed whitespace-pre-wrap">{previewProblem.description}</p>
              </div>

              <div>
                <strong className="text-text-muted block mb-1 uppercase font-mono">Constraints</strong>
                <ul className="list-disc pl-4 space-y-1 text-replit-orange font-mono">
                  {previewProblem.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="text-text-muted block mb-1 uppercase font-mono">C++ Starter Code</strong>
                <pre className="bg-bg-main p-3 rounded border border-border-subtle font-mono text-[11px] overflow-x-auto text-emerald-400">
                  {previewProblem.starterTemplates.cpp}
                </pre>
              </div>

              <div>
                <strong className="text-text-muted block mb-1 uppercase font-mono">Python 3 Starter Code</strong>
                <pre className="bg-bg-main p-3 rounded border border-border-subtle font-mono text-[11px] overflow-x-auto text-sky-400">
                  {previewProblem.starterTemplates.python}
                </pre>
              </div>

              <div>
                <strong className="text-text-muted block mb-1 uppercase font-mono">TypeScript Starter Code</strong>
                <pre className="bg-bg-main p-3 rounded border border-border-subtle font-mono text-[11px] overflow-x-auto text-amber-400">
                  {previewProblem.starterTemplates.typescript}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="iw-btn-primary wide"
                onClick={() => {
                  setPreviewProblem(null);
                  setIsWizardOpen(true);
                }}
              >
                Create Interview With This Problem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
