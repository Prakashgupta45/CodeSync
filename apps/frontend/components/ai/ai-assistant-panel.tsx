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
  ChevronRight,
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
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  roomId,
  language,
  role,
  codeGetter,
  errorContextGetter,
  socket,
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
  }, [messages]);

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
      } catch (err: any) {
        setError(err.message || 'Failed to generate AI response');
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

  return (
    <div className="card-replit flex flex-col w-full h-full min-h-[500px] bg-[#12141a] border border-border-subtle overflow-hidden text-xs font-mono select-none">
      {/* AI Panel Header */}
      <div className="px-4 py-2.5 border-b border-border-subtle bg-bg-secondary flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-white">
          <Sparkles className="w-4 h-4 text-replit-orange animate-pulse" />
          <span>AI Pair Programmer</span>
          <span className="text-[10px] text-replit-orange bg-replit-orange/10 px-1.5 py-0.5 rounded uppercase font-semibold border border-replit-orange/20">
            {language}
          </span>
        </div>
      </div>

      {/* Quick AI Action Toolbar */}
      <div className="p-2 border-b border-border-subtle bg-[#161922] grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        <button
          onClick={() => {
            setActiveAction('EXPLAIN');
            handleSendPrompt('EXPLAIN');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 text-[11px] font-medium transition-all ${
            activeAction === 'EXPLAIN'
              ? 'bg-replit-orange text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-white hover:bg-bg-secondary'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Explain</span>
        </button>

        <button
          onClick={() => {
            setActiveAction('DEBUG');
            handleSendPrompt('DEBUG');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 text-[11px] font-medium transition-all ${
            activeAction === 'DEBUG'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-white hover:bg-bg-secondary'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Debug</span>
        </button>

        <button
          onClick={() => {
            setActiveAction('REFACTOR');
            handleSendPrompt('REFACTOR');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 text-[11px] font-medium transition-all ${
            activeAction === 'REFACTOR'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-white hover:bg-bg-secondary'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Refactor</span>
        </button>

        <button
          onClick={() => {
            setActiveAction('TESTS');
            handleSendPrompt('TESTS');
          }}
          disabled={isGenerating || isReadOnlyViewer}
          className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 text-[11px] font-medium transition-all ${
            activeAction === 'TESTS'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-white hover:bg-bg-secondary'
          }`}
        >
          <TestTube className="w-3.5 h-3.5" />
          <span>Tests</span>
        </button>

        <button
          onClick={() => setActiveAction('CHAT')}
          className={`px-2 py-1.5 rounded flex items-center justify-center gap-1 text-[11px] font-medium transition-all col-span-2 sm:col-span-1 ${
            activeAction === 'CHAT'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-bg-surface text-text-muted hover:text-white hover:bg-bg-secondary'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
      </div>

      {/* Messages Conversation Stream */}
      <div className="flex-1 p-4 bg-[#0d0f14] overflow-y-auto space-y-4 max-h-[380px]">
        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs">
            {error}
          </div>
        )}

        {messages.length === 0 && !isGenerating && (
          <div className="text-text-muted text-[11px] py-8 text-center space-y-2 select-none">
            <Bot className="w-8 h-8 mx-auto text-replit-orange opacity-70" />
            <p className="font-semibold text-white">CodeSync AI Pair Programmer</p>
            <p className="max-w-xs mx-auto text-text-muted text-[10px] leading-relaxed">
              Ask coding questions, click <span className="text-replit-orange">Explain</span>, or generate unit tests for your {language} code.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User Prompt Box */}
            <div className="flex items-start gap-2 justify-end">
              <div className="bg-bg-secondary border border-border-subtle p-2.5 rounded-lg max-w-[85%] text-xs text-white">
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-1 pb-1 border-b border-border-subtle">
                  <User className="w-3 h-3 text-replit-orange" />
                  <span className="font-semibold text-white">Prompted by {msg.userName} ({msg.userRole.toLowerCase()})</span>
                </div>
                <p className="whitespace-pre-wrap">{msg.prompt}</p>
              </div>
            </div>

            {/* AI Response Box */}
            <div className="flex items-start gap-2">
              <div className="bg-[#161922] border border-border-subtle p-3 rounded-lg max-w-[95%] text-xs text-text-main space-y-2 w-full">
                <div className="flex items-center justify-between pb-1.5 border-b border-border-subtle text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-replit-orange">
                    <Bot className="w-3.5 h-3.5" />
                    <span>AI Assistant ({msg.action})</span>
                  </div>

                  <button
                    onClick={() => handleCopyCode(msg.response, msg.id)}
                    className="p-1 text-text-muted hover:text-white rounded hover:bg-bg-surface flex items-center gap-1 text-[10px]"
                    title="Copy Response"
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

                <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-200">
                  {msg.response}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 text-replit-orange text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI is analyzing codebase and generating solution...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Controls */}
      <div className="p-3 border-t border-border-subtle bg-bg-secondary flex gap-2">
        {isReadOnlyViewer ? (
          <div className="w-full py-2 px-3 rounded bg-bg-surface border border-border-subtle text-text-muted text-xs flex items-center justify-center gap-1.5 select-none">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Viewer Mode (AI Prompting Disabled)
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt('CHAT');
            }}
            className="flex w-full gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Ask AI pair programmer about your ${language} code...`}
              disabled={isGenerating}
              className="flex-1 bg-[#0d0f14] border border-border-subtle rounded px-3 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-replit-orange font-mono"
            />

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="btn-replit-primary py-2 px-3.5 flex items-center gap-1 text-xs font-semibold shadow-md"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
