import { InterviewItem, ProblemDefinition, QUESTION_LIBRARY } from './interview-service';

// In-memory fallback (durable persistence is managed via PostgreSQL backend API)
let memoryStore: InterviewItem[] = [];

export function readInterviewsStore(): InterviewItem[] {
  return memoryStore;
}

export function writeInterviewsStore(data: InterviewItem[]): void {
  memoryStore = data;
}

export function hydrateProblemHiddenCases(problems: ProblemDefinition[]): ProblemDefinition[] {
  return (problems || []).map((prob) => {
    if (Array.isArray(prob.hiddenTestCases) && prob.hiddenTestCases.length > 0) {
      return {
        ...prob,
        hiddenTestCount: prob.hiddenTestCases.length,
      };
    }
    const libMatch = QUESTION_LIBRARY.find((q) => q.id === prob.id);
    if (libMatch && libMatch.hiddenTestCases.length > 0) {
      return {
        ...prob,
        hiddenTestCases: libMatch.hiddenTestCases,
        hiddenTestCount: libMatch.hiddenTestCases.length,
      };
    }
    return {
      ...prob,
      hiddenTestCases: prob.hiddenTestCases || [],
      hiddenTestCount: prob.hiddenTestCount || 0,
    };
  });
}

export function sanitizeInterviewForCandidate(item: InterviewItem): InterviewItem {
  const { ownerId: _ownerId, ...rest } = item;
  return {
    ...rest,
    problems: (rest.problems || []).map((p) => ({
      ...p,
      hiddenTestCount: Array.isArray(p.hiddenTestCases)
        ? p.hiddenTestCases.length
        : p.hiddenTestCount || 0,
      hiddenTestCases: [],
    })),
  };
}
