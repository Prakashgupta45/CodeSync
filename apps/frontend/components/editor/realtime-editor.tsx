'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { RoomPresenceUserDto } from '@codesync/shared';
import { Wifi, WifiOff, Loader2, Lock, Sparkles } from 'lucide-react';

const API_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

interface RealtimeEditorProps {
  roomId: string;
  language: string;
  role: 'OWNER' | 'PARTICIPANT' | 'VIEWER';
  user: {
    id: string;
    name: string;
  };
  onSocketInit?: (socket: Socket) => void;
  onPresenceUpdate?: (users: RoomPresenceUserDto[]) => void;
}

export const RealtimeEditor: React.FC<RealtimeEditorProps> = ({
  roomId,
  language,
  role,
  user,
  onSocketInit,
  onPresenceUpdate,
}) => {
  const editorRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const isInternalChange = useRef<boolean>(false);

  const isReadOnly = role === 'VIEWER';
  const isReadOnlyRef = useRef<boolean>(isReadOnly);

  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamically update Monaco options & ref whenever role/isReadOnly changes
  useEffect(() => {
    isReadOnlyRef.current = isReadOnly;
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isReadOnly });
    }
  }, [isReadOnly]);

  // Map room language string to Monaco editor language identifier
  const getMonacoLanguage = (lang: string): string => {
    const l = (lang || '').toLowerCase();
    switch (l) {
      case 'python':
        return 'python';
      case 'cpp':
      case 'c++':
        return 'cpp';
      case 'java':
        return 'java';
      case 'typescript':
      case 'ts':
        return 'typescript';
      case 'javascript':
      case 'js':
      default:
        return 'javascript';
    }
  };

  const handleEditorDidMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;

      // Initialize Monaco Editor Options with current isReadOnly state
      editor.updateOptions({
        theme: 'vs-dark',
        readOnly: isReadOnlyRef.current,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",
        minimap: { enabled: false },
        lineNumbers: 'on',
        roundedSelection: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
      });

      // 1. Initialize Yjs CRDT Document
      const doc = new Y.Doc();
      docRef.current = doc;
      const yText = doc.getText('codemirror');

      // 2. Connect to Backend Socket.IO Server
      const socket = io(API_SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;
      if (onSocketInit) {
        onSocketInit(socket);
      }

      socket.on('connect', () => {
        setConnectionStatus('connecting');
        socket.emit('collaboration:join', { roomId });
      });

      socket.on('collaboration:sync', (data: { state: number[]; content?: string; role?: string }) => {
        setConnectionStatus('connected');
        setErrorMessage(null);

        // Dynamic check if server returns VIEWER role
        if (data.role === 'VIEWER') {
          isReadOnlyRef.current = true;
          editor.updateOptions({ readOnly: true });
        }

        if (data.state && data.state.length > 0) {
          Y.applyUpdate(doc, new Uint8Array(data.state), 'initial-sync');
        }

        const initialCode = yText.toString();
        isInternalChange.current = true;
        editor.setValue(initialCode);
        isInternalChange.current = false;
      });

      // Listen to presence updates
      socket.on('presence:update', (data: { roomId: string; users: RoomPresenceUserDto[] }) => {
        if (data.roomId === roomId && onPresenceUpdate) {
          onPresenceUpdate(data.users);
        }
      });

      // Handle CRDT updates from other clients (VIEWER still receives & renders these live)
      socket.on('collaboration:update', (data: { update: number[]; userId: string }) => {
        if (data.update && data.userId !== user.id) {
          Y.applyUpdate(doc, new Uint8Array(data.update), 'remote');
        }
      });

      socket.on('collaboration:error', (data: { message: string }) => {
        setErrorMessage(data.message || 'Collaboration error');
        setConnectionStatus('error');
      });

      socket.on('disconnect', () => {
        setConnectionStatus('disconnected');
      });

      socket.on('connect_error', () => {
        setConnectionStatus('disconnected');
      });

      // Sync Y.Text modifications -> Monaco Editor View (Applies for all roles including VIEWER)
      yText.observe((event) => {
        if (event.transaction.origin === 'remote' || event.transaction.origin === 'initial-sync') {
          const updatedContent = yText.toString();
          const currentVal = editor.getValue();
          if (updatedContent !== currentVal) {
            isInternalChange.current = true;
            const position = editor.getPosition();
            editor.setValue(updatedContent);
            if (position) editor.setPosition(position);
            isInternalChange.current = false;
          }
        }
      });

      // Transmit Monaco changes -> Yjs CRDT Document -> Socket.IO Server (STRICTLY BLOCKED FOR VIEWER)
      editor.onDidChangeModelContent(() => {
        if (isInternalChange.current || isReadOnlyRef.current) return;

        const newText = editor.getValue();
        if (newText !== yText.toString()) {
          doc.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, newText);
          }, 'local');
        }
      });

      // Broadcast Yjs updates to Socket.IO server (STRICTLY BLOCKED FOR VIEWER)
      doc.on('update', (update: Uint8Array, origin: any) => {
        if (origin !== 'remote' && origin !== 'initial-sync' && !isReadOnlyRef.current) {
          socket.emit('collaboration:update', {
            roomId,
            update: Array.from(update),
          });
        }
      });
    },
    [roomId, user.id, onSocketInit, onPresenceUpdate]
  );

  useEffect(() => {
    return () => {
      if (docRef.current) {
        docRef.current.destroy();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-[500px] card-replit overflow-hidden">
      {/* Editor Header Toolbar */}
      <div className="px-4 py-2 border-b border-border-subtle bg-bg-secondary/60 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-t bg-bg-surface text-white border-t border-x border-border-subtle flex items-center gap-1.5 font-bold">
            <div className="w-2 h-2 rounded-full bg-replit-orange" />
            main.
            {getMonacoLanguage(language) === 'cpp'
              ? 'cpp'
              : getMonacoLanguage(language) === 'python'
              ? 'py'
              : getMonacoLanguage(language) === 'java'
              ? 'java'
              : getMonacoLanguage(language) === 'typescript'
              ? 'ts'
              : 'js'}
          </span>

          {isReadOnly && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
              <Lock className="w-3 h-3" />
              Read Only (Viewer Mode)
            </span>
          )}
        </div>

        {/* Real-time Socket.IO Connection Status */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">Connected (CRDT Active)</span>
            </div>
          )}

          {connectionStatus === 'connecting' && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Syncing Yjs Doc...</span>
            </div>
          )}

          {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
              <WifiOff className="w-3.5 h-3.5" />
              <span>{errorMessage || 'Disconnected'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Monaco Editor React Container */}
      <div className="flex-1 relative w-full h-full min-h-[450px] bg-[#1e1e1e]">
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          theme="vs-dark"
          options={{
            readOnly: isReadOnly,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          onMount={handleEditorDidMount}
          loading={
            <div className="absolute inset-0 bg-bg-main flex items-center justify-center text-text-muted text-xs font-mono gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-replit-orange" />
              Initializing Monaco Editor...
            </div>
          }
        />
      </div>

      {/* Footer Status Bar */}
      <div className="px-4 py-1.5 border-t border-border-subtle bg-bg-surface flex items-center justify-between text-[11px] font-mono text-text-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-400">
            <Sparkles className="w-3 h-3" />
            Yjs CRDT Engine
          </span>
          <span>Role: {role}</span>
        </div>
        <span>Language: {language}</span>
      </div>
    </div>
  );
};
