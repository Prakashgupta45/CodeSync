export interface TestCaseItem {
  id: number;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  passed?: boolean;
  executionTime?: number;
}

export interface StarterTemplates {
  cpp: string;
  java: string;
  python: string;
  javascript: string;
  typescript: string;
}

export interface FunctionParameter {
  name: string;
  type: string; // 'int' | 'int[]' | 'string' | 'boolean' | 'ListNode' | 'char[][]' | 'int[][]' | string
}

export interface FunctionSignature {
  functionName: string;
  returnType: string; // 'int' | 'int[]' | 'string' | 'boolean' | 'ListNode' | 'void' | string
  parameters: FunctionParameter[];
}

export interface ProblemDefinition {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  visibleTestCases: TestCaseItem[];
  hiddenTestCases: TestCaseItem[];
  hiddenTestCount: number;
  expectedTimeComplexity: string;
  expectedSpaceComplexity: string;
  marks?: number;
  starterTemplates: StarterTemplates;
  functionSignature?: FunctionSignature;
}

export interface InterviewAiSettings {
  enableAi: boolean;
  followUpQuestions: boolean;
  allowHints: boolean;
  allowAssistance: boolean;
  requireApproachExplanation: boolean;
  enableExecution: boolean;
  enableVideoProctor: boolean;
  evaluationCriteria: string[];
}

export interface InterviewSubmission {
  submittedCode: string;
  language: string;
  score: number;
  visiblePassed: number;
  visibleTotal: number;
  hiddenPassed: number;
  hiddenTotal: number;
  runtimeMs: number;
  memoryMb: string;
  verdict: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR';
  completedAt: string;
}

export interface InterviewItem {
  id: string;
  token: string;
  ownerId?: string;
  roomId?: string;
  title: string;
  role: 'SDE' | 'Frontend Developer' | 'Backend Developer' | 'Full Stack Developer';
  candidateName: string;
  candidateEmail: string;
  experienceLevel: 'Junior (0-2 yrs)' | 'Mid-level (2-5 yrs)' | 'Senior (5+ yrs)';
  interviewType: 'DSA' | 'Frontend' | 'Backend' | 'Full Stack';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  duration: number; // in minutes
  scheduledDate: string;
  instructions: string;
  permittedLanguages: Array<'cpp' | 'java' | 'python' | 'javascript' | 'typescript'>;
  defaultLanguage: 'cpp' | 'java' | 'python' | 'javascript' | 'typescript';
  problems: ProblemDefinition[];
  aiSettings: InterviewAiSettings;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  submission?: InterviewSubmission;
}

// ---------------------------------------------------------------------------
// UNIVERSAL FUNCTION SIGNATURE & STARTER CODE GENERATION ENGINE
// ---------------------------------------------------------------------------

/**
 * Check whether a template string is an empty, generic, or parameterless void template.
 * e.g. "public void longestIncreasingSubsequence() { ... }" or "void solve() { ... }"
 */
export function isParameterlessVoidTemplate(template: string): boolean {
  if (!template || typeof template !== 'string') return true;
  const trimmed = template.trim();
  if (trimmed.length === 0) return true;
  return /\bvoid\s+[a-zA-Z0-9_]+\s*\(\s*\)/.test(trimmed);
}

/**
 * Convert a problem title to a standard camelCase method name
 */
export function titleToMethodName(title: string): string {
  const clean = (title || 'solve').trim();
  const lower = clean.toLowerCase();
  if (lower.includes('longest increasing subsequence')) return 'longestIncreasingSubsequence';
  if (lower.includes('reverse a linked list') || lower.includes('reverse linked list')) return 'reverseList';
  if (lower.includes('maximum subarray') || lower.includes('max subarray')) return 'maxSubArray';
  if (lower.includes('two sum')) return 'twoSum';
  if (lower.includes('longest substring without repeating')) return 'lengthOfLongestSubstring';
  if (lower.includes('valid parentheses')) return 'isValid';
  if (lower.includes('number of islands')) return 'numIslands';
  if (lower === 'binary search' || lower.startsWith('binary search')) return 'search';
  if (lower.includes('lru cache')) return 'LRUCache';

  const parts = clean.replace(/[^a-zA-Z0-9\s_-]/g, '').split(/[\s_-]+/);
  if (parts.length === 0) return 'solve';
  const first = parts[0].toLowerCase();
  const rest = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  const result = `${first}${rest}`;
  return result.length > 0 ? result : 'solve';
}

/**
 * Infer full FunctionSignature (function name, parameters, return type) from problem metadata
 */
export function inferProblemSignature(
  prob: Partial<ProblemDefinition> & { title: string }
): FunctionSignature {
  // If explicitly declared, use it
  if (prob.functionSignature && prob.functionSignature.functionName) {
    return prob.functionSignature;
  }

  const title = prob.title || 'Solution';
  const functionName = titleToMethodName(title);
  const titleLower = title.toLowerCase();
  const catLower = (prob.category || '').toLowerCase();
  const descLower = (prob.description || '').toLowerCase();
  const inputFormatLower = (prob.inputFormat || '').toLowerCase();
  const outputFormatLower = (prob.outputFormat || '').toLowerCase();
  const sampleInput = prob.examples?.[0]?.input || prob.visibleTestCases?.[0]?.input || '';
  const sampleOutput = prob.examples?.[0]?.output || prob.visibleTestCases?.[0]?.expectedOutput || '';

  // 1. Infer Return Type
  let returnType = 'int';
  if (
    titleLower.includes('linked list') ||
    catLower.includes('linked list') ||
    descLower.includes('linked list') ||
    inputFormatLower.includes('listnode') ||
    sampleInput.includes('head =')
  ) {
    if (outputFormatLower.includes('boolean') || sampleOutput === 'true' || sampleOutput === 'false') {
      returnType = 'boolean';
    } else if (outputFormatLower.includes('int') || /^\d+$/.test(sampleOutput.trim())) {
      returnType = 'int';
    } else {
      returnType = 'ListNode';
    }
  } else if (
    outputFormatLower.includes('boolean') ||
    sampleOutput.trim() === 'true' ||
    sampleOutput.trim() === 'false'
  ) {
    returnType = 'boolean';
  } else if (
    outputFormatLower.includes('array of two indices') ||
    outputFormatLower.includes('vector<int>') ||
    (sampleOutput.trim().startsWith('[') && sampleOutput.trim().endsWith(']'))
  ) {
    returnType = 'int[]';
  } else if (
    outputFormatLower.includes('string') ||
    (sampleOutput.trim().startsWith('"') && sampleOutput.trim().endsWith('"'))
  ) {
    returnType = 'string';
  } else if (
    outputFormatLower.includes('void')
  ) {
    returnType = 'void';
  } else {
    returnType = 'int';
  }

  // 2. Infer Parameters
  const parameters: FunctionParameter[] = [];

  if (
    titleLower.includes('linked list') ||
    catLower.includes('linked list') ||
    inputFormatLower.includes('listnode') ||
    sampleInput.includes('head =')
  ) {
    parameters.push({ name: 'head', type: 'ListNode' });
  } else if (titleLower.includes('islands') || inputFormatLower.includes('grid')) {
    parameters.push({ name: 'grid', type: 'char[][]' });
  } else {
    let matchedAny = false;

    if (sampleInput.includes('nums =') || inputFormatLower.includes('nums') || titleLower.includes('subsequence') || titleLower.includes('subarray')) {
      parameters.push({ name: 'nums', type: 'int[]' });
      matchedAny = true;
    }

    if (sampleInput.includes('target =') || inputFormatLower.includes('target')) {
      parameters.push({ name: 'target', type: 'int' });
      matchedAny = true;
    }

    if (sampleInput.includes('k =') || inputFormatLower.includes('k')) {
      parameters.push({ name: 'k', type: 'int' });
      matchedAny = true;
    }

    if (!matchedAny && (sampleInput.includes('s =') || inputFormatLower.includes('string') || titleLower.includes('string') || titleLower.includes('parentheses'))) {
      parameters.push({ name: 's', type: 'string' });
      matchedAny = true;
    }

    if (!matchedAny) {
      const paramMatches = [...sampleInput.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g)];
      if (paramMatches.length > 0) {
        for (const m of paramMatches) {
          const pName = m[1];
          if (pName.toLowerCase().includes('target') || pName.toLowerCase() === 'k' || pName.toLowerCase() === 'n') {
            parameters.push({ name: pName, type: 'int' });
          } else if (pName.toLowerCase() === 's' || pName.toLowerCase().includes('str')) {
            parameters.push({ name: pName, type: 'string' });
          } else {
            parameters.push({ name: pName, type: 'int[]' });
          }
        }
      } else {
        parameters.push({ name: 'nums', type: 'int[]' });
      }
    }
  }

  return {
    functionName,
    returnType,
    parameters,
  };
}

/**
 * Generate starter templates for all 5 languages given a FunctionSignature
 */
export function generateStarterTemplates(
  signature: FunctionSignature,
  title?: string
): StarterTemplates {
  const { functionName, returnType, parameters } = signature;
  const headerComment = title ? `Solution for ${title}` : `${functionName} Solution`;

  // Java Generator
  const javaParams = parameters
    .map((p) => {
      switch (p.type) {
        case 'int[]':
          return `int[] ${p.name}`;
        case 'int':
          return `int ${p.name}`;
        case 'string':
          return `String ${p.name}`;
        case 'boolean':
          return `boolean ${p.name}`;
        case 'ListNode':
          return `ListNode ${p.name}`;
        case 'char[][]':
          return `char[][] ${p.name}`;
        case 'int[][]':
          return `int[][] ${p.name}`;
        default:
          return `${p.type} ${p.name}`;
      }
    })
    .join(', ');

  let javaReturnType = 'int';
  let javaReturnStmt = 'return 0;';
  switch (returnType) {
    case 'int':
      javaReturnType = 'int';
      javaReturnStmt = 'return 0;';
      break;
    case 'int[]':
      javaReturnType = 'int[]';
      javaReturnStmt = 'return new int[]{};';
      break;
    case 'boolean':
      javaReturnType = 'boolean';
      javaReturnStmt = 'return false;';
      break;
    case 'string':
      javaReturnType = 'String';
      javaReturnStmt = 'return "";';
      break;
    case 'ListNode':
      javaReturnType = 'ListNode';
      javaReturnStmt = 'return null;';
      break;
    case 'void':
      javaReturnType = 'void';
      javaReturnStmt = '';
      break;
    default:
      javaReturnType = returnType;
      javaReturnStmt = 'return null;';
  }

  const javaTemplate = `// Java ${headerComment}
class Solution {
    public ${javaReturnType} ${functionName}(${javaParams}) {
        // Your code here
        ${javaReturnStmt}
    }
}`;

  // C++ Generator
  const cppParams = parameters
    .map((p) => {
      switch (p.type) {
        case 'int[]':
          return `vector<int>& ${p.name}`;
        case 'int':
          return `int ${p.name}`;
        case 'string':
          return `string ${p.name}`;
        case 'boolean':
          return `bool ${p.name}`;
        case 'ListNode':
          return `ListNode* ${p.name}`;
        case 'char[][]':
          return `vector<vector<char>>& ${p.name}`;
        case 'int[][]':
          return `vector<vector<int>>& ${p.name}`;
        default:
          return `${p.type} ${p.name}`;
      }
    })
    .join(', ');

  let cppReturnType = 'int';
  let cppReturnStmt = 'return 0;';
  switch (returnType) {
    case 'int':
      cppReturnType = 'int';
      cppReturnStmt = 'return 0;';
      break;
    case 'int[]':
      cppReturnType = 'vector<int>';
      cppReturnStmt = 'return {};';
      break;
    case 'boolean':
      cppReturnType = 'bool';
      cppReturnStmt = 'return false;';
      break;
    case 'string':
      cppReturnType = 'string';
      cppReturnStmt = 'return "";';
      break;
    case 'ListNode':
      cppReturnType = 'ListNode*';
      cppReturnStmt = 'return nullptr;';
      break;
    case 'void':
      cppReturnType = 'void';
      cppReturnStmt = '';
      break;
    default:
      cppReturnType = returnType;
      cppReturnStmt = 'return {};';
  }

  let cppTemplate: string;
  if (functionName === 'LRUCache' || title?.toLowerCase().includes('lru cache')) {
    cppTemplate = `#include <bits/stdc++.h>
using namespace std;

class LRUCache {
public:
    LRUCache(int capacity) {
        // Initialize your data structure here
    }

    int get(int key) {
        // Write your solution here
        return -1;
    }

    void put(int key, int value) {
        // Write your solution here
    }
};`;
  } else {
    const listNodeHeader =
      returnType === 'ListNode' || parameters.some((p) => p.type === 'ListNode')
        ? `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
`
        : '';

    cppTemplate = `#include <bits/stdc++.h>
using namespace std;

${listNodeHeader}class Solution {
public:
    ${cppReturnType} ${functionName}(${cppParams}) {
        // Write your solution here
        ${cppReturnStmt}
    }
};`;
  }

  // Python Generator
  const pyParams = ['self', ...parameters.map((p) => {
    switch (p.type) {
      case 'int[]':
        return `${p.name}: List[int]`;
      case 'int':
        return `${p.name}: int`;
      case 'string':
        return `${p.name}: str`;
      case 'boolean':
        return `${p.name}: bool`;
      case 'ListNode':
        return `${p.name}: Optional[ListNode]`;
      case 'char[][]':
        return `${p.name}: List[List[str]]`;
      case 'int[][]':
        return `${p.name}: List[List[int]]`;
      default:
        return `${p.name}`;
    }
  })].join(', ');

  let pyReturnType = 'int';
  switch (returnType) {
    case 'int':
      pyReturnType = 'int';
      break;
    case 'int[]':
      pyReturnType = 'List[int]';
      break;
    case 'boolean':
      pyReturnType = 'bool';
      break;
    case 'string':
      pyReturnType = 'str';
      break;
    case 'ListNode':
      pyReturnType = 'Optional[ListNode]';
      break;
    case 'void':
      pyReturnType = 'None';
      break;
    default:
      pyReturnType = returnType;
  }

  const pythonTemplate = `# Python 3 ${headerComment}
from typing import List, Optional

class Solution:
    def ${functionName}(${pyParams}) -> ${pyReturnType}:
        # Your code here
        pass`;

  // JavaScript Generator
  const jsParams = parameters.map((p) => p.name).join(', ');
  const javascriptTemplate = `// JavaScript ${headerComment}
/**
 * @return {${returnType === 'int[]' ? 'number[]' : returnType === 'int' ? 'number' : returnType}}
 */
function ${functionName}(${jsParams}) {
    // Your code here
}`;

  // TypeScript Generator
  const tsParams = parameters
    .map((p) => {
      switch (p.type) {
        case 'int[]':
          return `${p.name}: number[]`;
        case 'int':
          return `${p.name}: number`;
        case 'string':
          return `${p.name}: string`;
        case 'boolean':
          return `${p.name}: boolean`;
        case 'ListNode':
          return `${p.name}: ListNode | null`;
        case 'char[][]':
          return `${p.name}: string[][]`;
        case 'int[][]':
          return `${p.name}: number[][]`;
        default:
          return `${p.name}: any`;
      }
    })
    .join(', ');

  let tsReturnType = 'number';
  let tsReturnStmt = 'return 0;';
  switch (returnType) {
    case 'int':
      tsReturnType = 'number';
      tsReturnStmt = 'return 0;';
      break;
    case 'int[]':
      tsReturnType = 'number[]';
      tsReturnStmt = 'return [];';
      break;
    case 'boolean':
      tsReturnType = 'boolean';
      tsReturnStmt = 'return false;';
      break;
    case 'string':
      tsReturnType = 'string';
      tsReturnStmt = "return '';";
      break;
    case 'ListNode':
      tsReturnType = 'ListNode | null';
      tsReturnStmt = 'return null;';
      break;
    case 'void':
      tsReturnType = 'void';
      tsReturnStmt = '';
      break;
    default:
      tsReturnType = 'any';
      tsReturnStmt = 'return null;';
  }

  const typescriptTemplate = `// TypeScript ${headerComment}
function ${functionName}(${tsParams}): ${tsReturnType} {
    // Your code here
    ${tsReturnStmt}
}`;

  return {
    cpp: cppTemplate,
    java: javaTemplate,
    python: pythonTemplate,
    javascript: javascriptTemplate,
    typescript: typescriptTemplate,
  };
}

/**
 * Returns the resolved starter template for a problem and language.
 * Preserves custom/existing template if already populated with parameters,
 * otherwise dynamically generates the correct parameterized template.
 */
export function getResolvedStarterTemplate(prob: ProblemDefinition, lang: string): string {
  const normLang = (lang || 'typescript').toLowerCase();
  const langKey = (
    ['cpp', 'java', 'python', 'javascript', 'typescript'].includes(normLang)
      ? normLang
      : 'typescript'
  ) as keyof StarterTemplates;

  // 1. If problem already has a valid, parameterized template for this language, preserve it!
  if (prob.starterTemplates && prob.starterTemplates[langKey]) {
    const existing = prob.starterTemplates[langKey];
    if (typeof existing === 'string' && existing.trim().length > 0) {
      if (!isParameterlessVoidTemplate(existing)) {
        return existing;
      }
    }
  }

  // 1b. Check if the question library has this problem and its curated template
  const libMatch = QUESTION_LIBRARY.find(
    (q) => q.id === prob.id || q.title.toLowerCase().trim() === prob.title.toLowerCase().trim()
  );
  if (libMatch?.starterTemplates?.[langKey]) {
    const libTemplate = libMatch.starterTemplates[langKey];
    if (typeof libTemplate === 'string' && libTemplate.trim().length > 0 && !isParameterlessVoidTemplate(libTemplate)) {
      return libTemplate;
    }
  }

  // 2. Infer signature and generate complete parameterized template
  const signature = inferProblemSignature(prob);
  const templates = generateStarterTemplates(signature, prob.title);
  return templates[langKey] || templates.typescript;
}

// ---------------------------------------------------------------------------
// BUILT-IN QUESTION LIBRARY
// ---------------------------------------------------------------------------
export const QUESTION_LIBRARY: ProblemDefinition[] = [
  {
    id: 'q-two-sum',
    title: 'Two Sum',
    difficulty: 'Medium',
    category: 'Arrays & Hash Maps',
    description:
      'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
    inputFormat: 'nums = integer array, target = integer',
    outputFormat: 'Array of two indices [index1, index2]',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    examples: [
      {
        input: 'nums = [2, 7, 11, 15], target = 9',
        output: '[0, 1]',
        explanation: 'Because nums[0] + nums[1] == 2 + 7 == 9, we return [0, 1].',
      },
      {
        input: 'nums = [3, 2, 4], target = 6',
        output: '[1, 2]',
        explanation: 'Because nums[1] + nums[2] == 2 + 4 == 6, we return [1, 2].',
      },
      {
        input: 'nums = [3, 3], target = 6',
        output: '[0, 1]',
        explanation: 'Because nums[0] + nums[1] == 3 + 3 == 6, we return [0, 1].',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 'nums = [2, 7, 11, 15], target = 9', expectedOutput: '[0, 1]' },
      { id: 2, input: 'nums = [3, 2, 4], target = 6', expectedOutput: '[1, 2]' },
      { id: 3, input: 'nums = [3, 3], target = 6', expectedOutput: '[0, 1]' },
    ],
    hiddenTestCases: [
      { id: 4, input: 'nums = [-1, -2, -3, -4, -5], target = -8', expectedOutput: '[2, 4]' },
      { id: 5, input: 'nums = [0, 4, 3, 0], target = 0', expectedOutput: '[0, 3]' },
      { id: 6, input: 'nums = [1000000000, 5, 2, 1000000000], target = 2000000000', expectedOutput: '[0, 3]' },
      { id: 7, input: 'nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], target = 19', expectedOutput: '[8, 9]' },
      { id: 8, input: 'nums = [5, 75, 25], target = 100', expectedOutput: '[1, 2]' },
    ],
    hiddenTestCount: 5,
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(n)',
    marks: 100,
    starterTemplates: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
    }
};`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}`,
      python: `class Solution:
    def twoSum(self, nums, target):
        # Write your solution here
        pass`,
      javascript: `var twoSum = function(nums, target) {
    // Write your solution here
};`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
    // Write your solution here
    return [];
}`,
    },
  },
  {
    id: 'q-longest-substring',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    category: 'Strings & Sliding Window',
    description:
      'Given a string s, find the length of the longest substring without repeating characters.\n\nA substring is a contiguous non-empty sequence of characters within a string.',
    inputFormat: 'A single string s',
    outputFormat: 'Integer representing the length of the longest unique substring',
    constraints: [
      '0 <= s.length <= 5 * 10^4',
      's consists of English letters, digits, symbols and spaces.',
    ],
    examples: [
      {
        input: 's = "abcabcbb"',
        output: '3',
        explanation: 'The answer is "abc", with the length of 3.',
      },
      {
        input: 's = "bbbbb"',
        output: '1',
        explanation: 'The answer is "b", with the length of 1.',
      },
      {
        input: 's = "pwwkew"',
        output: '3',
        explanation: 'The answer is "wke", with the length of 3.',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 's = "abcabcbb"', expectedOutput: '3' },
      { id: 2, input: 's = "bbbbb"', expectedOutput: '1' },
      { id: 3, input: 's = "pwwkew"', expectedOutput: '3' },
    ],
    hiddenTestCases: [
      { id: 4, input: 's = ""', expectedOutput: '0' },
      { id: 5, input: 's = " "', expectedOutput: '1' },
      { id: 6, input: 's = "au"', expectedOutput: '2' },
      { id: 7, input: 's = "dvdf"', expectedOutput: '3' },
    ],
    hiddenTestCount: 4,
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(min(m, n))',
    marks: 100,
    starterTemplates: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Write your solution here
    }
};`,
      java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Write your solution here
        return 0;
    }
}`,
      python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        # Write your solution here
        pass`,
      javascript: `var lengthOfLongestSubstring = function(s) {
    // Write your solution here
};`,
      typescript: `function lengthOfLongestSubstring(s: string): number {
    // Write your solution here
    return 0;
}`,
    },
  },
  {
    id: 'q-valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    category: 'Stacks',
    description:
      'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if open brackets are closed by the same type of brackets and in the correct order.',
    inputFormat: 'String s of bracket characters',
    outputFormat: 'Boolean (true or false)',
    constraints: [
      '1 <= s.length <= 10^4',
      's consists of parentheses only "()[]{}"',
    ],
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    visibleTestCases: [
      { id: 1, input: 's = "()"', expectedOutput: 'true' },
      { id: 2, input: 's = "()[]{}"', expectedOutput: 'true' },
      { id: 3, input: 's = "(]"', expectedOutput: 'false' },
    ],
    hiddenTestCases: [
      { id: 4, input: 's = "([)]"', expectedOutput: 'false' },
      { id: 5, input: 's = "{[]}"', expectedOutput: 'true' },
    ],
    hiddenTestCount: 2,
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(n)',
    marks: 50,
    starterTemplates: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Write your solution here
    }
};`,
      java: `class Solution {
    public boolean isValid(String s) {
        // Write your solution here
        return false;
    }
}`,
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        # Write your solution here
        pass`,
      javascript: `var isValid = function(s) {
    // Write your solution here
};`,
      typescript: `function isValid(s: string): boolean {
    // Write your solution here
    return false;
}`,
    },
  },
  {
    id: 'q-number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    category: 'Graphs & BFS/DFS',
    description:
      'Given an m x n 2D binary grid grid which represents a map of "1"s (land) and "0"s (water), return the number of islands.\n\nAn island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.',
    inputFormat: 'grid: 2D array of char "1" and "0"',
    outputFormat: 'Integer representing the count of distinct islands',
    constraints: [
      'm == grid.length',
      'n == grid[i].length',
      '1 <= m, n <= 300',
      'grid[i][j] is "0" or "1"',
    ],
    examples: [
      {
        input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
        output: '3',
      },
    ],
    visibleTestCases: [
      {
        id: 1,
        input: 'grid = [["1","1","0"],["0","1","0"],["0","0","1"]]',
        expectedOutput: '2',
      },
    ],
    hiddenTestCases: [],
    hiddenTestCount: 3,
    expectedTimeComplexity: 'O(m * n)',
    expectedSpaceComplexity: 'O(m * n)',
    marks: 100,
    starterTemplates: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        // Write your solution here
    }
};`,
      java: `class Solution {
    public int numIslands(char[][] grid) {
        // Write your solution here
        return 0;
    }
}`,
      python: `class Solution:
    def numIslands(self, grid: list[list[str]]) -> int:
        # Write your solution here
        pass`,
      javascript: `var numIslands = function(grid) {
    // Write your solution here
};`,
      typescript: `function numIslands(grid: string[][]): number {
    // Write your solution here
    return 0;
}`,
    },
  },
  {
    id: 'q-longest-increasing-subsequence',
    title: 'Longest Increasing Subsequence',
    difficulty: 'Medium',
    category: 'Dynamic Programming',
    description:
      'Given an integer array nums, return the length of the longest strictly increasing subsequence.\n\nA subsequence is an array that can be derived from another array by deleting some or no elements without changing the order of the remaining elements.',
    inputFormat: 'nums = integer array',
    outputFormat: 'Integer representing the length of the longest strictly increasing subsequence',
    constraints: [
      '1 <= nums.length <= 2500',
      '-10^4 <= nums[i] <= 10^4',
    ],
    examples: [
      {
        input: 'nums = [10, 9, 2, 5, 3, 7, 101, 18]',
        output: '4',
        explanation: 'The longest strictly increasing subsequence is [2, 3, 7, 101], therefore the length is 4.',
      },
      {
        input: 'nums = [0, 1, 0, 3, 2, 3]',
        output: '4',
        explanation: 'The longest strictly increasing subsequence is [0, 1, 2, 3], therefore the length is 4.',
      },
      {
        input: 'nums = [7, 7, 7, 7, 7, 7, 7]',
        output: '1',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 'nums = [10, 9, 2, 5, 3, 7, 101, 18]', expectedOutput: '4' },
      { id: 2, input: 'nums = [0, 1, 0, 3, 2, 3]', expectedOutput: '4' },
      { id: 3, input: 'nums = [7, 7, 7, 7, 7, 7, 7]', expectedOutput: '1' },
    ],
    hiddenTestCases: [
      { id: 4, input: 'nums = [4, 10, 4, 3, 8, 9]', expectedOutput: '3' },
      { id: 5, input: 'nums = [1, 3, 6, 7, 9, 4, 10, 5, 6]', expectedOutput: '6' },
    ],
    hiddenTestCount: 2,
    expectedTimeComplexity: 'O(n log n) or O(n^2)',
    expectedSpaceComplexity: 'O(n)',
    marks: 100,
    functionSignature: {
      functionName: 'longestIncreasingSubsequence',
      returnType: 'int',
      parameters: [{ name: 'nums', type: 'int[]' }],
    },
    starterTemplates: {
      cpp: `// C++ Solution for Longest Increasing Subsequence
#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int longestIncreasingSubsequence(vector<int>& nums) {
        // Your code here
        return 0;
    }
};`,
      java: `// Java Solution for Longest Increasing Subsequence
class Solution {
    public int longestIncreasingSubsequence(int[] nums) {
        // Your code here
        return 0;
    }
}`,
      python: `# Python 3 Solution for Longest Increasing Subsequence
from typing import List

class Solution:
    def longestIncreasingSubsequence(self, nums: List[int]) -> int:
        # Your code here
        pass`,
      javascript: `// JavaScript Solution for Longest Increasing Subsequence
/**
 * @param {number[]} nums
 * @return {number}
 */
var longestIncreasingSubsequence = function(nums) {
    // Your code here
    return 0;
};`,
      typescript: `// TypeScript Solution for Longest Increasing Subsequence
function longestIncreasingSubsequence(nums: number[]): number {
    // Your code here
    return 0;
}`,
    },
  },
  {
    id: 'q-reverse-linked-list',
    title: 'Reverse a Linked List',
    difficulty: 'Easy',
    category: 'Linked Lists',
    description:
      'Given the head of a singly linked list, reverse the list, and return the reversed list.',
    inputFormat: 'head = [1, 2, 3, 4, 5]',
    outputFormat: '[5, 4, 3, 2, 1]',
    constraints: [
      'The number of nodes in the list is the range [0, 5000].',
      '-5000 <= Node.val <= 5000',
    ],
    examples: [
      {
        input: 'head = [1, 2, 3, 4, 5]',
        output: '[5, 4, 3, 2, 1]',
      },
      {
        input: 'head = [1, 2]',
        output: '[2, 1]',
      },
      {
        input: 'head = []',
        output: '[]',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 'head = [1, 2, 3, 4, 5]', expectedOutput: '[5, 4, 3, 2, 1]' },
      { id: 2, input: 'head = [1, 2]', expectedOutput: '[2, 1]' },
      { id: 3, input: 'head = []', expectedOutput: '[]' },
    ],
    hiddenTestCases: [
      { id: 4, input: 'head = [42]', expectedOutput: '[42]' },
      { id: 5, input: 'head = [9, 8, 7, 6]', expectedOutput: '[6, 7, 8, 9]' },
    ],
    hiddenTestCount: 2,
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    marks: 100,
    functionSignature: {
      functionName: 'reverseList',
      returnType: 'ListNode',
      parameters: [{ name: 'head', type: 'ListNode' }],
    },
    starterTemplates: {
      cpp: `// C++ Solution for Reverse a Linked List
#include <bits/stdc++.h>
using namespace std;

/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        // Your code here
        return nullptr;
    }
};`,
      java: `// Java Solution for Reverse a Linked List
/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode reverseList(ListNode head) {
        // Your code here
        return null;
    }
}`,
      python: `# Python 3 Solution for Reverse a Linked List
from typing import Optional

# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next

class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        # Your code here
        pass`,
      javascript: `// JavaScript Solution for Reverse a Linked List
/**
 * @param {ListNode} head
 * @return {ListNode}
 */
var reverseList = function(head) {
    // Your code here
    return null;
};`,
      typescript: `// TypeScript Solution for Reverse a Linked List
function reverseList(head: ListNode | null): ListNode | null {
    // Your code here
    return null;
}`,
    },
  },
  {
    id: 'q-maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    category: 'Dynamic Programming',
    description:
      'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
    inputFormat: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]',
    outputFormat: '6',
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 <= nums[i] <= 10^4',
    ],
    examples: [
      {
        input: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]',
        output: '6',
        explanation: 'The subarray [4, -1, 2, 1] has the largest sum 6.',
      },
      {
        input: 'nums = [1]',
        output: '1',
      },
      {
        input: 'nums = [5, 4, -1, 7, 8]',
        output: '23',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]', expectedOutput: '6' },
      { id: 2, input: 'nums = [1]', expectedOutput: '1' },
      { id: 3, input: 'nums = [5, 4, -1, 7, 8]', expectedOutput: '23' },
    ],
    hiddenTestCases: [
      { id: 4, input: 'nums = [-1]', expectedOutput: '-1' },
      { id: 5, input: 'nums = [-2, -1]', expectedOutput: '-1' },
    ],
    hiddenTestCount: 2,
    expectedTimeComplexity: 'O(n)',
    expectedSpaceComplexity: 'O(1)',
    marks: 100,
    functionSignature: {
      functionName: 'maxSubArray',
      returnType: 'int',
      parameters: [{ name: 'nums', type: 'int[]' }],
    },
    starterTemplates: {
      cpp: `// C++ Solution for Maximum Subarray
#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Your code here
        return 0;
    }
};`,
      java: `// Java Solution for Maximum Subarray
class Solution {
    public int maxSubArray(int[] nums) {
        // Your code here
        return 0;
    }
}`,
      python: `# Python 3 Solution for Maximum Subarray
from typing import List

class Solution:
    def maxSubArray(self, nums: List[int]) -> int:
        # Your code here
        pass`,
      javascript: `// JavaScript Solution for Maximum Subarray
/**
 * @param {number[]} nums
 * @return {number}
 */
var maxSubArray = function(nums) {
    // Your code here
    return 0;
};`,
      typescript: `// TypeScript Solution for Maximum Subarray
function maxSubArray(nums: number[]): number {
    // Your code here
    return 0;
}`,
    },
  },
  {
    id: 'q-binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    category: 'Binary Search',
    description:
      'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.',
    inputFormat: 'nums = sorted integer array, target = integer',
    outputFormat: 'Integer index of target, or -1 if not found',
    constraints: [
      '1 <= nums.length <= 10^4',
      '-10^4 < nums[i], target < 10^4',
      'All the integers in nums are unique.',
      'nums is sorted in ascending order.',
    ],
    examples: [
      {
        input: 'nums = [-1, 0, 3, 5, 9, 12], target = 9',
        output: '4',
        explanation: '9 exists in nums and its index is 4.',
      },
      {
        input: 'nums = [-1, 0, 3, 5, 9, 12], target = 2',
        output: '-1',
        explanation: '2 does not exist in nums so return -1.',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 'nums = [-1, 0, 3, 5, 9, 12], target = 9', expectedOutput: '4' },
      { id: 2, input: 'nums = [-1, 0, 3, 5, 9, 12], target = 2', expectedOutput: '-1' },
      { id: 3, input: 'nums = [1, 3, 5, 7], target = 5', expectedOutput: '2' },
    ],
    hiddenTestCases: [
      { id: 4, input: 'nums = [5], target = 5', expectedOutput: '0' },
      { id: 5, input: 'nums = [], target = 5', expectedOutput: '-1' },
    ],
    hiddenTestCount: 2,
    expectedTimeComplexity: 'O(log n)',
    expectedSpaceComplexity: 'O(1)',
    marks: 50,
    functionSignature: {
      functionName: 'search',
      returnType: 'int',
      parameters: [
        { name: 'nums', type: 'int[]' },
        { name: 'target', type: 'int' },
      ],
    },
    starterTemplates: {
      cpp: `// C++ Solution for Binary Search
#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Your code here
        return -1;
    }
};`,
      java: `// Java Solution for Binary Search
class Solution {
    public int search(int[] nums, int target) {
        // Your code here
        return -1;
    }
}`,
      python: `# Python 3 Solution for Binary Search
from typing import List

class Solution:
    def search(self, nums: List[int], target: int) -> int:
        # Your code here
        pass`,
      javascript: `// JavaScript Solution for Binary Search
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var search = function(nums, target) {
    // Your code here
    return -1;
};`,
      typescript: `// TypeScript Solution for Binary Search
function search(nums: number[], target: number): number {
    // Your code here
    return -1;
}`,
    },
  },
  {
    id: 'q-lru-cache',
    title: 'LRU Cache',
    difficulty: 'Hard',
    category: 'Design & Data Structures',
    description:
      'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the LRUCache class:\n- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.\n- int get(int key) Return the value of the key if the key exists, otherwise return -1.\n- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity from this operation, evict the least recently used key.\n\nThe functions get and put must each run in O(1) average time complexity.',
    inputFormat: 'capacity = 2, operations = put(1,1), put(2,2), get(1), put(3,3), get(2)',
    outputFormat: '[1, -1]',
    constraints: [
      '1 <= capacity <= 3000',
      '0 <= key <= 10^4',
      '0 <= value <= 10^5',
      'At most 2 * 10^5 calls will be made to get and put.',
    ],
    examples: [
      {
        input: 'LRUCache cache = new LRUCache(2);\ncache.put(1, 1);\ncache.put(2, 2);\ncache.get(1); // returns 1\ncache.put(3, 3); // evicts key 2\ncache.get(2); // returns -1 (not found)',
        output: '1, -1',
        explanation: 'key 2 was evicted because it was least recently used.',
      },
    ],
    visibleTestCases: [
      { id: 1, input: 'capacity = 2, operations: put(1,1), put(2,2), get(1)', expectedOutput: '1' },
      { id: 2, input: 'capacity = 2, operations: put(3,3), get(2)', expectedOutput: '-1' },
      { id: 3, input: 'capacity = 2, operations: put(4,4), get(1), get(3), get(4)', expectedOutput: '[-1, 3, 4]' },
    ],
    hiddenTestCases: [
      { id: 4, input: 'capacity = 1, operations: put(2,1), get(2), put(3,2), get(2), get(3)', expectedOutput: '[1, -1, 2]' },
      { id: 5, input: 'capacity = 3, operations: put(1,1), put(2,2), put(3,3), put(4,4), get(4), get(3), get(2), get(1)', expectedOutput: '[4, 3, 2, -1]' },
    ],
    hiddenTestCount: 2,
    expectedTimeComplexity: 'O(1)',
    expectedSpaceComplexity: 'O(capacity)',
    marks: 100,
    starterTemplates: {
      cpp: `#include <bits/stdc++.h>
using namespace std;

class LRUCache {
public:
    LRUCache(int capacity) {
        // Initialize your data structure here
    }

    int get(int key) {
        // Write your solution here
    }

    void put(int key, int value) {
        // Write your solution here
    }
};`,
      java: `class LRUCache {
    public LRUCache(int capacity) {
        // Initialize your data structure here
    }

    public int get(int key) {
        // Write your solution here
        return -1;
    }

    public void put(int key, int value) {
        // Write your solution here
    }
}`,
      python: `class LRUCache:
    def __init__(self, capacity: int):
        # Initialize your data structure here
        pass

    def get(self, key: int) -> int:
        # Write your solution here
        return -1

    def put(self, key: int, value: int) -> None:
        # Write your solution here
        pass`,
      javascript: `/**
 * @param {number} capacity
 */
var LRUCache = function(capacity) {
    // Initialize your data structure here
};

/**
 * @param {number} key
 * @return {number}
 */
LRUCache.prototype.get = function(key) {
    // Write your solution here
};

/**
 * @param {number} key
 * @param {number} value
 * @return {void}
 */
LRUCache.prototype.put = function(key, value) {
    // Write your solution here
};`,
      typescript: `class LRUCache {
    constructor(capacity: number) {
        // Initialize your data structure here
    }

    get(key: number): number {
        // Write your solution here
        return -1;
    }

    put(key: number, value: number): void {
        // Write your solution here
    }
}`,
    },
  },
];

// ---------------------------------------------------------------------------
// DEFAULT INITIAL INTERVIEWS (HR REGISTRY)
// ---------------------------------------------------------------------------
export const INITIAL_INTERVIEWS: InterviewItem[] = [];

// ---------------------------------------------------------------------------
// SERVICE METHODS
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'codesync_interviews_registry_v1';

export function createFallbackInterview(token: string): InterviewItem {
  return {
    id: token.startsWith('int-') ? token : `int-${token.replace('cs_inv_', '')}`,
    token,
    roomId: `room-interview-${token.replace('cs_inv_', '')}`,
    title: 'SDE Technical Interview Assessment',
    role: 'SDE',
    candidateName: 'Candidate',
    candidateEmail: 'candidate@codesync.ai',
    experienceLevel: 'Mid-level (2-5 yrs)',
    interviewType: 'DSA',
    difficulty: 'Medium',
    duration: 45,
    scheduledDate: new Date().toISOString(),
    instructions:
      'Please read the problem constraints carefully. Explain your initial thought process to the AI Interviewer before writing your optimal code. Monaco editor provides live syntax highlighting and isolated Docker sandbox execution.',
    permittedLanguages: ['typescript', 'python', 'java', 'cpp', 'javascript'],
    defaultLanguage: 'typescript',
    problems: [QUESTION_LIBRARY[0]],
    aiSettings: {
      enableAi: true,
      followUpQuestions: true,
      allowHints: true,
      allowAssistance: true,
      requireApproachExplanation: true,
      enableExecution: true,
      enableVideoProctor: true,
      evaluationCriteria: [
        'Algorithmic Efficiency',
        'Code Quality & Cleanliness',
        'Edge Case Handling',
        'Technical Communication',
      ],
    },
    status: 'SCHEDULED',
    createdAt: new Date().toISOString(),
  };
}

function stripHiddenTestCases(interview: InterviewItem): InterviewItem {
  return {
    ...interview,
    problems: (interview.problems || []).map((p) => ({
      ...p,
      hiddenTestCount: Array.isArray(p.hiddenTestCases)
        ? p.hiddenTestCases.length
        : p.hiddenTestCount || 0,
      hiddenTestCases: [],
    })),
  };
}

export function getInterviews(): InterviewItem[] {
  if (typeof window === 'undefined') return INITIAL_INTERVIEWS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const sanitizedInitial = INITIAL_INTERVIEWS.map(stripHiddenTestCases);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedInitial));
      return sanitizedInitial;
    }
    return JSON.parse(raw);
  } catch (_) {
    return INITIAL_INTERVIEWS.map(stripHiddenTestCases);
  }
}

export function cacheInterviewLocally(interview: InterviewItem): InterviewItem {
  if (typeof window === 'undefined') return interview;
  try {
    const safeInterview = stripHiddenTestCases(interview);
    const list = getInterviews();
    const existingIndex = list.findIndex(
      (i) => i.id === safeInterview.id || i.token === safeInterview.token
    );
    let updated: InterviewItem[];
    if (existingIndex >= 0) {
      updated = [...list];
      updated[existingIndex] = safeInterview;
    } else {
      updated = [safeInterview, ...list];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (_) {}
  return interview;
}

export function saveInterview(interview: InterviewItem): InterviewItem {
  cacheInterviewLocally(interview);
  if (typeof window === 'undefined') return interview;
  fetch('/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(interview),
  }).catch(() => {});
  return interview;
}

export function getInterviewById(id: string): InterviewItem | undefined {
  const list = getInterviews();
  return list.find((i) => i.id === id || i.token === id || i.roomId === id);
}

export function getInterviewByToken(token: string): InterviewItem | undefined {
  const list = getInterviews();
  return list.find((i) => i.token === token || i.id === token || i.roomId === token);
}

export async function fetchInterviewByTokenAsync(token: string): Promise<InterviewItem | undefined> {
  // 1. Fetch fresh from server API first (sanitized for candidates)
  try {
    const res = await fetch(`/api/interviews/${token}`);
    if (res.status === 410) {
      return undefined;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        cacheInterviewLocally(data.data);
        return data.data;
      }
    }
  } catch (_) {}

  // 2. Fall back to local storage cache if server request didn't return
  const local = getInterviewByToken(token);
  if (local && local.status !== 'CANCELLED') return local;

  return undefined;
}

export function cacheInterviewStatusLocally(
  id: string,
  status: InterviewItem['status'],
  submission?: InterviewSubmission
): InterviewItem | undefined {
  const list = getInterviews();
  const item = list.find((i) => i.id === id || i.token === id);
  if (!item) return undefined;

  const updated: InterviewItem = {
    ...item,
    status,
    submission: submission || item.submission,
  };
  cacheInterviewLocally(updated);
  return updated;
}

export function updateInterviewStatus(
  id: string,
  status: InterviewItem['status'],
  submission?: InterviewSubmission
): InterviewItem | undefined {
  const updated = cacheInterviewStatusLocally(id, status, submission);
  if (!updated) return undefined;

  fetch(`/api/interviews/${updated.token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  }).catch(() => {});

  return updated;
}
