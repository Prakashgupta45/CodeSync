'use client';

import React, { useState, useRef, useEffect } from 'react';
import { InterviewDto, InterviewActionType, RoomRole } from '@codesync/shared';
import {
  Sparkles,
  Send,
  Loader2,
  Lock,
  MessageSquare,
  User,
  Bot,
  Terminal,
  HelpCircle,
  Code2,
  AlertTriangle,
} from 'lucide-react';

interface AiInterviewerPanelProps {
  interview: InterviewDto | null;
  role: RoomRole;
  onSendMessage: (content: string, action?: InterviewActionType) => Promise<void>;
  isLoading: boolean;
}

export const AiInterviewerPanel: React.FC<AiInterviewerPanelProps> = ({
  interview,
  role,
  onSendMessage,
  isLoading,
}) => {
  const [inputContent, setInputContent] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<InterviewActionType>('ASK_APPROACH');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isViewer = role === 'VIEWER';
  const isCompleted = interview?.status === 'COMPLETED';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interview?.messages?.length, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || isLoading || isViewer || isCompleted) return;

    const msg = inputContent.trim();
    setInputContent('');
    await onSendMessage(msg, selectedAction);
  };

  if (!interview) {
    return (
      <div className="card-replit flex flex-col h-full bg-bg-surface border border-border-subtle rounded-lg p-6 items-center justify-center text-center text-text-muted space-y-3 font-mono">
        <Bot className="w-10 h-10 text-replit-orange/60" />
        <h3 className="text-sm font-bold text-white">AI Coding Interviewer Mode</h3>
        <p className="text-xs max-w-xs leading-relaxed">
          No interview session is active for this room. The room owner can initialize an interview session from the toolbar.
        </p>
      </div>
    );
  }

  return (
    <div className="card-replit flex flex-col h-full bg-bg-surface border border-border-subtle rounded-lg overflow-hidden shadow-lg select-none">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-border-subtle bg-bg-surface flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-replit-orange/10 border border-replit-orange/30 text-replit-orange">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">AI Coding Interviewer</h3>
            <p className="text-[10px] font-mono text-text-muted">Probing & Complexity Evaluation</p>
          </div>
        </div>

        {isViewer ? (
          <div className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold flex items-center gap-1">
            <Lock className="w-3 h-3" />
            VIEWER (Read Only)
          </div>
        ) : (
          <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
            {role}
          </div>
        )}
      </div>

      {/* Messages Scroll Body */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 font-mono text-xs">
        {/* Problem Statement Display */}
        {interview.problem && (
          <div className="p-3 rounded-lg bg-bg-secondary/70 border border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs">{interview.problem.title}</span>
              <span className="px-2 py-0.2 rounded bg-replit-orange/10 text-replit-orange border border-replit-orange/20 text-[10px]">
                {interview.problem.difficulty}
              </span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed whitespace-pre-line">
              {interview.problem.description}
            </p>
            {interview.problem.constraints && (
              <div className="pt-2 border-t border-border-subtle/50 text-[10px] text-text-muted/80">
                <span className="font-semibold text-white">Constraints:</span> {interview.problem.constraints}
              </div>
            )}
          </div>
        )}

        {/* Conversation Stream */}
        {interview.messages && interview.messages.length > 0 ? (
          interview.messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${
                m.senderType === 'CANDIDATE' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                  m.senderType === 'AI_INTERVIEWER'
                    ? 'bg-replit-orange/10 border-replit-orange/30 text-replit-orange'
                    : 'bg-bg-secondary border-border-subtle text-white'
                }`}
              >
                {m.senderType === 'AI_INTERVIEWER' ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>

              <div
                className={`max-w-[85%] rounded-lg p-3 space-y-1.5 border shadow-sm ${
                  m.senderType === 'AI_INTERVIEWER'
                    ? 'bg-bg-secondary/80 border-border-subtle text-text-main'
                    : 'bg-replit-orange/10 border-replit-orange/30 text-white'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted gap-2">
                  <span>{m.senderName || (m.senderType === 'AI_INTERVIEWER' ? 'AI Interviewer' : 'Candidate')}</span>
                  {m.action && (
                    <span className="px-1.5 py-0.2 rounded bg-bg-main border border-border-subtle text-replit-orange font-mono">
                      {m.action}
                    </span>
                  )}
                </div>
                <div className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-text-muted text-xs">
            Start the interview session to begin AI probing questions.
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-bg-secondary/50 border border-border-subtle/50 text-replit-orange text-xs font-mono">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>AI Interviewer is analyzing code & formulating question...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Candidate Response Controls & Input Form */}
      <div className="p-3 border-t border-border-subtle bg-bg-surface space-y-2">
        {/* Quick Action Chips */}
        {!isViewer && !isCompleted && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedAction('ASK_APPROACH')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                selectedAction === 'ASK_APPROACH'
                  ? 'bg-replit-orange text-white border-replit-orange'
                  : 'bg-bg-secondary text-text-muted hover:text-white border-border-subtle'
              }`}
            >
              <HelpCircle className="w-3 h-3 inline mr-1" />
              Explain Approach
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction('ASK_COMPLEXITY')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                selectedAction === 'ASK_COMPLEXITY'
                  ? 'bg-replit-orange text-white border-replit-orange'
                  : 'bg-bg-secondary text-text-muted hover:text-white border-border-subtle'
              }`}
            >
              <Code2 className="w-3 h-3 inline mr-1" />
              Time/Space Complexity
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction('ANALYZE_CODE')}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                selectedAction === 'ANALYZE_CODE'
                  ? 'bg-replit-orange text-white border-replit-orange'
                  : 'bg-bg-secondary text-text-muted hover:text-white border-border-subtle'
              }`}
            >
              <Terminal className="w-3 h-3 inline mr-1" />
              Analyze Code
            </button>
          </div>
        )}

        {/* Input Text Form */}
        {isViewer ? (
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono text-center flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            <span>VIEWER permissions active. Read-only interview mode.</span>
          </div>
        ) : isCompleted ? (
          <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono text-center">
            Interview session completed. Final AI evaluation report generated.
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              placeholder="Type your response to the AI Interviewer..."
              disabled={isLoading || interview.status !== 'IN_PROGRESS'}
              className="input-replit py-2 text-xs flex-1"
            />
            <button
              type="submit"
              disabled={!inputContent.trim() || isLoading || interview.status !== 'IN_PROGRESS'}
              className="btn-replit-primary px-3 py-2 text-xs"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
