'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Loader2, Trash2, Terminal, AlertTriangle, CheckCircle2, Clock, Lock, User } from 'lucide-react';
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
    } catch (err: any) {
      setError(err.message || 'Execution request failed');
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
    <div className="card-replit flex flex-col w-full bg-[#12141a] border border-border-subtle overflow-hidden text-xs font-mono select-none">
      {/* Console Header Bar */}
      <div className="px-4 py-2 border-b border-border-subtle bg-bg-secondary flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Terminal className="w-4 h-4 text-replit-orange" />
            <span>Output Console</span>
          </div>

          {/* Status Badge */}
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Executing Code...
            </span>
          )}

          {result && !isRunning && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                result.timedOut
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : result.exitCode === 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {result.timedOut ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> Timed Out
                </>
              ) : result.exitCode === 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Exit: 0
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" /> Exit: {result.exitCode}
                </>
              )}
            </span>
          )}

          {result?.executionTimeMs !== undefined && (
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {result.executionTimeMs}ms
            </span>
          )}

          {result?.executedBy && (
            <span className="text-[11px] text-text-muted flex items-center gap-1 border-l border-border-subtle pl-2 font-mono">
              <User className="w-3 h-3 text-replit-orange" />
              Executed by {result.executedBy.name} ({result.executedBy.role.toLowerCase()})
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={() => setResult(null)}
              className="p-1.5 rounded text-text-muted hover:text-white hover:bg-bg-surface transition-colors"
              title="Clear Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {isReadOnlyViewer ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-bg-surface border border-border-subtle text-text-muted text-xs cursor-not-allowed">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Viewer Mode (Read-Only)
            </span>
          ) : (
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="btn-replit-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-md font-semibold"
            >
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isRunning ? 'Running...' : 'Run Code (Ctrl+Enter)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal View Body */}
      <div className="p-4 bg-[#0d0f14] min-h-[140px] max-h-[260px] overflow-y-auto font-mono text-xs space-y-2">
        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs">
            {error}
          </div>
        )}

        {!isRunning && !result && !error && (
          <div className="text-text-muted text-[11px] py-4 text-center select-none">
            Click <span className="text-replit-orange font-semibold font-mono">Run Code</span> or press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-bg-secondary border border-border-subtle text-white text-[10px]">
              Ctrl + Enter
            </kbd>{' '}
            to execute program inside isolated Docker container.
          </div>
        )}

        {result && (
          <div className="space-y-2">
            {result.compileError && (
              <div className="text-red-400 whitespace-pre-wrap font-mono text-xs">
                <span className="font-bold text-red-400 block mb-1">[Compilation Error]:</span>
                {result.compileError}
              </div>
            )}

            {result.runtimeError && (
              <div className="text-red-400 whitespace-pre-wrap font-mono text-xs">
                <span className="font-bold text-red-400 block mb-1">[Runtime Error]:</span>
                {result.runtimeError}
              </div>
            )}

            {result.stdout !== undefined && result.stdout !== null && result.stdout.length > 0 && (
              <div className="text-emerald-300 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {result.stdout}
              </div>
            )}

            {(!result.stdout || result.stdout.trim() === '') && !result.stderr && !result.compileError && !result.runtimeError && (
              <div className="text-text-muted italic text-[11px]">
                (Program executed with no output)
              </div>
            )}

            {result.stderr && !result.compileError && !result.runtimeError && (
              <div className="text-amber-400 whitespace-pre-wrap font-mono text-xs">
                {result.stderr}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
