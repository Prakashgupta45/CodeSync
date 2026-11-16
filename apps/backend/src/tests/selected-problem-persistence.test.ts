import { prisma } from '@codesync/database';
import { interviewService } from '../services/interview.service';

describe('Selected Coding Problem Persistence & Multi-Problem Lifecycle Tests', () => {
  let hrUserId: string;
  const createdInterviewIds: string[] = [];
  const createdRoomIds: string[] = [];

  const TEST_PROBLEMS = [
    {
      id: 'q-two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      category: 'Arrays & Hash Maps',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      inputFormat: 'nums = [2,7,11,15], target = 9',
      outputFormat: '[0,1]',
      constraints: ['2 <= nums.length <= 10^4', '-10^9 <= target <= 10^9'],
      examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' }],
      visibleTestCases: [{ id: 1, input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]' }],
      hiddenTestCases: [{ id: 2, input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]' }],
      hiddenTestCount: 1,
      expectedTimeComplexity: 'O(n)',
      expectedSpaceComplexity: 'O(n)',
      starterTemplates: {
        typescript: 'function twoSum(nums: number[], target: number): number[] { return []; }',
        python: 'class Solution:\n    def twoSum(self, nums, target):\n        pass',
      },
    },
    {
      id: 'q-reverse-linked-list',
      title: 'Reverse Linked List',
      difficulty: 'Medium',
      category: 'Linked Lists',
      description: 'Given the head of a singly linked list, reverse the list, and return the reversed list head.',
      inputFormat: 'head = [1,2,3,4,5]',
      outputFormat: '[5,4,3,2,1]',
      constraints: ['0 <= Node.val <= 5000'],
      examples: [{ input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' }],
      visibleTestCases: [{ id: 1, input: 'head = [1,2,3,4,5]', expectedOutput: '[5,4,3,2,1]' }],
      hiddenTestCases: [{ id: 2, input: 'head = [1,2]', expectedOutput: '[2,1]' }],
      hiddenTestCount: 1,
      expectedTimeComplexity: 'O(n)',
      expectedSpaceComplexity: 'O(1)',
      starterTemplates: {
        typescript: 'function reverseList(head: ListNode | null): ListNode | null { return null; }',
        python: 'class Solution:\n    def reverseList(self, head):\n        pass',
      },
    },
    {
      id: 'q-valid-parentheses',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      category: 'Stacks',
      description: 'Given a string s containing just the characters brackets, determine if the input string is valid.',
      inputFormat: 's = "()[]{}"',
      outputFormat: 'true',
      constraints: ['1 <= s.length <= 10^4'],
      examples: [{ input: 's = "()[]{}"', output: 'true' }],
      visibleTestCases: [{ id: 1, input: 's = "()[]{}"', expectedOutput: 'true' }],
      hiddenTestCases: [{ id: 2, input: 's = "(]"', expectedOutput: 'false' }],
      hiddenTestCount: 1,
      expectedTimeComplexity: 'O(n)',
      expectedSpaceComplexity: 'O(n)',
      starterTemplates: {
        typescript: 'function isValid(s: string): boolean { return false; }',
        python: 'class Solution:\n    def isValid(self, s):\n        pass',
      },
    },
    {
      id: 'q-longest-substring',
      title: 'Longest Substring Without Repeating Characters',
      difficulty: 'Medium',
      category: 'Strings & Sliding Window',
      description: 'Given a string s, find the length of the longest substring without repeating characters.',
      inputFormat: 's = "abcabcbb"',
      outputFormat: '3',
      constraints: ['0 <= s.length <= 5 * 10^4'],
      examples: [{ input: 's = "abcabcbb"', output: '3' }],
      visibleTestCases: [{ id: 1, input: 's = "abcabcbb"', expectedOutput: '3' }],
      hiddenTestCases: [{ id: 2, input: 's = "bbbbb"', expectedOutput: '1' }],
      hiddenTestCount: 1,
      expectedTimeComplexity: 'O(n)',
      expectedSpaceComplexity: 'O(min(m, n))',
      starterTemplates: {
        typescript: 'function lengthOfLongestSubstring(s: string): number { return 0; }',
        python: 'class Solution:\n    def lengthOfLongestSubstring(self, s):\n        pass',
      },
    },
    {
      id: 'q-lru-cache',
      title: 'LRU Cache',
      difficulty: 'Hard',
      category: 'Design & Data Structures',
      description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with get and put in O(1).',
      inputFormat: 'capacity = 2, operations: put(1,1), put(2,2), get(1)',
      outputFormat: '1',
      constraints: ['1 <= capacity <= 3000'],
      examples: [{ input: 'capacity = 2', output: '1' }],
      visibleTestCases: [{ id: 1, input: 'capacity = 2', expectedOutput: '1' }],
      hiddenTestCases: [{ id: 2, input: 'capacity = 1', expectedOutput: '1' }],
      hiddenTestCount: 1,
      expectedTimeComplexity: 'O(1)',
      expectedSpaceComplexity: 'O(capacity)',
      starterTemplates: {
        typescript: 'class LRUCache { constructor(capacity: number) {} get(key: number): number { return -1; } put(key: number, value: number): void {} }',
        python: 'class LRUCache:\n    def __init__(self, capacity: int):\n        pass',
      },
    },
  ];

  beforeAll(async () => {
    const hr = await prisma.user.create({
      data: {
        email: `hr_prob_test_${Date.now()}@example.com`,
        passwordHash: 'Password123!',
        name: 'HR Problem Test Lead',
        role: 'USER',
      },
    });
    hrUserId = hr.id;
  });

  afterAll(async () => {
    for (const interviewId of createdInterviewIds) {
      await prisma.interviewMessage.deleteMany({ where: { interviewId } }).catch(() => null);
      await prisma.interviewReport.deleteMany({ where: { interviewId } }).catch(() => null);
      await prisma.interviewEvent.deleteMany({ where: { interviewId } }).catch(() => null);
      await prisma.interview.deleteMany({ where: { id: interviewId } }).catch(() => null);
    }
    for (const roomId of createdRoomIds) {
      await prisma.aiMessage.deleteMany({ where: { roomId } }).catch(() => null);
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => null);
      await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => null);
    }
    await prisma.user.deleteMany({ where: { id: hrUserId } }).catch(() => null);
  });

  TEST_PROBLEMS.forEach((problemDef) => {
    test(`Should persist and retrieve "${problemDef.title}" throughout the complete interview lifecycle`, async () => {
      const payload = {
        title: `${problemDef.title} Assessment`,
        role: 'SDE',
        candidateName: `Candidate for ${problemDef.title}`,
        candidateEmail: `candidate_${problemDef.id}@example.com`,
        experienceLevel: 'Mid-level (2-5 yrs)',
        interviewType: 'DSA',
        difficulty: problemDef.difficulty,
        duration: 45,
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        instructions: `Please solve ${problemDef.title} with optimal complexity.`,
        permittedLanguages: ['typescript', 'python'],
        defaultLanguage: 'typescript',
        problems: [problemDef],
        aiSettings: {
          enableAi: true,
          followUpQuestions: true,
          allowHints: true,
          allowAssistance: true,
          requireApproachExplanation: true,
          enableExecution: true,
          enableVideoProctor: true,
          evaluationCriteria: ['Algorithmic Efficiency', 'Code Quality'],
        },
      };

      // 1. Create interview on backend
      const created = await interviewService.createPortalInterview(hrUserId, payload);
      createdInterviewIds.push(created.id);
      if (created.roomId) createdRoomIds.push(created.roomId);

      expect(created).toBeDefined();
      expect(created.token).toMatch(/^cs_inv_[0-9a-f]{32}$/);

      // 2. Verify Database records
      const dbInterview = await prisma.interview.findUnique({
        where: { id: created.id },
        include: { problem: true },
      });

      expect(dbInterview).toBeDefined();
      expect(dbInterview?.problemId).toBeDefined();
      expect(dbInterview?.problem).toBeDefined();
      expect(dbInterview?.problem?.title).toBe(problemDef.title);

      // 3. Verify Candidate Retrieval by Token (API response)
      const candidateView = await interviewService.getCandidateInterviewByToken(created.token);
      expect(candidateView).toBeDefined();
      expect(candidateView.problems).toHaveLength(1);

      const retrievedProblem = candidateView.problems[0];
      expect(retrievedProblem.title).toBe(problemDef.title);
      expect(retrievedProblem.description).toBe(problemDef.description);
      expect(retrievedProblem.difficulty).toBe(problemDef.difficulty);
      expect(retrievedProblem.expectedTimeComplexity).toBe(problemDef.expectedTimeComplexity);
      expect(retrievedProblem.visibleTestCases).toHaveLength(1);
      expect(retrievedProblem.hiddenTestCases).toEqual([]); // Sanitized for candidate
      expect(retrievedProblem.hiddenTestCount).toBe(problemDef.hiddenTestCount);

      // 4. Verify AI Interviewer receives the correct problem context
      const started = await interviewService.startInterview(hrUserId, created.id);
      expect(started.status).toBe('IN_PROGRESS');

      const messages = await prisma.interviewMessage.findMany({
        where: { interviewId: created.id },
      });
      expect(messages.length).toBeGreaterThan(0);
      const greetingMsg = messages[0].content;
      // Greeting must mention the selected problem title and NOT Two Sum (unless this test is Two Sum)
      if (problemDef.title === 'LRU Cache') {
        expect(greetingMsg).toMatch(/LRU.*Cache/i);
      } else {
        expect(greetingMsg).toContain(problemDef.title);
      }
      if (problemDef.title !== 'Two Sum') {
        expect(greetingMsg).not.toContain('Two Sum');
      }

      // 5. Verify page refresh persistence (fetching again returns same problem)
      const refreshedView = await interviewService.getCandidateInterviewByToken(created.token);
      expect(refreshedView.problems[0].title).toBe(problemDef.title);
    });
  });

  test('Independent Interviews Isolation: 5 separate interviews maintain 5 distinct problems concurrently', async () => {
    const tokens: string[] = [];

    // Create 5 concurrent interviews
    for (const prob of TEST_PROBLEMS) {
      const created = await interviewService.createPortalInterview(hrUserId, {
        title: `Concurrent ${prob.title}`,
        role: 'SDE',
        candidateName: `Candidate ${prob.title}`,
        candidateEmail: `test_${prob.id}@example.com`,
        experienceLevel: 'Mid-level (2-5 yrs)',
        interviewType: 'DSA',
        difficulty: prob.difficulty,
        duration: 45,
        scheduledDate: new Date().toISOString(),
        instructions: '',
        permittedLanguages: ['typescript', 'python'],
        defaultLanguage: 'typescript',
        problems: [prob],
        aiSettings: {
          enableAi: true,
          followUpQuestions: true,
          allowHints: true,
          allowAssistance: true,
          requireApproachExplanation: true,
          enableExecution: true,
          enableVideoProctor: false,
          evaluationCriteria: [],
        },
      });
      createdInterviewIds.push(created.id);
      if (created.roomId) createdRoomIds.push(created.roomId);
      tokens.push(created.token);
    }

    // Retrieve all 5 by token and verify each preserves its distinct problem
    for (let i = 0; i < TEST_PROBLEMS.length; i++) {
      const interviewData = await interviewService.getCandidateInterviewByToken(tokens[i]);
      expect(interviewData.problems[0].title).toBe(TEST_PROBLEMS[i].title);
      expect(interviewData.problems[0].id).toBe(TEST_PROBLEMS[i].id);
    }
  });
});
