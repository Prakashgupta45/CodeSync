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
    <div className="w-full shrink-0 flex flex-col bg-[#12141a] border border-border-subtle rounded-lg text-xs font-mono select-none shadow-lg my-2">
      {/* Console Header Bar */}
      <div className="px-4 py-2.5 border-b border-border-subtle bg-bg-secondary flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-bold text-white">
            <Terminal className="w-4 h-4 text-replit-orange" />
            <span>Output Console</span>
          </div>

          {/* Status Badge */}
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold">
              <Loader2 className="w-3 h-3 animate-spin" />
              Executing Code...
            </span>
          )}

          {result && !isRunning && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
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
              Executed by <strong className="text-white">{result.executedBy.name}</strong> ({result.executedBy.role.toLowerCase()})
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Expand / Collapse Toggle Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 px-2.5 rounded bg-bg-surface hover:bg-bg-secondary text-text-muted hover:text-white transition-colors flex items-center gap-1.5 text-[11px] font-semibold border border-border-subtle"
            title={isExpanded ? 'Collapse Console View' : 'Expand Console View'}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-replit-orange" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-replit-orange" />
                <span>Expand</span>
              </>
            )}
          </button>

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
              className="btn-replit-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-md font-semibold"
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

      {/* Scrollable Terminal Output Viewport */}
      <div
        className={`p-4 bg-[#0d0f14] overflow-y-auto overflow-x-auto font-mono text-xs space-y-3 transition-all duration-200 ${
          isExpanded ? 'h-[520px] min-h-[450px] max-h-[600px]' : 'h-[280px] min-h-[220px] max-h-[320px]'
        }`}
        style={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-xs leading-relaxed font-mono">
            <strong>[Execution Request Error]:</strong> {error}
          </div>
        )}

        {!isRunning && !result && !error && (
          <div className="text-text-muted text-xs py-12 text-center select-none space-y-1">
            <p>
              Click <span className="text-replit-orange font-semibold font-mono">Run Code</span> or press{' '}
              <kbd className="px-2 py-0.5 rounded bg-bg-secondary border border-border-subtle text-white text-[11px] shadow-sm">
                Ctrl + Enter
              </kbd>
            </p>
            <p className="text-[11px] text-text-muted opacity-80">
              Executes current program inside isolated Docker container. Output will synchronize across room.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-3 w-full">
            {/* Compilation Error Block */}
            {result.compileError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 font-mono text-xs leading-relaxed">
                <div className="font-bold text-red-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Compilation Error
                </div>
                <pre className="whitespace-pre-wrap break-words overflow-x-auto font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                  {result.compileError}
                </pre>
              </div>
            )}

            {/* Runtime Error Block */}
            {result.runtimeError && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded text-red-300 font-mono text-xs leading-relaxed">
                <div className="font-bold text-red-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Runtime Error
                </div>
                <pre className="whitespace-pre-wrap break-words overflow-x-auto font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                  {result.runtimeError}
                </pre>
              </div>
            )}

            {/* Standard Output (stdout) */}
            {result.stdout !== undefined && result.stdout !== null && result.stdout.length > 0 && (
              <div className="p-3 bg-[#11141d] border border-emerald-500/20 rounded text-emerald-300 font-mono text-xs leading-relaxed shadow-inner w-full">
                <div className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-semibold mb-1.5 select-none">
                  Standard Output (stdout)
                </div>
                <pre className="whitespace-pre-wrap break-words overflow-x-auto text-emerald-300 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                  {result.stdout}
                </pre>
              </div>
            )}

            {/* Empty Output Message */}
            {(!result.stdout || result.stdout.trim() === '') &&
              !result.stderr &&
              !result.compileError &&
              !result.runtimeError && (
                <div className="text-text-muted italic text-xs py-2">
                  (Program executed successfully with no output)
                </div>
              )}

            {/* Standard Error (stderr) */}
            {result.stderr && !result.compileError && !result.runtimeError && (
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded text-amber-300 font-mono text-xs leading-relaxed">
                <div className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold mb-1.5 select-none">
                  Standard Error (stderr)
                </div>
                <pre className="whitespace-pre-wrap break-words overflow-x-auto text-amber-300 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                  {result.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
