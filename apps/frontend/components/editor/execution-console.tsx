'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Loader2,
  Trash2,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  User,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
} from 'lucide-react';
import { RoomExecutionResultDto } from '@codesync/shared';
import { Socket } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface ExecutionConsoleProps {
  roomId: string;
  language: string;
  role: 'OWNER' | 'PARTICIPANT' | 'VIEWER';
  codeGetter?: () => string;
  socket?: Socket | null;
}

export const ExecutionConsole: React.FC<ExecutionConsoleProps> = ({
  roomId,
  language,
  role,
  codeGetter,
  socket,
}) => {
  const [result, setResult] = useState<RoomExecutionResultDto | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'output' | 'docker' | 'problems'>('output');

  const isReadOnlyViewer = role === 'VIEWER';

  // Listen for real-time room-scoped execution results broadcast from backend
  useEffect(() => {
    if (!socket) return;

    const handleExecutionResult = (data: RoomExecutionResultDto) => {
      if (data.roomId === roomId) {
        setResult(data);
        setIsRunning(false);
      }
    };

    socket.on('execution:result', handleExecutionResult);
    return () => {
      socket.off('execution:result', handleExecutionResult);
    };
  }, [socket, roomId]);

  const handleRunCode = useCallback(async () => {
    if (isRunning || isReadOnlyViewer) return;

    try {
      setIsRunning(true);
      setError(null);
      setIsMinimized(false);

      const code = codeGetter ? codeGetter() : '';

      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language, code }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Code execution failed');
      }

      setResult(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Execution request failed');
    } finally {
      setIsRunning(false);
    }
  }, [roomId, language, isRunning, isReadOnlyViewer, codeGetter]);

  // Handle Ctrl+Enter / Cmd+Enter keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunCode]);

  return (
    <div className="w-full shrink-0 flex flex-col card-replit overflow-hidden border border-border-subtle rounded-lg text-xs font-mono select-none shadow-md mt-2">
      {/* Console Header Bar */}
      <div className="px-3.5 py-1.5 border-b border-border-subtle bg-bg-surface flex items-center justify-between gap-2 shrink-0">
        {/* Left: Console Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setActiveTab('output');
              setIsMinimized(false);
            }}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              activeTab === 'output' && !isMinimized
                ? 'bg-bg-secondary text-replit-orange font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('docker');
              setIsMinimized(false);
            }}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              activeTab === 'docker' && !isMinimized
                ? 'bg-bg-secondary text-replit-orange font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Container</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('problems');
              setIsMinimized(false);
            }}
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              activeTab === 'problems' && !isMinimized
                ? 'bg-bg-secondary text-replit-orange font-bold'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Problems</span>
          </button>

          {/* Running State Badge */}
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold ml-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running in Docker Sandbox...
            </span>
          )}

          {/* Result Badge */}
          {result && !isRunning && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ml-2 ${
                result.timedOut
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : result.exitCode === 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}
            >
              {result.timedOut ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> Timed Out
                </>
              ) : result.exitCode === 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Exit Code: 0
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" /> Exit Code: {result.exitCode}
                </>
              )}
            </span>
          )}

          {result?.executionTimeMs !== undefined && (
            <span className="text-[10px] text-text-muted flex items-center gap-1 font-mono ml-2">
              <Clock className="w-3 h-3" />
              {result.executionTimeMs}ms
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={() => setResult(null)}
              className="p-1 rounded text-text-muted hover:text-text-main hover:bg-bg-secondary transition-colors"
              title="Clear Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-text-muted hover:text-text-main hover:bg-bg-secondary transition-colors hidden sm:inline-flex"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-text-muted hover:text-text-main hover:bg-bg-secondary transition-colors"
            title={isMinimized ? 'Show Console' : 'Minimize Console'}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Run Code Button */}
          {isReadOnlyViewer ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-bg-secondary border border-border-subtle text-text-muted text-[11px] cursor-not-allowed">
              <Lock className="w-3 h-3 text-amber-400" />
              Read-Only
            </span>
          ) : (
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="btn-replit-primary text-[11px] py-1 px-3 shadow-sm flex items-center gap-1.5"
              title="Run Code in Isolated Docker Sandbox (Ctrl+Enter)"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run (Ctrl+Enter)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Console Output Body */}
      {!isMinimized && (
        <div
          className={`bg-[#0d0f14] p-3 font-mono text-xs overflow-y-auto select-text transition-all ${
            isExpanded ? 'h-64' : 'h-32'
          }`}
        >
          {activeTab === 'output' && (
            <>
              {error && (
                <div className="text-red-400 font-semibold mb-2">
                  [Execution System Error]: {error}
                </div>
              )}

              {result ? (
                <div className="space-y-1">
                  {result.compileError && (
                    <div className="text-red-400 whitespace-pre-wrap">
                      <span className="font-bold underline">[Compilation Error]:</span>
                      {'\n'}
                      {result.compileError}
                    </div>
                  )}

                  {result.runtimeError && (
                    <div className="text-amber-400 whitespace-pre-wrap">
                      <span className="font-bold underline">[Runtime Error]:</span>
                      {'\n'}
                      {result.runtimeError}
                    </div>
                  )}

                  {result.stderr && !result.compileError && !result.runtimeError && (
                    <div className="text-red-300 whitespace-pre-wrap">{result.stderr}</div>
                  )}

                  {result.stdout ? (
                    <div className="text-[#e6edf3] whitespace-pre-wrap">{result.stdout}</div>
                  ) : !result.stderr && !result.compileError && !result.runtimeError ? (
                    <div className="text-text-muted italic">[Program executed successfully with no stdout output]</div>
                  ) : null}

                  {result.timedOut && (
                    <div className="text-amber-400 font-bold pt-1 border-t border-border-subtle/40">
                      [Process Terminated]: Exceeded max execution limit of 10 seconds.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-text-muted flex items-center gap-2 select-none h-full">
                  <span>Press</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-secondary border border-border-subtle text-[10px] text-text-main font-mono shadow-sm">
                    Ctrl + Enter
                  </kbd>
                  <span>or click &quot;Run&quot; to execute in an isolated Docker container.</span>
                </div>
              )}
            </>
          )}

          {activeTab === 'docker' && (
            <div className="space-y-2 text-text-muted">
              <div className="flex justify-between border-b border-border-subtle/50 pb-1">
                <span>Target Language Runtime:</span>
                <span className="text-text-main font-bold uppercase">{language}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle/50 pb-1">
                <span>Docker Sandbox Isolation:</span>
                <span className="text-emerald-400 font-semibold">Active & Hardened</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle/50 pb-1">
                <span>CPU Execution Limit:</span>
                <span className="text-text-main">1.0 vCPU</span>
              </div>
              <div className="flex justify-between">
                <span>Memory Allocation Limit:</span>
                <span className="text-text-main">256MB RAM</span>
              </div>
            </div>
          )}

          {activeTab === 'problems' && (
            <div className="space-y-1.5">
              {result?.compileError || result?.runtimeError ? (
                <div className="text-red-400">
                  <span className="font-bold">Error detected during execution:</span>
                  <p className="text-xs text-text-muted mt-1 whitespace-pre-wrap">
                    {result.compileError || result.runtimeError}
                  </p>
                </div>
              ) : (
                <div className="text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>No syntax or runtime issues reported.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
