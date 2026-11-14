'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Code2,
  Bug,
  Zap,
  TestTube,
  MessageSquare,
  Copy,
  Check,
  Lock,
  User,
  Bot,
  X,
  CornerDownLeft,
} from 'lucide-react';
import { AiMessageDto, AiActionType } from '@codesync/shared';
import { Socket } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface AiAssistantPanelProps {
  roomId: string;
  language: string;
  role: 'OWNER' | 'PARTICIPANT' | 'VIEWER';
  codeGetter?: () => string;
  errorContextGetter?: () => string | null;
  socket?: Socket | null;
  onClose?: () => void;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  roomId,
  language,
  role,
  codeGetter,
  errorContextGetter,
  socket,
  onClose,
}) => {
  const [messages, setMessages] = useState<AiMessageDto[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [activeAction, setActiveAction] = useState<AiActionType>('CHAT');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isReadOnlyViewer = role === 'VIEWER';

  // Fetch initial AI conversation history for room
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/ai/history`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          setMessages(data.data);
        }
      } catch (_) {}
    };

    fetchHistory();
  }, [roomId]);

  // Listen for real-time room-scoped AI response events broadcast from backend
  useEffect(() => {
    if (!socket) return;

    const handleAiResponse = (data: AiMessageDto) => {
      if (data.roomId === roomId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
        setIsGenerating(false);
      }
    };

    socket.on('ai:response', handleAiResponse);
    return () => {
      socket.off('ai:response', handleAiResponse);
    };
  }, [socket, roomId]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendPrompt = useCallback(
    async (actionType: AiActionType = 'CHAT', customPrompt?: string) => {
      if (isGenerating || isReadOnlyViewer) return;

      try {
        setIsGenerating(true);
        setError(null);

        const currentPrompt = customPrompt !== undefined ? customPrompt : prompt;
        const code = codeGetter ? codeGetter() : '';
        const errorContext = errorContextGetter ? errorContextGetter() || undefined : undefined;

        const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/ai/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: actionType,
            prompt: currentPrompt,
            code,
            errorContext,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'AI request failed');
        }

        setPrompt('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to generate AI response');
        setIsGenerating(false);
      }
    },
    [roomId, isGenerating, isReadOnlyViewer, prompt, codeGetter, errorContextGetter]
  );

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) {
        handleSendPrompt('CHAT');
      }
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-bg-surface border-0 overflow-hidden text-xs">
      {/* AI Assistant Header */}
      <div className="px-4 py-3 border-b border-border-subtle bg-bg-surface flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-replit-orange/15 border border-replit-orange/30 text-replit-orange flex items-center justify-center font-bold shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg-surface ${
                isGenerating ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-text-main text-xs tracking-tight">CodeSync AI Assistant</h3>
              <span className="text-[10px] text-text-muted bg-bg-secondary px-1.5 py-0.2 rounded font-mono uppercase font-semibold border border-border-subtle">
                {language}
              </span>
            </div>
            <p className="text-[11px] text-text-muted">
              {isGenerating ? (
                <span className="text-replit-orange flex items-center gap-1 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating intelligent response...
                </span>
              ) : (
                'Your intelligent coding companion'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Ready
          </span>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-bg-secondary transition-colors"
              title="Close AI Assistant Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick AI Actions Toolbar */}
      <div className="px-3 py-2 border-b border-border-subtle bg-bg-secondary/50 flex flex-wrap gap-1.5 shrink-0">
        <button
          onClick={() => {
            setActiveAction('EXPLAIN');
            handleSendPrompt('EXPLAIN');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-all ${
            activeAction === 'EXPLAIN'
              ? 'bg-replit-orange text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-text-main hover:bg-bg-secondary border border-border-subtle'
          }`}
          title="Explain current code logic"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Explain Code</span>
        </button>

        <button
          onClick={() => {
            setActiveAction('DEBUG');
            handleSendPrompt('DEBUG');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-all ${
            activeAction === 'DEBUG'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-text-main hover:bg-bg-secondary border border-border-subtle'
          }`}
          title="Debug runtime or compilation error"
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Debug Error</span>
        </button>

        <button
          onClick={() => {
            setActiveAction('REFACTOR');
            handleSendPrompt('REFACTOR');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-all ${
            activeAction === 'REFACTOR'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-text-main hover:bg-bg-secondary border border-border-subtle'
          }`}
          title="Refactor for performance and readability"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Refactor Code</span>
        </button>

        <button
          onClick={() => {
            setActiveAction('TESTS');
            handleSendPrompt('TESTS');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-all ${
            activeAction === 'TESTS'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-text-main hover:bg-bg-secondary border border-border-subtle'
          }`}
          title="Generate comprehensive unit test suite"
        >
          <TestTube className="w-3.5 h-3.5" />
          <span>Generate Tests</span>
        </button>

        <button
          onClick={() => setActiveAction('CHAT')}
          className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-all ${
            activeAction === 'CHAT'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-text-main hover:bg-bg-secondary border border-border-subtle'
          }`}
          title="Custom interactive AI coding chat"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>AI Chat</span>
        </button>
      </div>

      {/* Messages Conversation Stream */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0 space-y-4 bg-bg-main/50 font-sans">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md text-xs font-mono">
            {error}
          </div>
        )}

        {messages.length === 0 && !isGenerating && (
          <div className="text-text-muted text-xs py-10 text-center space-y-3 select-none">
            <div className="w-12 h-12 rounded-2xl bg-replit-orange/10 border border-replit-orange/20 text-replit-orange flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-text-main text-sm">CodeSync AI Assistant Ready</p>
              <p className="max-w-xs mx-auto text-text-muted text-[11px] mt-1 leading-relaxed">
                Click any action above to evaluate your {language} code, or ask a question below.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-sm mx-auto pt-2">
              <button
                onClick={() => handleSendPrompt('EXPLAIN')}
                className="px-2.5 py-1 rounded bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-[11px] text-text-muted hover:text-text-main transition-colors"
              >
                💡 Explain Current Code
              </button>
              <button
                onClick={() => handleSendPrompt('TESTS')}
                className="px-2.5 py-1 rounded bg-bg-surface hover:bg-bg-secondary border border-border-subtle text-[11px] text-text-muted hover:text-text-main transition-colors"
              >
                🧪 Generate Unit Tests
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User Prompt Box */}
            <div className="flex items-start gap-2 justify-end">
              <div className="bg-bg-secondary border border-border-subtle p-3 rounded-lg max-w-[85%] text-xs shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-1 pb-1 border-b border-border-subtle/60">
                  <User className="w-3 h-3 text-replit-orange" />
                  <span className="font-semibold text-text-main">
                    {msg.userName} ({msg.userRole.toLowerCase()})
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words max-w-full text-text-main leading-relaxed font-sans">{msg.prompt}</p>
              </div>
            </div>

            {/* AI Response Box */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-md bg-replit-orange/15 border border-replit-orange/30 text-replit-orange flex items-center justify-center font-bold shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5" />
              </div>

              <div className="bg-bg-surface border border-border-subtle p-3.5 rounded-lg max-w-[92%] text-xs space-y-2.5 w-full shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-replit-orange">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>CodeSync AI ({msg.action})</span>
                  </div>

                  <button
                    onClick={() => handleCopyCode(msg.response, msg.id)}
                    className="p-1 text-text-muted hover:text-text-main rounded hover:bg-bg-secondary flex items-center gap-1 text-[10px] font-mono transition-colors"
                    title="Copy AI Response"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="whitespace-pre-wrap break-words max-w-full font-mono text-[11px] leading-relaxed text-text-main overflow-x-auto bg-bg-main/40 p-2.5 rounded border border-border-subtle/50">
                  {msg.response}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2.5 text-replit-orange text-xs py-2 bg-replit-orange/5 px-3 rounded-md border border-replit-orange/20">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="font-mono text-[11px]">AI Assistant is analyzing codebase and generating solution...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Controls */}
      <div className="p-3 border-t border-border-subtle bg-bg-surface shrink-0">
        {isReadOnlyViewer ? (
          <div className="w-full py-2.5 px-3 rounded-md bg-bg-secondary border border-border-subtle text-text-muted text-xs flex items-center justify-center gap-2 select-none font-mono">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Viewer Mode — AI prompting is restricted to Room Owner and Participants.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim() && !isGenerating) {
                handleSendPrompt('CHAT');
              }
            }}
            className="space-y-2"
          >
            <div className="relative flex items-center">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={`Ask CodeSync AI Assistant about your ${language} code...`}
                disabled={isGenerating}
                className="w-full bg-bg-main border border-border-subtle rounded-md px-3 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-replit-orange resize-none font-sans"
              />

              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="absolute right-2 bottom-2.5 btn-replit-primary p-1.5 rounded text-xs font-semibold shadow-sm"
                title="Send Prompt (Enter)"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-text-muted font-mono px-1">
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3 text-text-muted" />
                Press <kbd className="px-1 py-0.2 rounded bg-bg-secondary border border-border-subtle text-text-main">Enter</kbd> to send, <kbd className="px-1 py-0.2 rounded bg-bg-secondary border border-border-subtle text-text-main">Shift+Enter</kbd> for new line
              </span>
              <span>Rate limit: 10 / min</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
