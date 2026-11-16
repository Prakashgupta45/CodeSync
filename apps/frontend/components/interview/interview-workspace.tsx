'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/auth-context';
import {
  QUESTION_LIBRARY,
  ProblemDefinition,
  TestCaseItem,
  InterviewItem,
  getInterviewById,
  getInterviewByToken,
  cacheInterviewStatusLocally,
  getResolvedStarterTemplate,
} from '../../lib/interview-service';
import { generateTestDriver, compareOutputs } from '../../lib/test-harness';
import {
  ArrowLeft,
  Play,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
  Loader2,
  FileCode,
  Award,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Terminal,
  Sparkles,
  Bot,
  Sun,
  Moon,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  PanelLeftClose,
  PanelRightClose,
  CodeXml,
  ChevronDown as DropdownIcon,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Dynamic import for Monaco Editor
const RealtimeEditor = dynamic(
  () => import('../editor/realtime-editor').then((m) => m.RealtimeEditor),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={24} color="#ff5c00" />
      </div>
    ),
  }
);

interface InterviewWorkspaceProps {
  roomId: string;
  interview?: InterviewItem | null;
}

export function InterviewWorkspace({ roomId, interview: propInterview }: InterviewWorkspaceProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Resolved Interview Item (from prop or registry lookup)
  const [interview, setInterview] = useState<InterviewItem | null>(propInterview || null);

  useEffect(() => {
    if (propInterview) {
      setInterview(propInterview);
    }
  }, [propInterview]);

  useEffect(() => {
    if (!interview) {
      const found = getInterviewById(roomId) || getInterviewByToken(roomId);
      if (found) {
        setInterview(found);
      }
    }
  }, [roomId, interview]);

  // Problems List
  const problems: ProblemDefinition[] =
    interview?.problems && interview.problems.length > 0
      ? interview.problems
      : [QUESTION_LIBRARY[0]];

  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const activeProblem = problems[activeProblemIndex] || problems[0];

  // Permitted Languages
  const permittedLanguages = interview?.permittedLanguages && interview.permittedLanguages.length > 0
    ? interview.permittedLanguages
    : ['typescript', 'python', 'java', 'cpp', 'javascript'];

  const initialLang = interview?.defaultLanguage || permittedLanguages[0] || 'typescript';
  const [selectedLang, setSelectedLang] = useState<'typescript' | 'python' | 'javascript' | 'java' | 'cpp'>(
    initialLang as 'typescript' | 'python' | 'javascript' | 'java' | 'cpp'
  );

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Resizable Panel Dimensions
  const [problemWidth, setProblemWidth] = useState(360);
  const [aiWidth, setAiWidth] = useState(340);
  const [testHeight, setTestHeight] = useState(250);

  // Panel Collapsed States
  const [isProblemCollapsed, setIsProblemCollapsed] = useState(false);
  const [isAiCollapsed, setIsAiCollapsed] = useState(false);
  const [isTestCollapsed, setIsTestCollapsed] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);

  // Active Bottom Drawer Tab
  const [activeBottomTab, setActiveBottomTab] = useState<'cases' | 'results' | 'custom' | 'submission'>('cases');
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  // Execution States
  const [codeGetter, setCodeGetter] = useState<(() => string) | undefined>(undefined);
  const editorInstanceRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<any>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear genuine compiler markers from editor
  const clearCompilerMarkers = useCallback(() => {
    if (monacoInstanceRef.current && editorInstanceRef.current) {
      const model = editorInstanceRef.current.getModel();
      if (model) {
        monacoInstanceRef.current.editor.setModelMarkers(model, 'compiler', []);
      }
    }
  }, []);

  // Map genuine Docker compilation error traces to Monaco editor line markers
  const setCompilerMarkers = useCallback((errorOutput: string) => {
    if (!monacoInstanceRef.current || !editorInstanceRef.current || !errorOutput) return;
    const model = editorInstanceRef.current.getModel();
    if (!model) return;

    const lines = errorOutput.split('\n');
    const markers: any[] = [];
    const totalLines = model.getLineCount();

    // Regex for GCC / Clang / Java compiler errors:
    // "solution.cpp:15:5: error: expected ';' before '}' token"
    // "Solution.java:14: error: cannot find symbol"
    const gccRegex = /(?:[a-zA-Z0-9_\-\.\/\\]+):(\d+):(?:(\d+):)?\s*(?:fatal )?(error|warning):\s*(.*)/i;

    for (const l of lines) {
      const match = l.match(gccRegex);
      if (match) {
        const rawLine = parseInt(match[1], 10);
        const rawCol = match[2] ? parseInt(match[2], 10) : 1;
        const isWarning = (match[3] || '').toLowerCase() === 'warning';
        const message = match[4]?.trim() || 'Compiler diagnostic';

        const targetLine = Math.min(Math.max(1, rawLine), totalLines);
        const maxCol = model.getLineMaxColumn(targetLine);
        const targetCol = Math.min(Math.max(1, rawCol), maxCol);

        markers.push({
          startLineNumber: targetLine,
          startColumn: targetCol,
          endLineNumber: targetLine,
          endColumn: maxCol,
          message,
          severity: isWarning
            ? monacoInstanceRef.current.MarkerSeverity.Warning
            : monacoInstanceRef.current.MarkerSeverity.Error,
        });
      }
    }

    if (markers.length === 0 && errorOutput.trim().length > 0) {
      const firstLine = errorOutput.split('\n')[0].slice(0, 150);
      markers.push({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: model.getLineMaxColumn(1),
        message: firstLine,
        severity: monacoInstanceRef.current.MarkerSeverity.Error,
      });
    }

    monacoInstanceRef.current.editor.setModelMarkers(model, 'compiler', markers);
  }, []);

  // Test Execution Results
  const [testCasesState, setTestCasesState] = useState<TestCaseItem[]>(activeProblem.visibleTestCases);
  const [customInputText, setCustomInputText] = useState(activeProblem.examples?.[0]?.input || activeProblem.inputFormat || '');
  const [customOutput, setCustomOutput] = useState<string>('');
  const [executionStats, setExecutionStats] = useState<{
    durationMs?: number;
    memoryMb?: string;
    exitCode?: number;
    statusText?: string;
    isSuccess?: boolean;
    errorText?: string;
  } | null>(null);

  // Submission Results
  const [submissionVerdict, setSubmissionVerdict] = useState<{
    status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | null;
    visiblePassed: number;
    visibleTotal: number;
    hiddenPassed: number;
    hiddenTotal: number;
    score: number;
    runtimeMs: number;
    memoryMb: string;
    verdictMessage: string;
  } | null>(null);

  // Timer: Duration from interview or default 45 mins persisted across page refreshes
  const sessionPersistenceId = interview?.token || roomId;
  const durationSeconds = (interview?.duration || 45) * 60;
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    try {
      const storageKey = `codesync_timer_end_${sessionPersistenceId}`;
      const existingEnd = localStorage.getItem(storageKey);
      let endMs = existingEnd ? Number(existingEnd) : 0;
      if (!endMs || Number.isNaN(endMs)) {
        endMs = Date.now() + durationSeconds * 1000;
        localStorage.setItem(storageKey, String(endMs));
      }
      setTimeLeft(Math.max(0, Math.round((endMs - Date.now()) / 1000)));
    } catch (_) {
      setTimeLeft(durationSeconds);
    }
  }, [sessionPersistenceId, durationSeconds]);

  // AI Interviewer Chat
  const [messages, setMessages] = useState<Array<{ role: 'ai' | 'user'; text: string; time: string }>>([
    {
      role: 'ai',
      text: `Hello! I am your CodeSync AI Technical Interviewer today. We are going to solve "${activeProblem.title}". Before you begin writing code, please explain your initial algorithmic approach and expected time complexity.`,
      time: 'Just now',
    },
  ]);

  // Restore AI conversation history from PostgreSQL on mount
  useEffect(() => {
    let isMounted = true;
    const loadAiHistory = async () => {
      if (!interview?.token) return;
      try {
        const res = await fetch(`/api/interviews/${interview.token}/ai`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.data?.messages && data.data.messages.length > 0) {
            setMessages(
              data.data.messages.map((m: any) => ({
                role: m.role || (m.senderType === 'CANDIDATE' ? 'user' : 'ai'),
                text: m.text || m.content,
                time: m.time || 'Restored',
              }))
            );
          }
        }
      } catch (_) {}
    };
    loadAiHistory();
    return () => {
      isMounted = false;
    };
  }, [interview?.token]);

  // Keep AI greeting updated if activeProblem resolves dynamically and no conversation started
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= 1 && prev[0]?.role === 'ai') {
        return [
          {
            role: 'ai',
            text: `Hello! I am your CodeSync AI Technical Interviewer today. We are going to solve "${activeProblem.title}". Before you begin writing code, please explain your initial algorithmic approach and expected time complexity.`,
            time: 'Just now',
          },
        ];
      }
      return prev;
    });
  }, [activeProblem.id, activeProblem.title]);

  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Report Modal
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Dragging state references
  const isDraggingRef = useRef<'left' | 'right' | 'bottom' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; initialDim: number }>({ x: 0, y: 0, initialDim: 0 });

  // Load saved layout & theme
  useEffect(() => {
    const savedTheme = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    try {
      const savedLayout = localStorage.getItem('codesync-interview-layout-v3');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        if (parsed.problemWidth) setProblemWidth(parsed.problemWidth);
        if (parsed.aiWidth) setAiWidth(parsed.aiWidth);
        if (parsed.testHeight) setTestHeight(parsed.testHeight);
        if (typeof parsed.isProblemCollapsed === 'boolean') setIsProblemCollapsed(parsed.isProblemCollapsed);
        if (typeof parsed.isAiCollapsed === 'boolean') setIsAiCollapsed(parsed.isAiCollapsed);
        if (typeof parsed.isTestCollapsed === 'boolean') setIsTestCollapsed(parsed.isTestCollapsed);
      }
    } catch (_) {}
  }, []);

  // Update visible test cases and custom input when active problem changes
  useEffect(() => {
    setTestCasesState(activeProblem.visibleTestCases || []);
    setSelectedCaseIndex(0);
    setCustomInputText(activeProblem.examples?.[0]?.input || activeProblem.inputFormat || '');
  }, [activeProblem]);

  // Helper to extract or generate clean starter template for the active problem
  const getStarterTemplate = useCallback(
    (prob: ProblemDefinition, lang: string) => {
      return getResolvedStarterTemplate(prob, lang);
    },
    []
  );

  // Switch Language with Confirmation if Modified
  const handleLanguageChange = (newLang: 'typescript' | 'python' | 'javascript' | 'java' | 'cpp') => {
    if (newLang === selectedLang) return;

    const currentVal = editorInstanceRef.current ? editorInstanceRef.current.getValue() : (codeGetter ? codeGetter() : '');
    const defaultForCurrent = getStarterTemplate(activeProblem, selectedLang);
    const isModified = currentVal && currentVal.trim() !== defaultForCurrent.trim();

    if (isModified) {
      const confirmed = window.confirm(
        `Switching language to ${newLang.toUpperCase()} will load its starter template. Any unsaved edits in ${selectedLang.toUpperCase()} will be replaced. Do you want to continue?`
      );
      if (!confirmed) return;
    }

    setSelectedLang(newLang);
    clearCompilerMarkers();
  };

  // Switch Question (if HR assigned multiple)
  const handleSwitchProblem = (newIndex: number) => {
    if (newIndex === activeProblemIndex) return;
    setActiveProblemIndex(newIndex);
    clearCompilerMarkers();
    const newProblem = problems[newIndex];
    const newTemplate = getStarterTemplate(newProblem, selectedLang);
    if (editorInstanceRef.current) {
      editorInstanceRef.current.setValue(newTemplate);
    }
    setMessages((prev) => [
      ...prev,
      {
        role: 'ai',
        text: `Now moving on to Question ${newIndex + 1}: "${newProblem.title}". Please read the constraints and explain your initial approach.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('codesync-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  // Splitter Handlers
  const handleSplitterMouseDown = (
    type: 'left' | 'right' | 'bottom',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    isDraggingRef.current = type;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'bottom' ? 'row-resize' : 'col-resize';

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialDim:
        type === 'left' ? problemWidth : type === 'right' ? aiWidth : testHeight,
    };

    window.addEventListener('mousemove', handleSplitterMouseMove);
    window.addEventListener('mouseup', handleSplitterMouseUp);
  };

  const handleSplitterMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    if (isDraggingRef.current === 'left') {
      const delta = e.clientX - dragStartRef.current.x;
      const newWidth = Math.max(220, Math.min(window.innerWidth * 0.45, dragStartRef.current.initialDim + delta));
      setProblemWidth(newWidth);
    } else if (isDraggingRef.current === 'right') {
      const delta = dragStartRef.current.x - e.clientX;
      const newWidth = Math.max(240, Math.min(window.innerWidth * 0.42, dragStartRef.current.initialDim + delta));
      setAiWidth(newWidth);
    } else if (isDraggingRef.current === 'bottom') {
      const delta = dragStartRef.current.y - e.clientY;
      const newHeight = Math.max(130, Math.min(window.innerHeight * 0.65, dragStartRef.current.initialDim + delta));
      setTestHeight(newHeight);
    }

    window.dispatchEvent(new Event('resize'));
  };

  const handleSplitterMouseUp = () => {
    isDraggingRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleSplitterMouseMove);
    window.removeEventListener('mouseup', handleSplitterMouseUp);

    try {
      localStorage.setItem(
        'codesync-interview-layout-v3',
        JSON.stringify({ problemWidth, aiWidth, testHeight, isProblemCollapsed, isAiCollapsed, isTestCollapsed })
      );
    } catch (_) {}
    window.dispatchEvent(new Event('resize'));
  };

  const toggleExpandEditor = () => {
    if (!isEditorExpanded) {
      setIsProblemCollapsed(true);
      setIsAiCollapsed(true);
      setIsTestCollapsed(true);
      setIsEditorExpanded(true);
    } else {
      setIsProblemCollapsed(false);
      setIsAiCollapsed(false);
      setIsTestCollapsed(false);
      setIsEditorExpanded(false);
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  };

  const handleResetLayout = () => {
    setProblemWidth(360);
    setAiWidth(340);
    setTestHeight(250);
    setIsProblemCollapsed(false);
    setIsAiCollapsed(false);
    setIsTestCollapsed(false);
    setIsEditorExpanded(false);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
  };

  // AI Interviewer Message Handling
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isAiThinking) return;

    if (!customPrompt) setInputText('');

    const newMsg = {
      role: 'user' as const,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsAiThinking(true);

    try {
      const currentCode = codeGetter ? codeGetter() : '';
      const aiEndpoint = interview?.token
        ? `/api/interviews/${interview.token}/ai`
        : `${API_BASE_URL}/rooms/${roomId}/ai/prompt`;

      // Only attach code when candidate explicitly asks for code review or debugging
      const isCodeReviewRequest = /\b(?:review|check|rate|critique|look at|grade|debug|trace)\b.*\b(?:code|solution|implementation|codebase)\b/i.test(textToSend);

      const res = await fetch(aiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt: textToSend,
          candidateMessage: textToSend,
          problemTitle: activeProblem.title,
          problemDifficulty: activeProblem.difficulty,
          problemDescription: activeProblem.description,
          language: selectedLang,
          currentCode: isCodeReviewRequest ? currentCode : undefined,
          action: 'CHAT',
          code: isCodeReviewRequest ? currentCode : undefined,
          history: messages,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data?.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: data.data.response,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: `AI Interviewer service returned an error (${data?.error?.message || `HTTP ${res.status}`}). Your response has been recorded; please continue coding or retry.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: `Unable to reach the AI Interviewer backend service right now. You can still write, run, and submit your code in the workspace.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Run Code
  const handleRunCode = async () => {
    const rawCode = codeGetter ? codeGetter() : '';
    clearCompilerMarkers();
    setIsRunningCode(true);
    setActiveBottomTab('results');
    setExecutionStats(null);

    const tc = testCasesState[selectedCaseIndex] || activeProblem.visibleTestCases[selectedCaseIndex];
    const executableCode = generateTestDriver(
      rawCode,
      selectedLang,
      activeProblem.id,
      tc.input,
      activeProblem.functionSignature
    );

    try {
      const execEndpoint = interview?.token
        ? `/api/interviews/${interview.token}/execute`
        : `${API_BASE_URL}/rooms/${roomId}/execute`;

      const res = await fetch(execEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: executableCode, language: selectedLang }),
      });

      const data = await res.json();
      const execData = data.data;

      if (res.ok && data.success && execData) {
        const isTimeout = Boolean(execData.timedOut || execData.exitCode === 124 || execData.exitCode === 143);
        const isCompileError = Boolean(execData.compileError);
        const isRuntimeError = Boolean(execData.runtimeError && !isTimeout);
        const isCleanExit = execData.exitCode === 0 && !isTimeout;
        const passed =
          isCleanExit &&
          compareOutputs(execData.stdout || '', tc.expectedOutput, { problemId: activeProblem.id });

        let errorText: string | undefined = undefined;
        if (isTimeout) errorText = 'Execution timed out after 5.0 seconds';
        else if (isCompileError) {
          errorText = execData.compileError;
          setCompilerMarkers(execData.compileError);
        } else if (isRuntimeError) errorText = execData.runtimeError;
        else if (!passed && isCleanExit)
          errorText = `Output mismatch. Expected ${tc.expectedOutput}, got ${execData.stdout.trim()}`;

        if (!isCompileError) {
          clearCompilerMarkers();
        }

        let statusText = 'Execution Completed';
        if (isTimeout) statusText = 'Execution Timed Out (5.0s Limit)';
        else if (isCompileError) statusText = 'Compilation Error';
        else if (isRuntimeError) statusText = 'Runtime Error';
        else if (passed) statusText = 'Test Passed';
        else statusText = 'Wrong Answer';

        const actualOutput = isTimeout
          ? 'Execution timed out after 5.0 seconds'
          : isCompileError
          ? execData.compileError
          : isRuntimeError
          ? execData.runtimeError
          : execData.stdout
          ? execData.stdout.trim()
          : 'No output';

        setExecutionStats({
          durationMs: execData.executionTimeMs || 0,
          memoryMb: '256 MB Limit',
          exitCode: execData.exitCode ?? 0,
          statusText,
          isSuccess: passed,
          errorText,
        });

        setTestCasesState((prev) =>
          prev.map((item, idx) =>
            idx === selectedCaseIndex
              ? {
                  ...item,
                  actualOutput,
                  passed,
                  executionTime: execData.executionTimeMs || 35,
                }
              : item
          )
        );
      } else {
        const errMsg = data?.error?.message || 'Execution failed';
        setExecutionStats({
          durationMs: 0,
          memoryMb: '256 MB Limit',
          exitCode: 1,
          statusText: 'Execution Error',
          isSuccess: false,
          errorText: errMsg,
        });
        setTestCasesState((prev) =>
          prev.map((item, idx) =>
            idx === selectedCaseIndex
              ? { ...item, actualOutput: errMsg, passed: false, executionTime: 40 }
              : item
          )
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reach Docker execution runner';
      setExecutionStats({
        durationMs: 40,
        memoryMb: '32.4 MB',
        exitCode: 1,
        statusText: 'Execution Request Failed',
        isSuccess: false,
        errorText: errMsg,
      });
      setTestCasesState((prev) =>
        prev.map((item, idx) =>
          idx === selectedCaseIndex
            ? { ...item, actualOutput: errMsg, passed: false, executionTime: 40 }
            : item
        )
      );
    } finally {
      setIsRunningCode(false);
    }
  };

  // Run All Visible Tests
  const handleRunTests = async () => {
    const rawCode = codeGetter ? codeGetter() : '';
    clearCompilerMarkers();
    setIsRunningTests(true);
    setActiveBottomTab('results');

    try {
      let anyTimeout = false;
      let anyCompileError = false;
      let anyRuntimeError = false;
      let totalPassed = 0;
      let lastExecTime = 40;

      const updatedCases = await Promise.all(
        activeProblem.visibleTestCases.map(async (tc) => {
          const driverCode = generateTestDriver(
            rawCode,
            selectedLang,
            activeProblem.id,
            tc.input,
            activeProblem.functionSignature
          );
          try {
            const execEndpoint = interview?.token
              ? `/api/interviews/${interview.token}/execute`
              : `${API_BASE_URL}/rooms/${roomId}/execute`;

            const res = await fetch(execEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ code: driverCode, language: selectedLang }),
            });
            const data = await res.json();
            const execData = data?.data;
            if (execData) {
              lastExecTime = execData.executionTimeMs;
              const isTimeout = Boolean(execData.timedOut || execData.exitCode === 124 || execData.exitCode === 143);
              const isCompileError = Boolean(execData.compileError);
              const isRuntimeError = Boolean(execData.runtimeError && !isTimeout);
              const isCleanExit = execData.exitCode === 0 && !isTimeout;
              const passed =
                isCleanExit &&
                compareOutputs(execData.stdout || '', tc.expectedOutput, { problemId: activeProblem.id });

              if (isTimeout) anyTimeout = true;
              if (isCompileError) anyCompileError = true;
              if (isRuntimeError) anyRuntimeError = true;
              if (passed) totalPassed++;

              const actualOutput = isTimeout
                ? 'Execution timed out after 5.0 seconds'
                : isCompileError
                ? execData.compileError
                : isRuntimeError
                ? execData.runtimeError
                : execData.stdout
                ? execData.stdout.trim()
                : 'No output';

              return {
                ...tc,
                actualOutput,
                passed,
                executionTime: execData.executionTimeMs,
              };
            } else {
              const errMsg = data?.error?.message || data?.message || 'Execution Error';
              anyRuntimeError = true;
              return {
                ...tc,
                actualOutput: errMsg,
                passed: false,
                executionTime: 40,
              };
            }
          } catch (err: unknown) {
            anyRuntimeError = true;
            return {
              ...tc,
              actualOutput: err instanceof Error ? err.message : 'Execution Error',
              passed: false,
              executionTime: 40,
            };
          }
        })
      );

      setTestCasesState(updatedCases);

      const allPassed = totalPassed === activeProblem.visibleTestCases.length;
      let statusText = `${totalPassed} / ${activeProblem.visibleTestCases.length} Visible Tests Passed`;
      let compileErrorDetail: string | undefined;
      if (anyCompileError) {
        statusText = 'Compilation Error';
        const failedCompileCase = updatedCases.find(
          (c) => c.actualOutput && (c.actualOutput.includes('error:') || c.actualOutput.includes('Error:'))
        );
        compileErrorDetail = failedCompileCase?.actualOutput;
        if (compileErrorDetail) {
          setCompilerMarkers(compileErrorDetail);
        }
      } else {
        clearCompilerMarkers();
      }
      if (anyTimeout) statusText = 'Execution Timed Out (5.0s Limit)';
      else if (anyRuntimeError) statusText = 'Runtime Error';

      setExecutionStats({
        durationMs: lastExecTime,
        memoryMb: '256 MB Limit',
        exitCode: allPassed ? 0 : 1,
        statusText,
        isSuccess: allPassed,
        errorText: compileErrorDetail || (allPassed ? undefined : statusText),
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  // Submit Solution (Evaluates visible + confidential hidden tests strictly on the server)
  const handleSubmitSolution = async () => {
    clearCompilerMarkers();
    setIsSubmitting(true);
    setActiveBottomTab('submission');

    try {
      const rawCode = codeGetter ? codeGetter() : '';
      const targetToken = interview?.token || interview?.id || roomId;

      const res = await fetch(`/api/interviews/${encodeURIComponent(targetToken)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: rawCode,
          language: selectedLang,
          problemId: activeProblem.id,
        }),
      });

      const payload = await res.json();
      const evalData = payload?.data;

      if (!res.ok || !payload?.success || !evalData) {
        const errMsg = payload?.error || `Submission failed (HTTP ${res.status})`;
        setSubmissionVerdict({
          status: 'RUNTIME_ERROR',
          visiblePassed: 0,
          visibleTotal: activeProblem.visibleTestCases.length,
          hiddenPassed: 0,
          hiddenTotal: activeProblem.hiddenTestCount || 0,
          score: 0,
          runtimeMs: 0,
          memoryMb: '256 MB Limit',
          verdictMessage: errMsg,
        });
        return;
      }

      if (Array.isArray(evalData.visibleCases)) {
        setTestCasesState(evalData.visibleCases);
      }

      const verdict = {
        status: evalData.status as 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR',
        visiblePassed: evalData.visiblePassed,
        visibleTotal: evalData.visibleTotal,
        hiddenPassed: evalData.hiddenPassed,
        hiddenTotal: evalData.hiddenTotal,
        score: evalData.score,
        runtimeMs: evalData.runtimeMs,
        memoryMb: evalData.memoryMb || '256 MB Limit',
        verdictMessage: evalData.verdictMessage,
      };

      setSubmissionVerdict(verdict);

      if (interview) {
        cacheInterviewStatusLocally(interview.id, 'COMPLETED', {
          submittedCode: rawCode,
          language: selectedLang,
          score: verdict.score,
          visiblePassed: verdict.visiblePassed,
          visibleTotal: verdict.visibleTotal,
          hiddenPassed: verdict.hiddenPassed,
          hiddenTotal: verdict.hiddenTotal,
          runtimeMs: verdict.runtimeMs,
          memoryMb: verdict.memoryMb,
          verdict: verdict.status,
          completedAt: evalData.completedAt || new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      setSubmissionVerdict({
        status: 'RUNTIME_ERROR',
        visiblePassed: 0,
        visibleTotal: activeProblem.visibleTestCases.length,
        hiddenPassed: 0,
        hiddenTotal: activeProblem.hiddenTestCount || 0,
        score: 0,
        runtimeMs: 0,
        memoryMb: '256 MB Limit',
        verdictMessage: err instanceof Error ? err.message : 'Submission request failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom Input Runner
  const handleRunCustomInput = async () => {
    setIsRunningCode(true);
    try {
      const rawCode = codeGetter ? codeGetter() : '';
      const driverCode = generateTestDriver(
        rawCode,
        selectedLang,
        activeProblem.id,
        customInputText,
        activeProblem.functionSignature
      );
      const execEndpoint = interview?.token
        ? `/api/interviews/${interview.token}/execute`
        : `${API_BASE_URL}/rooms/${roomId}/execute`;

      const res = await fetch(execEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: driverCode, language: selectedLang }),
      });
      const data = await res.json();
      const ed = data?.data;
      if (ed) {
        const out = ed.stdout
          ? ed.stdout.trim()
          : (ed.stderr || ed.compileError || ed.runtimeError || 'No output produced.');
        setCustomOutput(out);
      } else {
        setCustomOutput(data?.error?.message || 'Execution failed.');
      }
    } catch (err: unknown) {
      setCustomOutput(err instanceof Error ? err.message : 'Execution request failed.');
    } finally {
      setIsRunningCode(false);
    }
  };

  const codeDraftKey = `codesync_code_${sessionPersistenceId}_${activeProblem.id}_${selectedLang}`;
  const defaultTemplate = getStarterTemplate(activeProblem, selectedLang);
  let starterCodeToLoad = defaultTemplate;
  if (typeof window !== 'undefined') {
    try {
      const savedDraft = localStorage.getItem(codeDraftKey);
      if (savedDraft && savedDraft.trim().length > 0) {
        // If cached draft contains legacy hello-world starter code, discard and load real DSA template
        if (!savedDraft.includes('Hello, CodeSync AI!')) {
          starterCodeToLoad = savedDraft;
        }
      }
    } catch (_) {}
  }

  return (
    <div className={`interview-workspace-root ${theme === 'dark' ? 'dark' : 'light'}`}>
      {/* 1. TOP HEADER BAR */}
      <header className="iw-top-bar">
        <div className="iw-top-left">
          <Link href="/interview" className="iw-back-btn" title="Back to Interview Dashboard">
            <ArrowLeft size={15} />
            <span>Exit Assessment</span>
          </Link>

          <span className="iw-divider" />

          {/* Problem Selector (if multiple) */}
          <div className="iw-problem-title-tag">
            {problems.length > 1 ? (
              <select
                value={activeProblemIndex}
                onChange={(e) => handleSwitchProblem(Number(e.target.value))}
                className="wizard-select-sm"
                style={{ fontWeight: 700 }}
              >
                {problems.map((p, i) => (
                  <option key={p.id} value={i}>
                    {i + 1}. {p.title} ({p.difficulty})
                  </option>
                ))}
              </select>
            ) : (
              <>
                <span className="iw-problem-badge">DSA Assessment</span>
                <strong className="iw-problem-name">{activeProblem.title}</strong>
              </>
            )}
            <span className={`iw-difficulty-pill ${activeProblem.difficulty.toLowerCase()}`}>
              {activeProblem.difficulty}
            </span>
          </div>
        </div>

        <div className="iw-top-center">
          <div className={`iw-timer-badge ${timeLeft < 300 ? 'urgent' : ''}`}>
            <Clock size={14} className="animate-pulse" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>

        <div className="iw-top-right">
          {/* Layout Controls */}
          <button
            type="button"
            className="iw-icon-btn"
            onClick={toggleExpandEditor}
            title={isEditorExpanded ? 'Restore Layout' : 'Expand / Maximize Editor'}
          >
            {isEditorExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            type="button"
            className="iw-icon-btn"
            onClick={handleResetLayout}
            title="Reset Default Layout Dimensions"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            className="iw-icon-btn"
            onClick={toggleTheme}
            title="Toggle Light / Dark Theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <span className="iw-divider" />

          {/* Code Execution Controls */}
          <button
            type="button"
            className="iw-btn-secondary"
            onClick={handleRunCode}
            disabled={isRunningCode || isRunningTests || isSubmitting}
            title="Run code in Docker sandbox"
          >
            {isRunningCode ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            <span>Run Code</span>
          </button>

          <button
            type="button"
            className="iw-btn-primary"
            onClick={handleRunTests}
            disabled={isRunningCode || isRunningTests || isSubmitting}
            title="Execute all visible test cases"
          >
            {isRunningTests ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            <span>Run Tests</span>
          </button>

          <button
            type="button"
            className="iw-btn-submit"
            onClick={handleSubmitSolution}
            disabled={isRunningCode || isRunningTests || isSubmitting}
            title="Submit solution to evaluate against full test suite"
          >
            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
            <span>Submit Solution</span>
          </button>

          <span className="iw-divider" />

          <button
            type="button"
            className="iw-btn-report"
            onClick={() => setIsReportOpen(true)}
            title="View Technical Evaluation Report"
          >
            <Award size={15} />
            <span>Finish &amp; Report</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN RESIZABLE WORKSPACE */}
      <div className="iw-main-workspace">
        {/* PANEL 1: PROBLEM STATEMENT (LEFT) */}
        {!isProblemCollapsed && (
          <aside
            className="iw-panel iw-problem-panel"
            style={{ width: `${problemWidth}px` }}
          >
            <div className="iw-panel-header">
              <div className="iw-panel-header-title">
                <BookOpen size={15} className="text-replit-orange" />
                <span>Problem Statement</span>
              </div>
              <button
                type="button"
                className="iw-panel-toggle-btn"
                onClick={() => setIsProblemCollapsed(true)}
                title="Collapse Problem Statement Panel"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>

            <div className="iw-panel-scrollable">
              {/* Problem Title & Badges */}
              <div className="iw-problem-meta-card">
                <h2>{activeProblem.title}</h2>
                <div className="iw-tags-row">
                  <span className={`iw-difficulty-pill ${activeProblem.difficulty.toLowerCase()}`}>
                    {activeProblem.difficulty}
                  </span>
                  <span className="iw-category-pill">{activeProblem.category}</span>
                  <span className="iw-status-pill">Target: {activeProblem.expectedTimeComplexity}</span>
                </div>
              </div>

              {/* Description */}
              <div className="iw-problem-section">
                <h3>Description</h3>
                <p className="iw-description-text">{activeProblem.description}</p>
              </div>

              {/* Formats */}
              <div className="iw-problem-section">
                <h3>Input Format</h3>
                <p className="iw-format-text">{activeProblem.inputFormat}</p>
                <h3 style={{ marginTop: '12px' }}>Output Format</h3>
                <p className="iw-format-text">{activeProblem.outputFormat}</p>
              </div>

              {/* Constraints */}
              <div className="iw-problem-section">
                <h3>Constraints</h3>
                <ul className="iw-constraints-list">
                  {activeProblem.constraints.map((c, i) => (
                    <li key={i}>
                      <code>{c}</code>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Examples */}
              <div className="iw-problem-section">
                <h3>Examples</h3>
                {activeProblem.examples.map((ex, idx) => (
                  <div key={idx} className="iw-example-card">
                    <div className="iw-example-title">Example {idx + 1}:</div>
                    <div className="iw-example-line">
                      <strong>Input:</strong> <code>{ex.input}</code>
                    </div>
                    <div className="iw-example-line">
                      <strong>Output:</strong> <code>{ex.output}</code>
                    </div>
                    {ex.explanation && (
                      <div className="iw-example-line text-muted">
                        <strong>Explanation:</strong> {ex.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Collapsed Left Rail */}
        {isProblemCollapsed && (
          <div
            className="iw-collapsed-rail left"
            onClick={() => setIsProblemCollapsed(false)}
            title="Expand Problem Statement"
          >
            <BookOpen size={15} />
            <span className="iw-rail-text">Problem Statement</span>
            <ChevronRight size={14} />
          </div>
        )}

        {/* SPLITTER 1: DRAGGABLE HORIZONTAL DIVIDER (LEFT) */}
        {!isProblemCollapsed && (
          <div
            className="iw-splitter horizontal"
            onMouseDown={(e) => handleSplitterMouseDown('left', e)}
            title="Drag to resize Problem panel"
          >
            <div className="iw-splitter-handle" />
          </div>
        )}

        {/* CENTER AREA: MONACO EDITOR + TEST CASES PANEL */}
        <main className="iw-center-area">
          {/* MONACO CODE EDITOR CONTAINER */}
          <div className="iw-editor-wrapper">
            {/* Editor Action Bar */}
            <div className="iw-editor-top-bar">
              <div className="iw-editor-tab active">
                <FileCode size={14} className="text-replit-orange" />
                <span>
                  {selectedLang === 'python'
                    ? 'solution.py'
                    : selectedLang === 'cpp'
                    ? 'solution.cpp'
                    : selectedLang === 'java'
                    ? 'Solution.java'
                    : selectedLang === 'javascript'
                    ? 'solution.js'
                    : 'solution.ts'}
                </span>
              </div>

              <div className="iw-editor-tools">
                {/* Permitted Languages Selector */}
                <select
                  value={selectedLang}
                  onChange={(e) => handleLanguageChange(e.target.value as typeof selectedLang)}
                  className="iw-lang-select"
                  title="Switch Programming Language"
                >
                  {permittedLanguages.map((l) => (
                    <option key={l} value={l}>
                      {l === 'cpp'
                        ? 'C++ (gcc)'
                        : l === 'java'
                        ? 'Java 17'
                        : l === 'python'
                        ? 'Python 3'
                        : l === 'javascript'
                        ? 'JavaScript'
                        : 'TypeScript'}
                    </option>
                  ))}
                </select>

                <span className="iw-pill-sync">
                  <span className="sync-dot" /> Auto-saved
                </span>
              </div>
            </div>

            {/* Monaco Editor Mount Point with language-specific starter template */}
            <div className="iw-editor-container">
              {(() => {
                const activeFilename =
                  selectedLang === 'python'
                    ? 'solution.py'
                    : selectedLang === 'cpp'
                    ? 'solution.cpp'
                    : selectedLang === 'java'
                    ? 'Solution.java'
                    : selectedLang === 'javascript'
                    ? 'solution.js'
                    : 'solution.ts';

                return (
                  <RealtimeEditor
                    key={`${roomId}-${activeProblem.id}-${selectedLang}`}
                    roomId={roomId}
                    language={selectedLang}
                    activeFile={activeFilename}
                    primaryFile={activeFilename}
                    role="PARTICIPANT"
                    initialContent={starterCodeToLoad}
                    user={{ id: user?.id || 'candidate', name: user?.name || interview?.candidateName || 'Candidate' }}
                    onCodeGetterInit={(getter) => setCodeGetter(() => getter)}
                    onEditorMount={(editor, monaco) => {
                      editorInstanceRef.current = editor;
                      if (monaco) {
                        monacoInstanceRef.current = monaco;
                        if (monaco?.languages?.typescript) {
                          try {
                            const noDiags = {
                              noSemanticValidation: true,
                              noSyntaxValidation: true,
                              noSuggestionDiagnostics: true,
                            };
                            const noDiagnosticsMode = {
                              diagnostics: false,
                              completionItems: true,
                              hovers: true,
                              documentSymbols: true,
                              definitions: true,
                              references: true,
                              documentHighlights: true,
                              rename: true,
                            };
                            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(noDiags);
                            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(noDiags);
                            monaco.languages.typescript.typescriptDefaults.setModeConfiguration(noDiagnosticsMode);
                            monaco.languages.typescript.javascriptDefaults.setModeConfiguration(noDiagnosticsMode);
                          } catch (_) {}
                        }
                        if (editor && selectedLang !== 'typescript' && selectedLang !== 'javascript') {
                          const model = editor.getModel();
                          if (model) {
                            try {
                              const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                              for (const mk of markers) {
                                if (mk.owner && mk.owner !== 'compiler') {
                                  monaco.editor.setModelMarkers(model, mk.owner, []);
                                }
                              }
                              monaco.editor.setModelMarkers(model, 'typescript', []);
                              monaco.editor.setModelMarkers(model, 'javascript', []);
                              monaco.editor.setModelMarkers(model, 'typescript-language-features', []);
                            } catch (_) {}
                          }
                        }
                      }
                      // Apply starter template or restored draft if editor is empty
                      if (starterCodeToLoad && (!editor.getValue() || editor.getValue().trim() === '')) {
                        editor.setValue(starterCodeToLoad);
                      }
                      editor.onDidChangeModelContent(() => {
                        try {
                          localStorage.setItem(codeDraftKey, editor.getValue());
                          clearCompilerMarkers();
                          if (monacoInstanceRef.current && editorInstanceRef.current && selectedLang !== 'typescript' && selectedLang !== 'javascript') {
                            const m = editorInstanceRef.current.getModel();
                            if (m) {
                              const markers = monacoInstanceRef.current.editor.getModelMarkers({ resource: m.uri });
                              for (const mk of markers) {
                                if (mk.owner && mk.owner !== 'compiler') {
                                  monacoInstanceRef.current.editor.setModelMarkers(m, mk.owner, []);
                                }
                              }
                              monacoInstanceRef.current.editor.setModelMarkers(m, 'typescript', []);
                              monacoInstanceRef.current.editor.setModelMarkers(m, 'javascript', []);
                              monacoInstanceRef.current.editor.setModelMarkers(m, 'typescript-language-features', []);
                            }
                          }
                        } catch (_) {}
                      });
                    }}
                  />
                );
              })()}
            </div>
          </div>

          {/* SPLITTER 3: DRAGGABLE VERTICAL DIVIDER (BOTTOM) */}
          {!isTestCollapsed && (
            <div
              className="iw-splitter vertical"
              onMouseDown={(e) => handleSplitterMouseDown('bottom', e)}
              title="Drag to resize Test Cases drawer"
            >
              <div className="iw-splitter-handle horizontal-bar" />
            </div>
          )}

          {/* BOTTOM DEDICATED TEST CASES PANEL */}
          {!isTestCollapsed ? (
            <section
              className="iw-test-panel"
              style={{ height: `${testHeight}px` }}
            >
              {/* Drawer Tab Headers */}
              <div className="iw-test-tabs-bar">
                <div className="iw-tabs-left">
                  <button
                    type="button"
                    className={`iw-tab-btn ${activeBottomTab === 'cases' ? 'active' : ''}`}
                    onClick={() => setActiveBottomTab('cases')}
                  >
                    <Terminal size={14} />
                    <span>Test Cases</span>
                  </button>

                  <button
                    type="button"
                    className={`iw-tab-btn ${activeBottomTab === 'results' ? 'active' : ''}`}
                    onClick={() => setActiveBottomTab('results')}
                  >
                    <CheckCircle2 size={14} />
                    <span>Test Results</span>
                    {executionStats?.isSuccess && <span className="iw-mini-dot-green" />}
                  </button>

                  <button
                    type="button"
                    className={`iw-tab-btn ${activeBottomTab === 'custom' ? 'active' : ''}`}
                    onClick={() => setActiveBottomTab('custom')}
                  >
                    <CodeXml size={14} />
                    <span>Custom Input</span>
                  </button>

                  <button
                    type="button"
                    className={`iw-tab-btn ${activeBottomTab === 'submission' ? 'active' : ''}`}
                    onClick={() => setActiveBottomTab('submission')}
                  >
                    <ShieldCheck size={14} />
                    <span>Submission Results</span>
                    {submissionVerdict?.status === 'ACCEPTED' && (
                      <span className="iw-badge-score">100%</span>
                    )}
                  </button>
                </div>

                <div className="iw-tabs-right">
                  <button
                    type="button"
                    className="iw-collapse-drawer-btn"
                    onClick={() => setIsTestCollapsed(true)}
                    title="Collapse Test Cases Drawer"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="iw-test-body-scrollable">
                {/* TAB 1: VISIBLE TEST CASES */}
                {activeBottomTab === 'cases' && (
                  <div className="iw-tab-content-cases">
                    <div className="iw-case-pills-row">
                      {testCasesState.map((tc, idx) => (
                        <button
                          key={tc.id}
                          type="button"
                          className={`iw-case-pill ${selectedCaseIndex === idx ? 'active' : ''}`}
                          onClick={() => setSelectedCaseIndex(idx)}
                        >
                          {tc.passed === true ? (
                            <CheckCircle2 size={13} className="text-green-500" />
                          ) : tc.passed === false ? (
                            <XCircle size={13} className="text-red-500" />
                          ) : (
                            <span className="case-dot" />
                          )}
                          <span>Case {tc.id}</span>
                        </button>
                      ))}
                    </div>

                    {testCasesState[selectedCaseIndex] && (
                      <div className="iw-case-details-grid">
                        <div className="iw-case-box">
                          <div className="iw-case-box-label">Input Parameters:</div>
                          <pre className="iw-case-code">
                            {testCasesState[selectedCaseIndex].input}
                          </pre>
                        </div>

                        <div className="iw-case-box">
                          <div className="iw-case-box-label">Expected Output:</div>
                          <pre className="iw-case-code">
                            {testCasesState[selectedCaseIndex].expectedOutput}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: TEST RESULTS & RUN SUMMARY */}
                {activeBottomTab === 'results' && (
                  <div className="iw-tab-content-results">
                    {executionStats ? (
                      <div>
                        <div className="iw-results-summary-bar">
                          <div className="iw-summary-status">
                            {executionStats.isSuccess ? (
                              <span className="status-accepted">
                                <CheckCircle2 size={16} /> All Tests Passed
                              </span>
                            ) : (
                              <span className="status-failed">
                                <AlertCircle size={16} /> {executionStats.statusText || 'Tests Failed'}
                              </span>
                            )}
                          </div>

                          <div className="iw-summary-metrics">
                            <span>Runtime: <strong>{executionStats.durationMs}ms</strong></span>
                            <span>Memory: <strong>{executionStats.memoryMb}</strong></span>
                            <span>Exit Code: <strong>{executionStats.exitCode}</strong></span>
                          </div>
                        </div>

                        {executionStats.errorText && (
                          <div className="iw-error-trace-box">
                            <div className="error-header">Runtime / Compilation Output:</div>
                            <pre>{executionStats.errorText}</pre>
                          </div>
                        )}

                        <div className="iw-results-cases-list">
                          {testCasesState.map((tc) => (
                            <div
                              key={tc.id}
                              className={`iw-result-card ${tc.passed ? 'passed' : 'failed'}`}
                            >
                              <div className="iw-result-card-header">
                                <div className="card-title">
                                  {tc.passed ? (
                                    <CheckCircle2 size={15} color="#10b981" />
                                  ) : (
                                    <XCircle size={15} color="#ef4444" />
                                  )}
                                  <strong>Test Case {tc.id}</strong>
                                </div>
                                <span className="card-time">{tc.executionTime || 35}ms</span>
                              </div>

                              <div className="iw-result-grid">
                                <div>
                                  <span className="label">Input:</span>
                                  <code>{tc.input}</code>
                                </div>
                                <div>
                                  <span className="label">Expected:</span>
                                  <code>{tc.expectedOutput}</code>
                                </div>
                                <div>
                                  <span className="label">Actual:</span>
                                  <code className={tc.passed ? 'text-green' : 'text-red'}>
                                    {tc.actualOutput || 'Pending'}
                                  </code>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="iw-empty-state">
                        <Terminal size={28} className="text-text-muted mb-2" />
                        <p>No test results yet. Click <strong>Run Tests</strong> or <strong>Run Code</strong> above to execute.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: CUSTOM INPUT */}
                {activeBottomTab === 'custom' && (
                  <div className="iw-tab-content-custom">
                    <div className="iw-custom-grid">
                      <div className="iw-custom-input-col">
                        <div className="col-label">Enter Custom Arguments:</div>
                        <textarea
                          value={customInputText}
                          onChange={(e) => setCustomInputText(e.target.value)}
                          placeholder="e.g. nums = [2, 7, 11, 15], target = 9"
                          className="iw-custom-textarea"
                        />
                        <button
                          type="button"
                          className="iw-btn-secondary"
                          onClick={handleRunCustomInput}
                          disabled={isRunningCode}
                          style={{ marginTop: '8px' }}
                        >
                          {isRunningCode ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                          <span>Execute Custom Input</span>
                        </button>
                      </div>

                      <div className="iw-custom-output-col">
                        <div className="col-label">Execution Output (stdout / stderr):</div>
                        <pre className="iw-custom-output-pre">
                          {customOutput || 'Ready. Click Execute Custom Input to run your code in Docker sandbox.'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: SUBMISSION RESULTS & HIDDEN TESTS */}
                {activeBottomTab === 'submission' && (
                  <div className="iw-tab-content-submission">
                    {submissionVerdict ? (
                      <div className="iw-submission-card">
                        <div className="iw-submission-banner">
                          <div className="banner-left">
                            <span className="verdict-icon">
                              <CheckCircle size={28} color="#10b981" />
                            </span>
                            <div>
                              <h2>{submissionVerdict.status}</h2>
                              <p>{submissionVerdict.verdictMessage}</p>
                            </div>
                          </div>
                          <div className="banner-score">
                            <span className="score-val">{submissionVerdict.score}</span>
                            <span className="score-max">/ 100</span>
                          </div>
                        </div>

                        <div className="iw-submission-metrics-grid">
                          <div className="metric-box">
                            <span className="m-label">Visible Tests Passed</span>
                            <strong className="m-val green">
                              {submissionVerdict.visiblePassed} / {submissionVerdict.visibleTotal}
                            </strong>
                          </div>

                          <div className="metric-box">
                            <span className="m-label">Hidden Tests Passed</span>
                            <strong className="m-val green">
                              {submissionVerdict.hiddenPassed} / {submissionVerdict.hiddenTotal}
                            </strong>
                            <span className="m-subtext">Confidentiality Protected</span>
                          </div>

                          <div className="metric-box">
                            <span className="m-label">Time Complexity</span>
                            <strong className="m-val">{activeProblem.expectedTimeComplexity}</strong>
                            <span className="m-subtext">Optimal asymptotic bound</span>
                          </div>

                          <div className="metric-box">
                            <span className="m-label">Space Complexity</span>
                            <strong className="m-val">{activeProblem.expectedSpaceComplexity}</strong>
                            <span className="m-subtext">Auxiliary memory</span>
                          </div>
                        </div>

                        <div className="iw-submission-footer">
                          <button
                            type="button"
                            className="iw-btn-report wide"
                            onClick={() => setIsReportOpen(true)}
                          >
                            <Award size={16} />
                            <span>View Full Technical Evaluation Report</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="iw-empty-state">
                        <ShieldCheck size={28} className="text-text-muted mb-2" />
                        <p>Click <strong>Submit Solution</strong> to evaluate both visible and hidden test suites.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div
              className="iw-collapsed-rail bottom"
              onClick={() => setIsTestCollapsed(false)}
              title="Expand Test Cases Panel"
            >
              <Terminal size={14} />
              <span className="iw-rail-text">Test Cases &amp; Results</span>
              <ChevronUp size={14} />
            </div>
          )}
        </main>

        {/* SPLITTER 2: DRAGGABLE HORIZONTAL DIVIDER (RIGHT) */}
        {!isAiCollapsed && (
          <div
            className="iw-splitter horizontal"
            onMouseDown={(e) => handleSplitterMouseDown('right', e)}
            title="Drag to resize AI Interviewer panel"
          >
            <div className="iw-splitter-handle" />
          </div>
        )}

        {/* PANEL 3: AI INTERVIEWER PROCTOR (RIGHT) */}
        {!isAiCollapsed && (
          <aside
            className="iw-panel iw-ai-panel"
            style={{ width: `${aiWidth}px` }}
          >
            <div className="iw-panel-header">
              <div className="iw-panel-header-title">
                <span className="iw-ai-orb">
                  <Bot size={15} color="#ff5c00" />
                </span>
                <div>
                  <span className="font-bold">AI Interviewer</span>
                  <span className="iw-proctor-active-dot">● Live Proctor</span>
                </div>
              </div>
              <button
                type="button"
                className="iw-panel-toggle-btn"
                onClick={() => setIsAiCollapsed(true)}
                title="Collapse AI Interviewer Panel"
              >
                <PanelRightClose size={15} />
              </button>
            </div>

            <div className="iw-ai-messages-stream">
              {messages.map((m, idx) => (
                <div key={idx} className={`iw-message-bubble-row ${m.role}`}>
                  <span className={`iw-msg-avatar ${m.role === 'ai' ? 'ai' : 'user'}`}>
                    {m.role === 'ai' ? 'AI' : 'YOU'}
                  </span>
                  <div className="iw-msg-card">
                    <div className="iw-msg-content">{m.text}</div>
                    <span className="iw-msg-time">{m.time}</span>
                  </div>
                </div>
              ))}

              {isAiThinking && (
                <div className="iw-ai-thinking-row">
                  <Loader2 size={13} className="animate-spin text-replit-orange" />
                  <span>Interviewer is analyzing your response...</span>
                </div>
              )}
            </div>

            <div className="iw-ai-chips-bar">
              <button
                type="button"
                onClick={() => handleSendMessage(`Can we discuss the optimal Time and Space complexity for ${activeProblem.title}?`)}
                className="iw-chip"
              >
                ⏱️ Time / Space Big-O
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('What edge cases should I consider?')}
                className="iw-chip"
              >
                🧪 Edge Cases
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Can you evaluate my current code quality and structure?')}
                className="iw-chip"
              >
                ⚡ Code Quality
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="iw-ai-input-form"
            >
              <input
                type="text"
                placeholder="Explain approach to interviewer..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="iw-ai-input"
              />
              <button
                type="submit"
                disabled={isAiThinking || !inputText.trim()}
                className="iw-ai-send-btn"
                title="Send explanation to interviewer"
              >
                <Send size={14} />
              </button>
            </form>
          </aside>
        )}

        {/* Collapsed Right Rail */}
        {isAiCollapsed && (
          <div
            className="iw-collapsed-rail right"
            onClick={() => setIsAiCollapsed(false)}
            title="Expand AI Interviewer Panel"
          >
            <Bot size={15} />
            <span className="iw-rail-text">AI Interviewer</span>
            <ChevronLeft size={14} />
          </div>
        )}
      </div>

      {/* 3. EVALUATION REPORT MODAL */}
      {isReportOpen && (
        <div className="modal-backdrop" onClick={() => setIsReportOpen(false)}>
          <div className="modal-card iw-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={22} color="#ff5c00" />
                <h3>CodeSync AI Technical Evaluation Report</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsReportOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="iw-report-body">
              {(() => {
                const effectiveSub = submissionVerdict || (interview?.submission ? {
                  status: interview.submission.verdict,
                  visiblePassed: interview.submission.visiblePassed,
                  visibleTotal: interview.submission.visibleTotal,
                  hiddenPassed: interview.submission.hiddenPassed,
                  hiddenTotal: interview.submission.hiddenTotal,
                  score: interview.submission.score,
                  runtimeMs: interview.submission.runtimeMs,
                } : null);
                const computedScore = effectiveSub?.score ?? 0;
                const finalVerdict = !effectiveSub
                  ? 'Not Submitted'
                  : computedScore >= 85
                  ? 'Strong Hire'
                  : computedScore >= 65
                  ? 'Hire'
                  : computedScore >= 40
                  ? 'Borderline'
                  : 'No Hire';
                const userTurns = messages.filter((m) => m.role === 'user').length;
                return (
                  <>
                    <div className="iw-report-stats-grid">
                      <div className="report-stat-card">
                        <span className="lbl">TECHNICAL SCORE</span>
                        <strong className="val text-replit-orange">{computedScore} / 100</strong>
                      </div>
                      <div className="report-stat-card">
                        <span className="lbl">TARGET COMPLEXITY</span>
                        <strong className="val">{activeProblem.expectedTimeComplexity}</strong>
                      </div>
                      <div className="report-stat-card">
                        <span className="lbl">FINAL VERDICT</span>
                        <strong
                          className={`val ${
                            computedScore >= 65 ? 'text-green-500' : 'text-amber-400'
                          }`}
                        >
                          {finalVerdict}
                        </strong>
                      </div>
                    </div>

                    <div className="iw-report-section">
                      <h4>Observed Execution &amp; Assessment Summary</h4>
                      <ul className="iw-report-bullets">
                        {effectiveSub ? (
                          <>
                            <li>
                              Visible tests passed: {effectiveSub.visiblePassed} / {effectiveSub.visibleTotal}.
                            </li>
                            <li>
                              Confidential hidden tests passed: {effectiveSub.hiddenPassed} / {effectiveSub.hiddenTotal}.
                            </li>
                            <li>
                              Language used: {selectedLang.toUpperCase()} (avg runtime: {effectiveSub.runtimeMs} ms).
                            </li>
                          </>
                        ) : (
                          <li>No final solution has been submitted yet. Click Submit Solution to evaluate tests.</li>
                        )}
                        <li>
                          Candidate technical discussion turns logged: {userTurns}.
                        </li>
                      </ul>
                    </div>

                    <div className="iw-report-section">
                      <h4>Recommendation</h4>
                      <p className="iw-report-text">
                        {!effectiveSub
                          ? 'Submit your solution against visible and confidential hidden test cases to generate a verified technical evaluation.'
                          : computedScore === 100
                          ? `Passed all ${effectiveSub.visibleTotal} visible and ${effectiveSub.hiddenTotal} hidden test cases (${computedScore}/100).`
                          : `Score ${computedScore}/100 (${effectiveSub.visiblePassed}/${effectiveSub.visibleTotal} visible, ${effectiveSub.hiddenPassed}/${effectiveSub.hiddenTotal} hidden passed). Review failed edge cases and boundary handling.`}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="iw-btn-secondary"
                onClick={() => setIsReportOpen(false)}
              >
                Continue Practice
              </button>
              {interview?.id ? (
                <Link
                  href={`/interview/${interview.id}/report`}
                  className="app-button"
                  style={{ textDecoration: 'none' }}
                >
                  View Full HR Report
                </Link>
              ) : (
                <Link href="/interview" className="app-button" style={{ textDecoration: 'none' }}>
                  Return to Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
