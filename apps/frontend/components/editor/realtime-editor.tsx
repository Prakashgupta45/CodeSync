'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { RoomPresenceUserDto } from '@codesync/shared';
import { Loader2, Lock } from 'lucide-react';
import { getStarterCode, getLanguageForFilename } from './language-templates';

const API_SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ||
  'http://localhost:5000';

export interface DocApi {
  addFile: (name: string, initialCode?: string) => void;
  removeFile: (name: string) => void;
  renameFile: (oldName: string, newName: string) => void;
  setActiveFileContent?: (content: string) => void;
}

interface RealtimeEditorProps {
  roomId: string;
  language: string;
  role: 'OWNER' | 'PARTICIPANT' | 'VIEWER';
  user: {
    id: string;
    name: string;
  };
  activeFile?: string;
  primaryFile?: string;
  workspaceFiles?: string[];
  onWorkspaceFilesSync?: (files: string[]) => void;
  onLanguageUpdate?: (lang: string) => void;
  onSocketInit?: (socket: Socket) => void;
  onPresenceUpdate?: (users: RoomPresenceUserDto[]) => void;
  onRoleUpdate?: (role: any) => void;
  onCodeGetterInit?: (codeGetter: () => string) => void;
  onDocInit?: (docApi: DocApi) => void;
  onCodeChange?: (code: string) => void;
  initialContent?: string;
  onEditorMount?: (editor: any) => void;
}

export const RealtimeEditorComponent: React.FC<RealtimeEditorProps> = ({
  roomId,
  language,
  role,
  user,
  activeFile = 'solution.ts',
  primaryFile = 'solution.ts',
  workspaceFiles,
  onWorkspaceFilesSync,
  onLanguageUpdate,
  onSocketInit,
  onPresenceUpdate,
  onRoleUpdate,
  onCodeGetterInit,
  onDocInit,
  onCodeChange,
  initialContent,
  onEditorMount,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const activeYTextRef = useRef<Y.Text | null>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);
  const isInternalChange = useRef<boolean>(false);
  const initialContentRef = useRef<string | undefined>(initialContent);
  const activeFileRef = useRef<string>(activeFile);
  const primaryFileRef = useRef<string>(primaryFile);
  const currentBoundFileRef = useRef<string | null>(null);
  const onCodeChangeRef = useRef(onCodeChange);
  const onLanguageUpdateRef = useRef(onLanguageUpdate);
  const onPresenceUpdateRef = useRef(onPresenceUpdate);
  const onRoleUpdateRef = useRef(onRoleUpdate);
  const onWorkspaceFilesSyncRef = useRef(onWorkspaceFilesSync);

  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  useEffect(() => {
    onLanguageUpdateRef.current = onLanguageUpdate;
  }, [onLanguageUpdate]);

  useEffect(() => {
    onPresenceUpdateRef.current = onPresenceUpdate;
  }, [onPresenceUpdate]);

  useEffect(() => {
    onRoleUpdateRef.current = onRoleUpdate;
  }, [onRoleUpdate]);

  useEffect(() => {
    onWorkspaceFilesSyncRef.current = onWorkspaceFilesSync;
  }, [onWorkspaceFilesSync]);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    primaryFileRef.current = primaryFile;
  }, [primaryFile]);

  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [initialContent]);

  const isReadOnly = role === 'VIEWER';
  const isReadOnlyRef = useRef<boolean>(isReadOnly);

  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    isReadOnlyRef.current = isReadOnly;
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isReadOnly });
    }
  }, [isReadOnly]);

  // Map language string or filename to Monaco editor language identifier
  const getMonacoLanguage = useCallback((lang: string, filename?: string): string => {
    if (filename) {
      const derived = getLanguageForFilename(filename);
      if (derived) {
        return derived === 'csharp' ? 'csharp' : derived;
      }
    }
    const l = (lang || '').toLowerCase().trim();
    switch (l) {
      case 'c':
        return 'c';
      case 'cpp':
      case 'c++':
        return 'cpp';
      case 'java':
        return 'java';
      case 'python':
      case 'py':
        return 'python';
      case 'typescript':
      case 'ts':
        return 'typescript';
      case 'go':
      case 'golang':
        return 'go';
      case 'rust':
      case 'rs':
        return 'rust';
      case 'csharp':
      case 'c#':
      case 'cs':
        return 'csharp';
      case 'javascript':
      case 'js':
      default:
        return 'javascript';
    }
  }, []);

  // Helper to obtain Y.Text for a given filename
  const getYTextForFile = useCallback((doc: Y.Doc, filename: string): Y.Text => {
    const isPrimary = filename === primaryFileRef.current;
    const fileKey = `file:${filename}`;
    const specificText = doc.getText(fileKey);
    const legacyText = doc.getText('codemirror');

    if (isPrimary) {
      // If specific has text, use it; else if legacy has text, use legacy
      if (specificText.toString().length > 0) {
        return specificText;
      }
      if (legacyText.toString().length > 0) {
        return legacyText;
      }
      return specificText;
    }

    return specificText;
  }, []);

  // Attach Y.Text observer to sync changes into Monaco
  const bindYTextToEditor = useCallback(
    (yText: Y.Text, targetFile: string) => {
      if (observerCleanupRef.current) {
        observerCleanupRef.current();
        observerCleanupRef.current = null;
      }

      activeYTextRef.current = yText;
      currentBoundFileRef.current = targetFile;

      const observer = (event: Y.YTextEvent) => {
        if (event.transaction.origin === 'remote' || event.transaction.origin === 'initial-sync') {
          const editor = editorRef.current;
          const monaco = monacoRef.current;
          if (!editor || !monaco) return;
          const model = editor.getModel();
          if (!model) return;

          isInternalChange.current = true;
          try {
            // 1. Capture current cursor and selections as relative positions in Yjs
            const sel = editor.getSelection();
            let relStart: Y.RelativePosition | null = null;
            let relEnd: Y.RelativePosition | null = null;
            let selDirection: any = null;

            if (sel) {
              const startOffset = model.getOffsetAt(sel.getStartPosition());
              const endOffset = model.getOffsetAt(sel.getEndPosition());
              relStart = Y.createRelativePositionFromTypeIndex(yText, startOffset);
              relEnd = Y.createRelativePositionFromTypeIndex(yText, endOffset);
              selDirection = sel.getDirection();
            }

            // 2. Apply granular delta changes without wiping fullRange
            if (event.delta && event.delta.length > 0) {
              let index = 0;
              const edits: any[] = [];
              for (const op of event.delta) {
                if (op.retain !== undefined) {
                  index += op.retain;
                } else if (op.insert !== undefined) {
                  const pos = model.getPositionAt(index);
                  const range = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
                  const insertText = typeof op.insert === 'string' ? op.insert : String(op.insert);
                  edits.push({ range, text: insertText, forceMoveMarkers: true });
                  index += insertText.length;
                } else if (op.delete !== undefined) {
                  const pos = model.getPositionAt(index);
                  const endPos = model.getPositionAt(index + op.delete);
                  const range = new monaco.Range(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column);
                  edits.push({ range, text: '', forceMoveMarkers: true });
                }
              }

              if (edits.length > 0) {
                model.applyEdits(edits);
              }
            } else {
              const updated = yText.toString();
              if (model.getValue() !== updated) {
                const fullRange = model.getFullModelRange();
                model.applyEdits([{ range: fullRange, text: updated, forceMoveMarkers: true }]);
              }
            }

            // 3. Restore cursor & selections accurately via Yjs relative positions
            if (relStart && relEnd && docRef.current) {
              const absStart = Y.createAbsolutePositionFromRelativePosition(relStart, docRef.current);
              const absEnd = Y.createAbsolutePositionFromRelativePosition(relEnd, docRef.current);
              if (absStart && absEnd && absStart.type === yText && absEnd.type === yText) {
                const curStart = model.getPositionAt(absStart.index);
                const curEnd = model.getPositionAt(absEnd.index);
                editor.setSelection(
                  monaco.Selection.createWithDirection(
                    curStart.lineNumber,
                    curStart.column,
                    curEnd.lineNumber,
                    curEnd.column,
                    selDirection || 0
                  )
                );
              }
            }
          } finally {
            isInternalChange.current = false;
          }

          onCodeChangeRef.current?.(yText.toString());
        }
      };

      yText.observe(observer);
      observerCleanupRef.current = () => {
        yText.unobserve(observer);
      };

      // Set current text into editor ONLY if different or switching file
      const editor = editorRef.current;
      if (editor) {
        let code = yText.toString();
        // If file is empty, seed with starter template
        if (!code && initialContentRef.current && targetFile === primaryFileRef.current) {
          code = initialContentRef.current;
          const doc = docRef.current;
          if (doc && !isReadOnlyRef.current) {
            doc.transact(() => {
              yText.insert(0, code);
            }, 'initial-template');
          }
        }

        if (editor.getValue() !== code) {
          isInternalChange.current = true;
          const model = editor.getModel();
          const pos = editor.getPosition();
          if (!editor.getValue()) {
            editor.setValue(code);
          } else if (model) {
            model.applyEdits([{ range: model.getFullModelRange(), text: code, forceMoveMarkers: true }]);
          } else {
            editor.setValue(code);
          }
          if (pos && editor.getModel()) {
            const lineCount = editor.getModel()?.getLineCount() || 1;
            const targetLine = Math.min(Math.max(1, pos.lineNumber), lineCount);
            const maxCol = editor.getModel()?.getLineMaxColumn(targetLine) || 1;
            editor.setPosition({
              lineNumber: targetLine,
              column: Math.min(Math.max(1, pos.column), maxCol),
            });
          }
          isInternalChange.current = false;
          onCodeChangeRef.current?.(code);
        }

        // Update Monaco syntax language
        const monaco = monacoRef.current;
        const model = editor.getModel();
        if (monaco && model) {
          const langId = getMonacoLanguage(language, targetFile);
          monaco.editor.setModelLanguage(model, langId);
        }
      }
    },
    [getMonacoLanguage, language]
  );

  // Switch active file when activeFile prop changes
  useEffect(() => {
    const doc = docRef.current;
    const editor = editorRef.current;
    if (!doc || !editor) return;

    // Guard: If we are already bound to this activeFile, do not re-bind or reset editor content!
    if (currentBoundFileRef.current === activeFile) {
      const monaco = monacoRef.current;
      const model = editor.getModel();
      if (monaco && model) {
        const langId = getMonacoLanguage(language, activeFile);
        if (model.getLanguageId() !== langId) {
          monaco.editor.setModelLanguage(model, langId);
        }
      }
      return;
    }

    const yText = getYTextForFile(doc, activeFile);
    let code = yText.toString();

    // If new language file is genuinely empty, populate with that language's starter code
    if (!code && !isReadOnlyRef.current) {
      const derivedLang = getLanguageForFilename(activeFile) || language;
      const starter = getStarterCode(derivedLang);
      if (starter) {
        doc.transact(() => {
          yText.insert(0, starter);
        }, 'starter-code');
        code = starter;
      }
    }

    bindYTextToEditor(yText, activeFile);

    // Update Monaco syntax mode
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (monaco && model) {
      const langId = getMonacoLanguage(language, activeFile);
      monaco.editor.setModelLanguage(model, langId);
    }
  }, [activeFile, bindYTextToEditor, getMonacoLanguage, getYTextForFile, language]);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      if (onCodeGetterInit) {
        onCodeGetterInit(() => editor.getValue());
      }

      if (onEditorMount) {
        onEditorMount(editor);
      }

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

      // Initialize DocApi for parent
      if (onDocInit) {
        onDocInit({
          addFile: (name: string, initialCode?: string) => {
            const fileYText = getYTextForFile(doc, name);
            if (initialCode && fileYText.toString().length === 0) {
              doc.transact(() => {
                fileYText.insert(0, initialCode);
              }, 'add-file');
            }
          },
          removeFile: (name: string) => {
            const fileYText = getYTextForFile(doc, name);
            doc.transact(() => {
              fileYText.delete(0, fileYText.length);
            }, 'remove-file');
          },
          renameFile: (oldName: string, newName: string) => {
            const oldYText = getYTextForFile(doc, oldName);
            const newYText = getYTextForFile(doc, newName);
            const content = oldYText.toString();
            doc.transact(() => {
              newYText.insert(0, content);
              oldYText.delete(0, oldYText.length);
            }, 'rename-file');
          },
          setActiveFileContent: (content: string) => {
            const currentYText = activeYTextRef.current;
            if (!currentYText) return;
            doc.transact(() => {
              currentYText.delete(0, currentYText.length);
              currentYText.insert(0, content);
            }, 'local-set');
            isInternalChange.current = true;
            editor.setValue(content);
            isInternalChange.current = false;
            onCodeChange?.(content);
          },
        });
      }

      const initialYText = getYTextForFile(doc, activeFileRef.current);
      bindYTextToEditor(initialYText, activeFileRef.current);

      // 2. Connect to Backend Socket.IO Server
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

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

      socket.on('collaboration:sync', (data: { state: number[]; content?: string; role?: string; language?: string }) => {
        setConnectionStatus('connected');
        setErrorMessage(null);

        if (data.role === 'VIEWER') {
          isReadOnlyRef.current = true;
          editor.updateOptions({ readOnly: true });
        }

        if (data.language && onLanguageUpdateRef.current) {
          onLanguageUpdateRef.current(data.language);
        }

        if (data.state && data.state.length > 0) {
          Y.applyUpdate(doc, new Uint8Array(data.state), 'initial-sync');
        }

        const currentActiveText = getYTextForFile(doc, activeFileRef.current);
        let syncedCode = currentActiveText.toString();

        if (!syncedCode && initialContentRef.current && activeFileRef.current === primaryFileRef.current) {
          syncedCode = initialContentRef.current;
          doc.transact(() => {
            currentActiveText.delete(0, currentActiveText.length);
            currentActiveText.insert(0, syncedCode);
          }, 'initial-template');
        }

        if (editor.getValue() !== syncedCode) {
          isInternalChange.current = true;
          const pos = editor.getPosition();
          const sel = editor.getSelection();
          const syncModel = editor.getModel();

          if (!editor.getValue()) {
            editor.setValue(syncedCode);
          } else if (syncModel) {
            syncModel.applyEdits([{ range: syncModel.getFullModelRange(), text: syncedCode, forceMoveMarkers: true }]);
          } else {
            editor.setValue(syncedCode);
          }

          if (pos && syncModel) {
            const lineCount = syncModel.getLineCount();
            const targetLine = Math.min(Math.max(1, pos.lineNumber), lineCount);
            const maxCol = syncModel.getLineMaxColumn(targetLine);
            editor.setPosition({
              lineNumber: targetLine,
              column: Math.min(Math.max(1, pos.column), maxCol),
            });
          }
          if (sel) {
            editor.setSelection(sel);
          }
          isInternalChange.current = false;
          onCodeChangeRef.current?.(syncedCode);
        }
      });

      socket.on('presence:update', (data: { roomId: string; users: RoomPresenceUserDto[] }) => {
        if (data.roomId === roomId && onPresenceUpdateRef.current) {
          onPresenceUpdateRef.current(data.users);
        }
      });

      socket.on('collaboration:update', (data: { update: number[]; userId?: string; socketId?: string }) => {
        if (data.socketId && data.socketId === socket.id) return;
        if (data.update && data.userId !== user.id) {
          Y.applyUpdate(doc, new Uint8Array(data.update), 'remote');
        } else if (data.update && !data.userId) {
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

      // Transmit Monaco changes -> Yjs active Y.Text -> Socket.IO Server
      editor.onDidChangeModelContent((event) => {
        if (isInternalChange.current || isReadOnlyRef.current) return;

        const currentYText = activeYTextRef.current;
        if (!currentYText) return;

        // Apply granular incremental changes to preserve CRDT state and cursor integrity
        if (event.changes && event.changes.length > 0) {
          const sortedChanges = [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
          doc.transact(() => {
            for (const change of sortedChanges) {
              if (change.rangeLength > 0) {
                currentYText.delete(change.rangeOffset, change.rangeLength);
              }
              if (change.text.length > 0) {
                currentYText.insert(change.rangeOffset, change.text);
              }
            }
          }, 'local');
        } else {
          const newText = editor.getValue();
          if (newText !== currentYText.toString()) {
            doc.transact(() => {
              currentYText.delete(0, currentYText.length);
              currentYText.insert(0, newText);
            }, 'local');
          }
        }

        const updatedVal = editor.getValue();
        onCodeChangeRef.current?.(updatedVal);
      });

      // Broadcast Yjs updates to Socket.IO server
      doc.on('update', (update: Uint8Array, origin: any) => {
        if (origin !== 'remote' && origin !== 'initial-sync' && !isReadOnlyRef.current) {
          socket.emit('collaboration:update', {
            roomId,
            update: Array.from(update),
          });
        }
      });
    },
    [bindYTextToEditor, getYTextForFile, onCodeGetterInit, onDocInit, onEditorMount, onSocketInit, roomId, user.id]
  );

  useEffect(() => {
    return () => {
      if (observerCleanupRef.current) {
        observerCleanupRef.current();
      }
      if (docRef.current) {
        docRef.current.destroy();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
      {isReadOnly && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-mono flex items-center gap-2 shrink-0">
          <Lock className="w-3.5 h-3.5" />
          <span>VIEWER MODE (Read-Only) — Editing is disabled for your role</span>
        </div>
      )}

      <div className="flex-1 relative w-full h-full min-h-0 bg-[#12141a]">
        <Editor
          height="100%"
          language={getMonacoLanguage(language, activeFile)}
          theme="vs-dark"
          options={{
            readOnly: isReadOnly,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
          onMount={handleEditorDidMount}
          loading={
            <div className="absolute inset-0 bg-bg-main flex items-center justify-center text-text-muted text-xs font-mono gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-replit-orange" />
              <span>Initializing Monaco Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
};

export const RealtimeEditor = React.memo(RealtimeEditorComponent);
