'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppNavbar } from '../../../../components/ui/navbar';
import {
  getInterviewById,
  getInterviewByToken,
  fetchInterviewByTokenAsync,
  InterviewItem,
} from '../../../../lib/interview-service';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Bot,
  Code2,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export default function InterviewReportPage() {
  const params = useParams();
  const interviewId = (params?.interviewId as string) || '';

  const [interview, setInterview] = useState<InterviewItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let item = await fetchInterviewByTokenAsync(interviewId);
      if (!item) {
        item = getInterviewById(interviewId) || getInterviewByToken(interviewId);
      }
      if (active) {
        setInterview(item || null);
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [interviewId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col font-sans">
        <AppNavbar activeTab="/interview" />
        <main className="flex-1 flex items-center justify-center text-text-muted gap-2 text-xs font-mono">
          <Loader2 className="w-5 h-5 animate-spin text-replit-orange" />
          Loading interview evaluation report...
        </main>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col font-sans">
        <AppNavbar activeTab="/interview" />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-16 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold">Interview Report Not Found</h1>
          <p className="text-xs text-text-muted">
            No interview record matched ID &quot;{interviewId}&quot;.
          </p>
          <Link href="/interview" className="btn-replit-primary inline-flex px-4 py-2 text-xs">
            Back to Interview Portal
          </Link>
        </main>
      </div>
    );
  }

  const sub = interview.submission;
  const score = sub ? sub.score : 0;
  const verdict = !sub
    ? 'PENDING SUBMISSION'
    : score >= 85
    ? 'STRONG HIRE'
    : score >= 65
    ? 'HIRE'
    : score >= 40
    ? 'BORDERLINE'
    : 'NO HIRE';

  const problemTitle = interview.problems?.[0]?.title || 'Assigned Problem';
  const expectedTime = interview.problems?.[0]?.expectedTimeComplexity || 'Not Specified';
  const expectedSpace = interview.problems?.[0]?.expectedSpaceComplexity || 'Not Specified';
  const candidateName = interview.candidateName || 'Candidate';
  const role = interview.role || 'Software Engineer';

  const visibleSummary = sub ? `${sub.visiblePassed} / ${sub.visibleTotal} visible` : '0 / 0 submitted';
  const hiddenSummary = sub ? `${sub.hiddenPassed} / ${sub.hiddenTotal} hidden` : '0 / 0 submitted';

  const scoreBreakdown = sub
    ? [
        {
          category: 'Test Suite Correctness',
          score: sub.score,
          desc: `Passed ${visibleSummary} and ${hiddenSummary} test assertions.`,
        },
        {
          category: 'Visible Test Coverage',
          score: sub.visibleTotal > 0 ? Math.round((sub.visiblePassed / sub.visibleTotal) * 100) : 0,
          desc: `${sub.visiblePassed} of ${sub.visibleTotal} visible sample cases passed.`,
        },
        {
          category: 'Hidden Edge-Case Coverage',
          score: sub.hiddenTotal > 0 ? Math.round((sub.hiddenPassed / sub.hiddenTotal) * 100) : sub.score,
          desc: `${sub.hiddenPassed} of ${sub.hiddenTotal} confidential hidden test cases passed.`,
        },
        {
          category: 'Code Execution & Stability',
          score: sub.verdict === 'ACCEPTED' ? 100 : sub.verdict === 'WRONG_ANSWER' ? 50 : 15,
          desc: `Final Docker execution status: ${sub.verdict} (${sub.runtimeMs} ms avg).`,
        },
      ]
    : [];

  const strengths: string[] = [];
  if (sub && sub.visiblePassed > 0) {
    strengths.push(`Passed ${sub.visiblePassed}/${sub.visibleTotal} visible test cases in ${sub.language.toUpperCase()}.`);
  }
  if (sub && sub.hiddenPassed > 0) {
    strengths.push(`Passed ${sub.hiddenPassed}/${sub.hiddenTotal} confidential hidden edge test cases.`);
  }
  if (sub && sub.verdict === 'ACCEPTED') {
    strengths.push(`Clean Docker execution with average runtime ${sub.runtimeMs} ms.`);
  }
  if (strengths.length === 0) {
    strengths.push(sub ? 'No test cases passed in the submitted code.' : 'Candidate has not submitted a solution yet.');
  }

  const improvements: string[] = [];
  if (!sub) {
    improvements.push('No submission recorded for this interview.');
  } else {
    if (sub.visiblePassed < sub.visibleTotal) {
      improvements.push(`Resolve failing visible test cases (${sub.visibleTotal - sub.visiblePassed} failing).`);
    }
    if (sub.hiddenPassed < sub.hiddenTotal) {
      improvements.push(`Improve edge-case and boundary handling (${sub.hiddenTotal - sub.hiddenPassed} hidden tests failed).`);
    }
    if (sub.verdict === 'RUNTIME_ERROR') {
      improvements.push('Address compilation errors, runtime exceptions, or timeout limits before submitting.');
    }
    if (improvements.length === 0) {
      improvements.push(`Verify optimal ${expectedTime} time and ${expectedSpace} space scaling on larger bounds.`);
    }
  }

  const evaluatorSummary = !sub
    ? `Assessment for ${candidateName} (${role}) on "${problemTitle}" currently has status ${interview.status} with no submitted test run recorded.`
    : `Candidate ${candidateName} (${role}) submitted a ${sub.language.toUpperCase()} solution for "${problemTitle}" with verdict ${sub.verdict}, scoring ${score}/100 (${visibleSummary}, ${hiddenSummary}).`;

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col font-sans">
      <AppNavbar activeTab="/interview" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="card-replit p-6 sm:p-8 border border-border-subtle bg-gradient-to-r from-bg-surface via-bg-surface to-bg-secondary flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Assessment Status: {interview.status}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
              Technical Interview Evaluation
            </h1>
            <p className="text-xs text-text-muted font-mono">
              Candidate: <span className="text-text-main font-semibold">{candidateName}</span> ({role}) • Problem:{' '}
              <span className="text-text-main font-semibold">{problemTitle}</span> •{' '}
              {sub ? `Runtime: ${sub.runtimeMs} ms (${sub.language.toUpperCase()})` : `Duration: ${interview.duration} mins`}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-bg-secondary border border-border-subtle shadow-md min-w-[140px]">
            <span className="text-3xl font-black font-mono text-replit-orange">
              {score}
              <span className="text-xs text-text-muted font-normal">/100</span>
            </span>
            <span
              className={`text-[11px] font-mono font-bold uppercase tracking-wider mt-0.5 ${
                score >= 65 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {verdict}
            </span>
          </div>
        </div>

        {scoreBreakdown.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-text-muted">
              Evaluation Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {scoreBreakdown.map((item, idx) => (
                <div key={idx} className="card-replit p-4 border border-border-subtle space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-text-main">{item.category}</h3>
                    <span className="text-xs font-mono font-bold text-replit-orange">{item.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-replit-orange rounded-full transition-all"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted font-sans">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card-replit p-5 border border-border-subtle space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-text-main flex items-center gap-2">
            <Code2 className="w-4 h-4 text-replit-orange" />
            Target Complexity &amp; Docker Test Results
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-bg-secondary border border-border-subtle">
              <span className="text-text-muted block text-[11px]">Expected Time Target</span>
              <span className="text-text-main font-bold text-sm">{expectedTime}</span>
            </div>
            <div className="p-3 rounded-lg bg-bg-secondary border border-border-subtle">
              <span className="text-text-muted block text-[11px]">Expected Space Target</span>
              <span className="text-text-main font-bold text-sm">{expectedSpace}</span>
            </div>
            <div className="p-3 rounded-lg bg-bg-secondary border border-border-subtle">
              <span className="text-text-muted block text-[11px]">Docker Test Suite</span>
              <span className="text-emerald-400 font-bold text-sm">
                {visibleSummary}, {hiddenSummary}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-replit p-5 border border-border-subtle space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Observed Strengths
            </h3>
            <ul className="space-y-2 text-xs text-text-muted">
              {strengths.map((str, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-replit p-5 border border-border-subtle space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Areas for Improvement
            </h3>
            <ul className="space-y-2 text-xs text-text-muted">
              {improvements.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {sub?.submittedCode && (
          <div className="card-replit p-5 border border-border-subtle space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-text-main">
              Submitted Solution ({sub.language.toUpperCase()})
            </h3>
            <pre className="p-3 rounded-lg bg-bg-secondary border border-border-subtle text-xs font-mono overflow-x-auto text-text-main">
              {sub.submittedCode}
            </pre>
          </div>
        )}

        <div className="card-replit p-6 border border-border-subtle bg-bg-surface space-y-3">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
            <Bot className="w-4 h-4 text-replit-orange" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-text-main">
              Evaluator Summary
            </h3>
          </div>
          <p className="text-xs text-text-muted leading-relaxed font-sans">{evaluatorSummary}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border-subtle">
          <Link
            href="/interview"
            className="btn-replit-secondary text-xs px-4 py-2 flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Back to Interviews</span>
          </Link>

          <Link
            href="/dashboard"
            className="btn-replit-primary text-xs px-5 py-2 flex items-center gap-2"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
