'use client';

import React, { useState, useEffect } from 'react';
import {
  QUESTION_LIBRARY,
  ProblemDefinition,
  TestCaseItem,
  InterviewItem,
  cacheInterviewLocally,
  inferProblemSignature,
  generateStarterTemplates,
  titleToMethodName,
  FunctionSignature,
  FunctionParameter,
} from '../../lib/interview-service';
import {
  X,
  Check,
  Plus,
  Trash2,
  BookOpen,
  Code2,
  Bot,
  Settings,
  Sparkles,
  Link2,
  Copy,
  Mail,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';

interface CreateInterviewWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onInterviewCreated: (interview: InterviewItem) => void;
  initialProblem?: ProblemDefinition | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export function CreateInterviewWizard({
  isOpen,
  onClose,
  onInterviewCreated,
  initialProblem,
}: CreateInterviewWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Interview Details
  const [title, setTitle] = useState('SDE II — Technical Coding Assessment');
  const [role, setRole] = useState<'SDE' | 'Frontend Developer' | 'Backend Developer' | 'Full Stack Developer'>('SDE');
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'Junior (0-2 yrs)' | 'Mid-level (2-5 yrs)' | 'Senior (5+ yrs)'>('Mid-level (2-5 yrs)');
  const [interviewType, setInterviewType] = useState<'DSA' | 'Frontend' | 'Backend' | 'Full Stack'>('DSA');
  const [duration, setDuration] = useState(45);
  const [scheduledDate, setScheduledDate] = useState('2026-11-15T15:00');
  const [instructions, setInstructions] = useState(
    'Please explain your approach and discuss Big-O complexity with the AI Interviewer before writing your optimal solution.'
  );

  // Step 2: Problem Configuration
  const [problemSourceTab, setProblemSourceTab] = useState<'library' | 'custom'>('library');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('All');
  const [selectedProblems, setSelectedProblems] = useState<ProblemDefinition[]>([QUESTION_LIBRARY[0]]);

  // Custom Problem Form
  const [customTitle, setCustomTitle] = useState('');
  const [customDifficulty, setCustomDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [customCategory, setCustomCategory] = useState('Algorithms & Data Structures');
  const [customDescription, setCustomDescription] = useState('');
  const [customInputFormat, setCustomInputFormat] = useState('Input arguments / data structure');
  const [customOutputFormat, setCustomOutputFormat] = useState('Return value / formatted output');
  const [customConstraints, setCustomConstraints] = useState('1 <= n <= 10^5');
  const [customInputExample, setCustomInputExample] = useState('');
  const [customOutputExample, setCustomOutputExample] = useState('');
  const [customExplanation, setCustomExplanation] = useState('');
  const [customVisibleTestInput, setCustomVisibleTestInput] = useState('');
  const [customVisibleTestOutput, setCustomVisibleTestOutput] = useState('');
  const [customHiddenTestInput, setCustomHiddenTestInput] = useState('');
  const [customHiddenTestOutput, setCustomHiddenTestOutput] = useState('');
  const [customTimeComplexity, setCustomTimeComplexity] = useState('O(n)');
  const [customSpaceComplexity, setCustomSpaceComplexity] = useState('O(1)');
  const [customFunctionName, setCustomFunctionName] = useState('');
  const [customParams, setCustomParams] = useState('');
  const [customReturnType, setCustomReturnType] = useState('');
  const [customStarterCode, setCustomStarterCode] = useState('');

  // Step 3: Permitted Languages
  const [permittedLanguages, setPermittedLanguages] = useState<
    Array<'cpp' | 'java' | 'python' | 'javascript' | 'typescript'>
  >(['typescript', 'python', 'java', 'cpp', 'javascript']);
  const [defaultLanguage, setDefaultLanguage] = useState<'cpp' | 'java' | 'python' | 'javascript' | 'typescript'>('typescript');

  // Step 4: AI Interviewer Configuration
  const [enableAi, setEnableAi] = useState(true);
  const [followUpQuestions, setFollowUpQuestions] = useState(true);
  const [allowHints, setAllowHints] = useState(true);
  const [allowAssistance, setAllowAssistance] = useState(true);
  const [requireApproachExplanation, setRequireApproachExplanation] = useState(true);
  const [enableExecution, setEnableExecution] = useState(true);
  const [enableVideoProctor, setEnableVideoProctor] = useState(true);
  const [evaluationCriteria, setEvaluationCriteria] = useState<string[]>([
    'Algorithmic Efficiency',
    'Code Cleanliness',
    'Edge Case Handling',
    'Technical Communication',
  ]);

  // Success Created View
  const [createdInterview, setCreatedInterview] = useState<InterviewItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize wizard with selected initialProblem whenever opened
  useEffect(() => {
    if (isOpen) {
      if (initialProblem) {
        setSelectedProblems([initialProblem]);
        setTitle(`${initialProblem.title} — Technical Assessment`);
      } else {
        setSelectedProblems([QUESTION_LIBRARY[0]]);
        setTitle('SDE II — Technical Coding Assessment');
      }
      setStep(1);
      setCreatedInterview(null);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialProblem]);

  if (!isOpen) return null;

  // Toggle Language Checkbox
  const toggleLanguage = (lang: 'cpp' | 'java' | 'python' | 'javascript' | 'typescript') => {
    if (permittedLanguages.includes(lang)) {
      if (permittedLanguages.length > 1) {
        const next = permittedLanguages.filter((l) => l !== lang);
        setPermittedLanguages(next);
        if (defaultLanguage === lang) {
          setDefaultLanguage(next[0]);
        }
      }
    } else {
      setPermittedLanguages([...permittedLanguages, lang]);
    }
  };

  // Helper to build a clean ProblemDefinition from the custom problem inputs
  const buildCustomProblem = (): ProblemDefinition | null => {
    if (!customTitle.trim() || !customDescription.trim()) return null;

    const cleanTitle = customTitle.trim();
    const id = `q-custom-${Date.now()}`;

    const visibleTestCases: TestCaseItem[] = [
      {
        id: 1,
        input: customVisibleTestInput.trim() || customInputExample.trim() || 'Sample Input 1',
        expectedOutput: customVisibleTestOutput.trim() || customOutputExample.trim() || 'Sample Output 1',
      },
    ];

    const hiddenTestCases: TestCaseItem[] = [];
    if (customHiddenTestInput.trim() || customHiddenTestOutput.trim()) {
      hiddenTestCases.push({
        id: 2,
        input: customHiddenTestInput.trim() || 'Hidden Test Input',
        expectedOutput: customHiddenTestOutput.trim() || 'Hidden Test Output',
      });
    }

    const draftProb: Partial<ProblemDefinition> & { title: string } = {
      title: cleanTitle,
      category: customCategory.trim() || 'Custom Problem',
      description: customDescription.trim(),
      inputFormat: customInputFormat.trim(),
      outputFormat: customOutputFormat.trim(),
      examples: [
        {
          input: customInputExample.trim() || 'Sample input',
          output: customOutputExample.trim() || 'Sample output',
          explanation: customExplanation.trim() || undefined,
        },
      ],
      visibleTestCases,
    };

    // Infer function signature from metadata and HR inputs
    const signature = inferProblemSignature(draftProb);
    if (customFunctionName.trim()) {
      signature.functionName = customFunctionName.trim();
    }
    if (customReturnType.trim()) {
      signature.returnType = customReturnType.trim();
    }
    if (customParams.trim()) {
      const parsedParams = customParams.split(',').map((p) => {
        const parts = p.trim().split(/[:\s]+/);
        if (parts.length >= 2) {
          return { name: parts[0], type: parts[1] };
        }
        return { name: parts[0], type: 'int[]' };
      }).filter((p) => p.name.length > 0);
      if (parsedParams.length > 0) {
        signature.parameters = parsedParams;
      }
    }

    // Generate starter templates for all 5 languages with full parameterized signatures
    const starterTemplates = generateStarterTemplates(signature, cleanTitle);

    // If HR provided explicit custom starter code, preserve it for the active default language
    if (customStarterCode.trim()) {
      starterTemplates[defaultLanguage] = customStarterCode.trim();
    }

    return {
      id,
      title: cleanTitle,
      difficulty: customDifficulty,
      category: customCategory.trim() || 'Custom Problem',
      description: customDescription.trim(),
      inputFormat: customInputFormat.trim() || 'Input parameters',
      outputFormat: customOutputFormat.trim() || 'Return value',
      constraints: customConstraints.split('\n').map((l) => l.trim()).filter(Boolean),
      examples: [
        {
          input: customInputExample.trim() || 'Sample input',
          output: customOutputExample.trim() || 'Sample output',
          explanation: customExplanation.trim() || undefined,
        },
      ],
      visibleTestCases,
      hiddenTestCases,
      hiddenTestCount: hiddenTestCases.length > 0 ? hiddenTestCases.length : 3,
      expectedTimeComplexity: customTimeComplexity.trim() || 'O(n)',
      expectedSpaceComplexity: customSpaceComplexity.trim() || 'O(1)',
      marks: 100,
      functionSignature: signature,
      starterTemplates,
    };
  };

  // Auto-commit custom problem form if user entered data without clicking manual add button
  const ensureCustomProblemCommitted = (): ProblemDefinition[] => {
    let currentProblems = [...selectedProblems];
    if (problemSourceTab === 'custom' && customTitle.trim() && customDescription.trim()) {
      const customProb = buildCustomProblem();
      if (customProb) {
        // If current selection is only the initial default Two Sum, replace it completely!
        const isOnlyDefaultTwoSum =
          currentProblems.length === 1 && currentProblems[0].id === 'q-two-sum';
        if (isOnlyDefaultTwoSum) {
          currentProblems = [customProb];
        } else {
          // If already added, update it, otherwise prepend so custom problem is primary
          const existingIdx = currentProblems.findIndex(
            (p) => p.id === customProb.id || p.title.toLowerCase() === customProb.title.toLowerCase()
          );
          if (existingIdx >= 0) {
            currentProblems[existingIdx] = customProb;
          } else {
            currentProblems = [customProb, ...currentProblems.filter((p) => p.id !== 'q-two-sum')];
          }
        }
        setSelectedProblems(currentProblems);
      }
    }
    return currentProblems;
  };

  // Add Custom Problem to list
  const handleAddCustomProblem = () => {
    const newProblem = buildCustomProblem();
    if (!newProblem) return;

    // If currently selectedProblems only has default Two Sum, replace it with the new custom problem!
    const isOnlyDefaultTwoSum =
      selectedProblems.length === 1 && selectedProblems[0].id === 'q-two-sum';

    if (isOnlyDefaultTwoSum) {
      setSelectedProblems([newProblem]);
    } else {
      setSelectedProblems([newProblem, ...selectedProblems.filter((p) => p.id !== 'q-two-sum')]);
    }

    // Reset inputs
    setCustomTitle('');
    setCustomDescription('');
    setCustomInputExample('');
    setCustomOutputExample('');
    setCustomExplanation('');
    setCustomVisibleTestInput('');
    setCustomVisibleTestOutput('');
    setCustomHiddenTestInput('');
    setCustomHiddenTestOutput('');
    setCustomFunctionName('');
    setCustomParams('');
    setCustomReturnType('');
    setCustomStarterCode('');
  };

  // Save & Finalize Interview
  const handleFinalizeInterview = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Ensure custom problem input is committed
      const activeProblems = ensureCustomProblemCommitted();
      if (activeProblems.length === 0) {
        setErrorMsg('Please select at least one coding problem from the library or create a custom problem.');
        setIsSubmitting(false);
        return;
      }
      const finalProblems = activeProblems;

      const payload = {
        title: title.trim(),
        role,
        candidateName: candidateName.trim() || 'Candidate',
        candidateEmail: candidateEmail.trim() || 'candidate@example.com',
        experienceLevel,
        interviewType,
        difficulty: finalProblems[0]?.difficulty || 'Medium',
        duration,
        scheduledDate,
        instructions,
        permittedLanguages,
        defaultLanguage,
        problems: finalProblems,
        aiSettings: {
          enableAi,
          followUpQuestions,
          allowHints,
          allowAssistance,
          requireApproachExplanation,
          enableExecution,
          enableVideoProctor,
          evaluationCriteria,
        },
      };

      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !body?.data) {
        setErrorMsg(
          body?.error || (res.status === 401 ? 'Please log in as an interviewer to create interviews.' : 'Failed to create interview')
        );
        return;
      }

      const createdFromServer: InterviewItem = body.data;
      cacheInterviewLocally(createdFromServer);
      setCreatedInterview(createdFromServer);
      onInterviewCreated(createdFromServer);
    } catch {
      setErrorMsg('Failed to connect to the interview creation service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const invitationUrl = typeof window !== 'undefined' && createdInterview
    ? `${window.location.origin}/interview/join/${createdInterview.token}`
    : '';

  const handleCopyLink = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card iw-wizard-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Wizard Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="iw-ai-orb">
              <Bot size={16} color="#ff5c00" />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {createdInterview ? 'Interview Created Successfully' : 'Configure New AI Interview'}
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                {createdInterview
                  ? 'Share the unique invitation link with the candidate.'
                  : 'Multi-section technical interview and coding problem configuration.'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Step Indicator Tabs (if not yet created) */}
        {!createdInterview && (
          <div className="iw-wizard-steps-bar">
            <button
              type="button"
              className={`wizard-step-tab ${step === 1 ? 'active' : ''}`}
              onClick={() => setStep(1)}
            >
              <User size={13} />
              <span>1. Details</span>
            </button>
            <button
              type="button"
              className={`wizard-step-tab ${step === 2 ? 'active' : ''}`}
              onClick={() => setStep(2)}
            >
              <BookOpen size={13} />
              <span>2. Problems ({selectedProblems.length})</span>
            </button>
            <button
              type="button"
              className={`wizard-step-tab ${step === 3 ? 'active' : ''}`}
              onClick={() => setStep(3)}
            >
              <Code2 size={13} />
              <span>3. Languages ({permittedLanguages.length})</span>
            </button>
            <button
              type="button"
              className={`wizard-step-tab ${step === 4 ? 'active' : ''}`}
              onClick={() => setStep(4)}
            >
              <Sparkles size={13} />
              <span>4. AI Settings</span>
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          {/* SUCCESS SCREEN */}
          {createdInterview ? (
            <div className="iw-success-screen">
              <div className="iw-success-icon-wrap">
                <Check size={36} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '8px 0 4px', textAlign: 'center' }}>
                Interview Ready &amp; Scheduled!
              </h2>
              <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 20px' }}>
                A dedicated candidate interview workspace has been provisioned with the configured problems, language templates, and AI proctor.
              </p>

              {/* Shareable Link Box */}
              <div className="iw-share-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Link2 size={15} color="#ff5c00" />
                  <strong style={{ fontSize: '12px' }}>Candidate Shareable Invitation Link:</strong>
                </div>
                <div className="iw-share-input-row">
                  <input
                    type="text"
                    readOnly
                    value={invitationUrl}
                    className="iw-share-input"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="iw-btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Summary Details */}
              <div className="iw-summary-grid">
                <div>
                  <span className="lbl">Candidate</span>
                  <strong>{createdInterview.candidateName}</strong>
                  <small>{createdInterview.candidateEmail}</small>
                </div>
                <div>
                  <span className="lbl">Role &amp; Difficulty</span>
                  <strong>{createdInterview.role}</strong>
                  <small>{createdInterview.difficulty} Level</small>
                </div>
                <div>
                  <span className="lbl">Duration</span>
                  <strong>{createdInterview.duration} Minutes</strong>
                  <small>Timed Assessment</small>
                </div>
                <div>
                  <span className="lbl">Assigned Problems</span>
                  <strong>{createdInterview.problems.length} Problem(s)</strong>
                  <small>{createdInterview.problems.map((p) => p.title).join(', ')}</small>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: INTERVIEW DETAILS */}
              {step === 1 && (
                <div className="wizard-step-content">
                  <div className="form-group-grid">
                    <div className="form-field full">
                      <label>Interview Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. SDE II — Algorithms & Data Structures Assessment"
                        className="wizard-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Target Job Role *</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as typeof role)}
                        className="wizard-select"
                      >
                        <option value="SDE">SDE</option>
                        <option value="Frontend Developer">Frontend Developer</option>
                        <option value="Backend Developer">Backend Developer</option>
                        <option value="Full Stack Developer">Full Stack Developer</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Candidate Experience Level</label>
                      <select
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value as typeof experienceLevel)}
                        className="wizard-select"
                      >
                        <option value="Junior (0-2 yrs)">Junior (0-2 yrs)</option>
                        <option value="Mid-level (2-5 yrs)">Mid-level (2-5 yrs)</option>
                        <option value="Senior (5+ yrs)">Senior (5+ yrs)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Candidate Full Name *</label>
                      <input
                        type="text"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="e.g. Prakash Sharma"
                        className="wizard-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Candidate Email *</label>
                      <input
                        type="email"
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        placeholder="e.g. candidate@example.com"
                        className="wizard-input"
                      />
                    </div>

                    <div className="form-field">
                      <label>Interview Duration</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="wizard-select"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes (Standard)</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes (Deep Dive)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Scheduled Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="wizard-input"
                      />
                    </div>

                    <div className="form-field full">
                      <label>Candidate Instructions</label>
                      <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        rows={2}
                        className="wizard-textarea"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: PROBLEM CONFIGURATION */}
              {step === 2 && (
                <div className="wizard-step-content">
                  {/* Selected Problems Bar */}
                  <div className="iw-selected-bar">
                    <span className="font-bold text-xs">Assigned Problems ({selectedProblems.length}):</span>
                    <div className="iw-assigned-chips">
                      {selectedProblems.length === 0 ? (
                        <span className="text-xs text-text-muted italic">No problem selected yet. Please select at least one problem below.</span>
                      ) : (
                        selectedProblems.map((p, idx) => (
                          <span key={p.id} className="iw-assigned-chip">
                            <span
                              onClick={() => {
                                if (idx > 0) {
                                  setSelectedProblems([
                                    p,
                                    ...selectedProblems.filter((_, i) => i !== idx),
                                  ]);
                                }
                              }}
                              style={{ cursor: idx > 0 ? 'pointer' : 'default' }}
                              title={idx === 0 ? 'Primary Interview Problem' : 'Click to make Primary'}
                            >
                              {idx === 0 ? `★ ${p.title} (Primary)` : p.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProblems(selectedProblems.filter((_, i) => i !== idx));
                              }}
                              title="Remove Question"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Tabs: Library vs Custom */}
                  <div className="iw-sub-tabs">
                    <button
                      type="button"
                      className={`iw-sub-tab-btn ${problemSourceTab === 'library' ? 'active' : ''}`}
                      onClick={() => setProblemSourceTab('library')}
                    >
                      <BookOpen size={13} />
                      <span>Select from Question Library</span>
                    </button>
                    <button
                      type="button"
                      className={`iw-sub-tab-btn ${problemSourceTab === 'custom' ? 'active' : ''}`}
                      onClick={() => setProblemSourceTab('custom')}
                    >
                      <Plus size={13} />
                      <span>Create Custom Problem</span>
                    </button>
                  </div>

                  {problemSourceTab === 'library' ? (
                    <div>
                      {/* Search & Filter */}
                      <div className="iw-filter-row">
                        <div className="iw-search-box">
                          <Search size={14} className="text-text-muted" />
                          <input
                            type="text"
                            placeholder="Search problems by title or topic..."
                            value={librarySearch}
                            onChange={(e) => setLibrarySearch(e.target.value)}
                            className="iw-filter-input"
                          />
                        </div>

                        <select
                          value={libraryCategory}
                          onChange={(e) => setLibraryCategory(e.target.value)}
                          className="wizard-select-sm"
                        >
                          <option value="All">All Categories</option>
                          <option value="Arrays & Hash Maps">Arrays &amp; Hash Maps</option>
                          <option value="Strings & Sliding Window">Strings &amp; Sliding Window</option>
                          <option value="Stacks">Stacks</option>
                          <option value="Graphs & BFS/DFS">Graphs</option>
                        </select>
                      </div>

                      {/* Question Library Grid */}
                      <div className="iw-questions-grid">
                        {QUESTION_LIBRARY.filter((q) => {
                          const matchesCat = libraryCategory === 'All' || q.category === libraryCategory;
                          const matchesSearch =
                            q.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
                            q.category.toLowerCase().includes(librarySearch.toLowerCase());
                          return matchesCat && matchesSearch;
                        }).map((q) => {
                          const isSelected = selectedProblems.some((p) => p.id === q.id);
                          return (
                            <div
                              key={q.id}
                              className={`iw-question-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedProblems(selectedProblems.filter((p) => p.id !== q.id));
                                } else {
                                  const isOnlyDefaultTwoSum =
                                    selectedProblems.length === 1 && selectedProblems[0].id === 'q-two-sum';
                                  if (isOnlyDefaultTwoSum && q.id !== 'q-two-sum') {
                                    setSelectedProblems([q]);
                                  } else if (selectedProblems.length < 5) {
                                    setSelectedProblems([...selectedProblems, q]);
                                  }
                                }
                              }}
                            >
                              <div className="iw-q-head">
                                <strong>{q.title}</strong>
                                <span className={`iw-difficulty-pill ${q.difficulty.toLowerCase()}`}>
                                  {q.difficulty}
                                </span>
                              </div>
                              <p className="iw-q-desc">{q.description.slice(0, 110)}...</p>
                              <div className="iw-q-foot">
                                <span className="cat">{q.category}</span>
                                <span className={`select-action ${isSelected ? 'selected' : ''}`}>
                                  {isSelected ? '✓ Selected' : '+ Add to Interview'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* CUSTOM PROBLEM FORM */
                    <div className="iw-custom-problem-form">
                      <div className="form-group-grid">
                        <div className="form-field full">
                          <label>Problem Title *</label>
                          <input
                            type="text"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="e.g. Find First and Last Position of Element in Sorted Array"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Difficulty</label>
                          <select
                            value={customDifficulty}
                            onChange={(e) => setCustomDifficulty(e.target.value as typeof customDifficulty)}
                            className="wizard-select"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label>Category / Topic</label>
                          <select
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            className="wizard-select"
                          >
                            <option value="Algorithms & Data Structures">Algorithms & Data Structures</option>
                            <option value="Dynamic Programming">Dynamic Programming</option>
                            <option value="Linked Lists">Linked Lists</option>
                            <option value="Arrays & Hash Maps">Arrays & Hash Maps</option>
                            <option value="Trees & Graphs">Trees & Graphs</option>
                            <option value="Strings & Sliding Window">Strings & Sliding Window</option>
                            <option value="Sorting & Searching">Sorting & Searching</option>
                            <option value="Custom Problem">General Coding Problem</option>
                          </select>
                        </div>

                        <div className="form-field full">
                          <label>Problem Statement / Description *</label>
                          <textarea
                            value={customDescription}
                            onChange={(e) => setCustomDescription(e.target.value)}
                            placeholder="Detailed description of the problem, algorithmic task, and requirements..."
                            rows={3}
                            className="wizard-textarea"
                          />
                        </div>

                        <div className="form-field">
                          <label>Input Format</label>
                          <input
                            type="text"
                            value={customInputFormat}
                            onChange={(e) => setCustomInputFormat(e.target.value)}
                            placeholder="e.g. head = ListNode head node"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Output Format</label>
                          <input
                            type="text"
                            value={customOutputFormat}
                            onChange={(e) => setCustomOutputFormat(e.target.value)}
                            placeholder="e.g. Reversed ListNode head"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field full">
                          <label>Constraints (one per line)</label>
                          <textarea
                            value={customConstraints}
                            onChange={(e) => setCustomConstraints(e.target.value)}
                            rows={2}
                            placeholder="1 <= n <= 10^5&#10;Expected O(N) runtime"
                            className="wizard-textarea"
                          />
                        </div>

                        <div className="form-field">
                          <label>Sample Input</label>
                          <input
                            type="text"
                            value={customInputExample}
                            onChange={(e) => setCustomInputExample(e.target.value)}
                            placeholder="nums = [1, 2, 3, 4, 5]"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Sample Expected Output</label>
                          <input
                            type="text"
                            value={customOutputExample}
                            onChange={(e) => setCustomOutputExample(e.target.value)}
                            placeholder="[5, 4, 3, 2, 1]"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field full">
                          <label>Example Explanation (optional)</label>
                          <input
                            type="text"
                            value={customExplanation}
                            onChange={(e) => setCustomExplanation(e.target.value)}
                            placeholder="Explanation of the sample input and output..."
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Hidden Test Input (Confidential Evaluation)</label>
                          <input
                            type="text"
                            value={customHiddenTestInput}
                            onChange={(e) => setCustomHiddenTestInput(e.target.value)}
                            placeholder="nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Hidden Expected Output</label>
                          <input
                            type="text"
                            value={customHiddenTestOutput}
                            onChange={(e) => setCustomHiddenTestOutput(e.target.value)}
                            placeholder="6"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Expected Time Complexity</label>
                          <input
                            type="text"
                            value={customTimeComplexity}
                            onChange={(e) => setCustomTimeComplexity(e.target.value)}
                            placeholder="O(n)"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Expected Space Complexity</label>
                          <input
                            type="text"
                            value={customSpaceComplexity}
                            onChange={(e) => setCustomSpaceComplexity(e.target.value)}
                            placeholder="O(1)"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Method / Function Name (optional)</label>
                          <input
                            type="text"
                            value={customFunctionName}
                            onChange={(e) => setCustomFunctionName(e.target.value)}
                            placeholder="e.g. longestIncreasingSubsequence, reverseList"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Parameters (optional)</label>
                          <input
                            type="text"
                            value={customParams}
                            onChange={(e) => setCustomParams(e.target.value)}
                            placeholder="e.g. nums: int[], target: int or head: ListNode"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field">
                          <label>Return Type (optional)</label>
                          <input
                            type="text"
                            value={customReturnType}
                            onChange={(e) => setCustomReturnType(e.target.value)}
                            placeholder="e.g. int, int[], boolean, ListNode, void"
                            className="wizard-input"
                          />
                        </div>

                        <div className="form-field full">
                          <label>Custom Starter Code Override (optional)</label>
                          <textarea
                            value={customStarterCode}
                            onChange={(e) => setCustomStarterCode(e.target.value)}
                            rows={3}
                            placeholder={`// Optional custom starter code for ${defaultLanguage.toUpperCase()} (leave empty to auto-generate)`}
                            className="wizard-textarea"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCustomProblem}
                        className="iw-btn-secondary"
                        style={{ marginTop: '12px' }}
                      >
                        <Plus size={14} />
                        <span>Add / Update Custom Problem in Interview</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: PROGRAMMING LANGUAGES */}
              {step === 3 && (
                <div className="wizard-step-content">
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Select which programming languages the candidate is permitted to use. The selected starter template will automatically load when they open Monaco Editor.
                  </p>

                  <div className="iw-lang-checkboxes-grid">
                    {(
                      [
                        { id: 'cpp', name: 'C++', desc: 'Modern C++ with STL and Gnu Compiler' },
                        { id: 'java', name: 'Java', desc: 'OpenJDK 17 with Collections and Utilities' },
                        { id: 'python', name: 'Python 3', desc: 'Python 3.11 with standard library' },
                        { id: 'javascript', name: 'JavaScript (ES6)', desc: 'Node.js 20 modern runtime' },
                        { id: 'typescript', name: 'TypeScript', desc: 'Full type safety and compiler support' },
                      ] as const
                    ).map((l) => {
                      const isChecked = permittedLanguages.includes(l.id);
                      return (
                        <div
                          key={l.id}
                          className={`iw-lang-check-card ${isChecked ? 'active' : ''}`}
                          onClick={() => toggleLanguage(l.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            style={{ accentColor: '#ff5c00' }}
                          />
                          <div>
                            <strong>{l.name}</strong>
                            <p>{l.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                      Default Opening Language in Monaco Editor:
                    </label>
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value as typeof defaultLanguage)}
                      className="wizard-select"
                      style={{ maxWidth: '240px' }}
                    >
                      {permittedLanguages.map((l) => (
                        <option key={l} value={l}>
                          {l.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 4: AI INTERVIEWER CONFIGURATION */}
              {step === 4 && (
                <div className="wizard-step-content">
                  <div className="iw-ai-toggles-grid">
                    <div className="iw-toggle-item">
                      <div>
                        <strong>Enable AI Interviewer Proctor</strong>
                        <p>Conducts live technical interview, asks questions, and assesses candidate code.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableAi}
                        onChange={(e) => setEnableAi(e.target.checked)}
                        style={{ accentColor: '#ff5c00', width: '18px', height: '18px' }}
                      />
                    </div>

                    <div className="iw-toggle-item">
                      <div>
                        <strong>Contextual Follow-up Questions</strong>
                        <p>AI generates adaptive follow-ups based on candidate&apos;s answers and algorithmic choices.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={followUpQuestions}
                        onChange={(e) => setFollowUpQuestions(e.target.checked)}
                        style={{ accentColor: '#ff5c00', width: '18px', height: '18px' }}
                      />
                    </div>

                    <div className="iw-toggle-item">
                      <div>
                        <strong>Require Approach Explanation Before Code</strong>
                        <p>AI interviewer prompts candidate to discuss Time/Space Big-O before typing.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={requireApproachExplanation}
                        onChange={(e) => setRequireApproachExplanation(e.target.checked)}
                        style={{ accentColor: '#ff5c00', width: '18px', height: '18px' }}
                      />
                    </div>

                    <div className="iw-toggle-item">
                      <div>
                        <strong>Allow AI Hints</strong>
                        <p>Candidate can request subtle algorithmic hints without revealing full solutions.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowHints}
                        onChange={(e) => setAllowHints(e.target.checked)}
                        style={{ accentColor: '#ff5c00', width: '18px', height: '18px' }}
                      />
                    </div>

                    <div className="iw-toggle-item">
                      <div>
                        <strong>Enable Real-Time Docker Code Execution</strong>
                        <p>Candidate can execute visible tests against secure isolated Docker runtimes.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableExecution}
                        onChange={(e) => setEnableExecution(e.target.checked)}
                        style={{ accentColor: '#ff5c00', width: '18px', height: '18px' }}
                      />
                    </div>

                    <div className="iw-toggle-item">
                      <div>
                        <strong>Enable Video / Audio Proctoring Check</strong>
                        <p>Requires device camera &amp; mic permission verification before test commences.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableVideoProctor}
                        onChange={(e) => setEnableVideoProctor(e.target.checked)}
                        style={{ accentColor: '#ff5c00', width: '18px', height: '18px' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {createdInterview ? (
            <button
              type="button"
              className="iw-btn-primary wide"
              onClick={onClose}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Done &amp; View All Interviews
            </button>
          ) : (
            <>
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    className="iw-btn-secondary"
                    onClick={() => setStep((s) => (s - 1) as typeof step)}
                  >
                    <ArrowLeft size={13} />
                    <span>Back</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="iw-btn-secondary" onClick={onClose}>
                  Cancel
                </button>

                {step < 4 ? (
                  <button
                    type="button"
                    className="iw-btn-primary"
                    onClick={() => {
                      if (step === 2) {
                        ensureCustomProblemCommitted();
                      }
                      setStep((s) => (s + 1) as typeof step);
                    }}
                  >
                    <span>Next Step</span>
                    <ArrowRight size={13} />
                  </button>
                ) : (
                    <button
                      type="button"
                      className="iw-btn-submit"
                      onClick={handleFinalizeInterview}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <ShieldCheck size={14} className="animate-spin" />
                          <span>Provisioning Interview...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Save &amp; Generate Invitation Link</span>
                        </>
                      )}
                    </button>
                )}
              </div>
              {errorMsg && (
                <div className="mx-6 mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
