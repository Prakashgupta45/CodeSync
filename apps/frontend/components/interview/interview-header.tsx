'use client';

import React, { useState, useEffect } from 'react';
import { InterviewDto, RoomRole } from '@codesync/shared';
import { Sparkles, Play, CheckCircle2, Clock, Award, Terminal } from 'lucide-react';

interface InterviewHeaderProps {
  interview: InterviewDto | null;
  role: RoomRole;
  onOpenLobby: () => void;
  onStartInterview: () => void;
  onCompleteInterview: () => void;
  onOpenReport: () => void;
}

export const InterviewHeader: React.FC<InterviewHeaderProps> = ({
  interview,
  role,
  onOpenLobby,
  onStartInterview,
  onCompleteInterview,
  onOpenReport,
}) => {
  const isOwner = role === 'OWNER';
  const isViewer = role === 'VIEWER';

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!interview || interview.status !== 'IN_PROGRESS' || !interview.startedAt) return;

    const start = new Date(interview.startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [interview?.status, interview?.startedAt]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!interview) {
    return (
      <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <Sparkles className="w-4 h-4 text-replit-orange" />
          <span>AI Coding Interviewer Mode: Inactive</span>
        </div>
        {isOwner && (
          <button onClick={onOpenLobby} className="btn-replit-primary text-xs py-1 px-3">
            <Sparkles className="w-3.5 h-3.5" />
            Initialize Interview Session
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border-b border-border-subtle px-4 py-2 flex flex-wrap items-center justify-between gap-3">
      {/* Title & Status Badges */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded bg-replit-orange/10 border border-replit-orange/30 text-replit-orange">
          <Terminal className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-tight">{interview.title}</span>
            {interview.problem && (
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${
                  interview.problem.difficulty === 'EASY'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : interview.problem.difficulty === 'MEDIUM'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {interview.problem.difficulty}
              </span>
            )}
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${
                interview.status === 'IN_PROGRESS'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                  : interview.status === 'COMPLETED'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {interview.status}
            </span>
          </div>
          {interview.candidateName && (
            <div className="text-[11px] font-mono text-text-muted mt-0.5">
              Candidate: <span className="text-white font-medium">{interview.candidateName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Timer & Controls */}
      <div className="flex items-center gap-3">
        {interview.status === 'IN_PROGRESS' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-bg-secondary border border-border-subtle text-xs font-mono text-emerald-400 font-semibold">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{formatTimer(elapsedSeconds)} / {interview.duration}m</span>
          </div>
        )}

        {/* OWNER Controls */}
        {isOwner && interview.status === 'READY' && (
          <button onClick={onStartInterview} className="btn-replit-primary text-xs py-1 px-3">
            <Play className="w-3.5 h-3.5" />
            Start Interview
          </button>
        )}

        {interview.status === 'IN_PROGRESS' && !isViewer && (
          <button onClick={onCompleteInterview} className="btn-replit-secondary text-xs py-1 px-3 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Submit Solution & End
          </button>
        )}

        {interview.status === 'COMPLETED' && (
          <button onClick={onOpenReport} className="btn-replit-primary text-xs py-1 px-3">
            <Award className="w-3.5 h-3.5" />
            View AI Evaluation Report
          </button>
        )}
      </div>
    </div>
  );
};
