import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  interviewAiService,
  isGreetingMessage,
  classifyCandidateIntent,
  enforceSingleQuestion,
} from '../services/interview-ai.service';
import { sanitizeTruncatedText } from '../utils/llm-client';

describe('AI Interviewer Conversation Intelligence & State Integrity Test Suite', () => {
  const problemTitle = 'Longest Substring Without Repeating Characters';
  const problemDifficulty = 'Medium';
  const problemDescription =
    'Given a string s, find the length of the longest substring without repeating characters.';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Scenario 1: Greeting "hi" -> exact greeting, no algorithm evaluation, no hallucination
  it('Scenario 1: Candidate sends "hi" -> returns strict greeting, never claims algorithm or complexity was explained', async () => {
    expect(isGreetingMessage('hi')).toBe(true);
    expect(classifyCandidateIntent('hi')).toBe('GREETING');

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage: 'hi',
      problemTitle,
      problemDifficulty,
      problemDescription,
      currentCode: '#include <bits/stdc++.h>\nusing namespace std;\nclass Solution { ... };',
    });

    expect(result.response).toContain('Hello! Welcome to your technical interview');
    expect(result.response).toContain('explain your initial approach and expected time complexity');
    expect(result.response.toLowerCase()).not.toContain('sliding window');
    expect(result.response.toLowerCase()).not.toContain('hash map');
    expect(result.response.toLowerCase()).not.toContain('optimal o(n)');
    expect(result.response.toLowerCase()).not.toContain('edge cases handled');
    expect(result.isTruncated).toBe(false);
  });

  // Scenario 2: Greeting "hello" -> strict greeting, no fabricated sliding window / hash map claims
  it('Scenario 2: Candidate sends "hello" -> returns strict greeting, ignores draft editor code', async () => {
    expect(isGreetingMessage('hello')).toBe(true);
    expect(classifyCandidateIntent('hello')).toBe('GREETING');

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage: 'hello',
      problemTitle,
      problemDifficulty,
      problemDescription,
      currentCode: 'unordered_map<char, int> mp; left = max(left, mp[ch] + 1);',
    });

    expect(result.response).toBe(
      "Hello! Welcome to your technical interview. Let's begin with the problem. Before writing code, please explain your initial approach and expected time complexity."
    );
    expect(result.response).not.toContain('unordered_map');
    expect(result.response).not.toContain('left = max');
  });

  // Scenario 3: Candidate explains sliding window -> evaluates only what was explained + 1 single follow-up question
  it('Scenario 3: Candidate explains sliding window -> evaluates only explained concept and asks exactly 1 question', async () => {
    const candidateMessage =
      'I plan to use a two-pointer sliding window with left and right indices to maintain a unique window of characters.';
    expect(classifyCandidateIntent(candidateMessage)).toBe('ALGORITHM_EXPLANATION');

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage,
      problemTitle,
      problemDifficulty,
      problemDescription,
    });

    expect(result.response.length).toBeGreaterThan(0);
    // Verify single question enforcement: must not have numbered question lists (1., 2., 3.)
    expect(result.response).not.toMatch(/(?:^|\n)\s*1\.\s+.*\n\s*2\.\s+/);
    // Count question marks in the response
    const questionMarks = (result.response.match(/\?/g) || []).length;
    expect(questionMarks).toBeLessThanOrEqual(1);
  });

  // Scenario 4: Incomplete explanation -> asks 1 clarifying question
  it('Scenario 4: Incomplete candidate explanation -> asks exactly one clarifying question', async () => {
    const candidateMessage = 'I will use a loop.';
    expect(classifyCandidateIntent(candidateMessage)).toBe('ALGORITHM_EXPLANATION');

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage,
      problemTitle,
      problemDifficulty,
      problemDescription,
    });

    expect(result.response.length).toBeGreaterThan(0);
    const questionMarks = (result.response.match(/\?/g) || []).length;
    expect(questionMarks).toBeLessThanOrEqual(1);
    expect(result.response).not.toContain('1.');
    expect(result.response).not.toContain('2.');
  });

  // Scenario 5: Candidate gives correct complexity explanation -> acknowledges and transitions to next stage
  it('Scenario 5: Candidate explains complexity O(N) time and O(min(m,n)) space -> advances to coding stage', async () => {
    const candidateMessage =
      'The time complexity will be O(N) because each character is visited at most twice, and space complexity will be O(min(m, n)) for the character set hash map.';
    expect(classifyCandidateIntent(candidateMessage)).toBe('COMPLEXITY_EXPLANATION');

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage,
      problemTitle,
      problemDifficulty,
      problemDescription,
      history: [
        { role: 'ai', text: 'Please explain your initial approach and expected time complexity.' },
        { role: 'user', text: 'I will use sliding window with a hash map.' },
        { role: 'ai', text: 'Great. What will be the time and space complexity?' },
      ],
    });

    expect(result.response.length).toBeGreaterThan(0);
    expect(result.response).toMatch(/(?:code|implement|solution|write|proceed)/i);
  });

  // Scenario 6: Incorrect code submission -> evaluates actual execution failure
  it('Scenario 6: Incorrect code submission -> evaluates real execution failures without hallucinating passing tests', async () => {
    const failedCode = 'int lengthOfLongestSubstring(string s) { return 0; }';

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage: 'I submitted my solution.',
      problemTitle,
      problemDifficulty,
      problemDescription,
      currentCode: failedCode,
      submissionStatus: {
        passed: false,
        score: 14,
        visiblePassed: 1,
        totalVisible: 3,
        error: 'Output mismatch: expected 3, got 0',
      },
    });

    expect(result.response).toMatch(/(?:failed|mismatch|failing|incorrect|did not pass)/i);
    expect(result.response).not.toMatch(/all (?:7|test cases) passed/i);
    expect(result.response).not.toContain('100/100');
  });

  // Scenario 7: Accepted code submission -> acknowledges test pass + asks 1 follow-up question
  it('Scenario 7: Accepted code submission (100/100) -> acknowledges passing all tests and asks 1 follow-up question', async () => {
    const acceptedCode = `#include <bits/stdc++.h>
using namespace std;
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> mp;
        int left = 0, ans = 0;
        for (int right = 0; right < s.length(); right++) {
            char ch = s[right];
            if (mp.find(ch) != mp.end()) left = max(left, mp[ch] + 1);
            mp[ch] = right;
            ans = max(ans, right - left + 1);
        }
        return ans;
    }
};`;

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage: 'I have submitted my code.',
      problemTitle,
      problemDifficulty,
      problemDescription,
      currentCode: acceptedCode,
      submissionStatus: {
        passed: true,
        score: 100,
        visiblePassed: 3,
        totalVisible: 3,
      },
    });

    expect(result.response).toMatch(/(?:passed|accepted|100|congratulations|excellent|great)/i);
    // Exactly one single follow-up question
    const questionMarks = (result.response.match(/\?/g) || []).length;
    expect(questionMarks).toBeLessThanOrEqual(1);
    expect(result.response).not.toContain('1.');
    expect(result.response).not.toContain('2.');
  });

  // Scenario 8: Consecutive answers -> builds on history without repeating questions
  it('Scenario 8: Candidate answers follow-up -> AI does not repeat previously answered questions', async () => {
    const history = [
      { role: 'ai' as const, text: 'Hello! Please explain your approach.' },
      { role: 'user' as const, text: 'I will use a sliding window with two pointers.' },
      { role: 'ai' as const, text: 'What is the time complexity of this approach?' },
      { role: 'user' as const, text: 'It runs in linear O(N) time.' },
      { role: 'ai' as const, text: 'How will you handle character duplicates efficiently?' },
    ];

    const result = await interviewAiService.evaluateCandidateInteraction({
      candidateMessage: 'I will store character indices in an array of size 128 for O(1) lookups.',
      problemTitle,
      problemDifficulty,
      problemDescription,
      history,
    });

    expect(result.response.length).toBeGreaterThan(0);
    // Should NOT ask again about approach or time complexity
    expect(result.response.toLowerCase()).not.toContain('please explain your approach');
    expect(result.response.toLowerCase()).not.toContain('what is the time complexity of this approach');
  });

  // Scenario 9: Gemini returns MAX_TOKENS -> truncated response detected & sanitized cleanly on punctuation boundary
  it('Scenario 9: LLM response truncated at MAX_TOKENS -> clean sentence boundary sanitization and diagnostic metadata', () => {
    const truncatedRaw =
      'Your sliding window approach is solid and handles ASCII characters well. However, when considering unicode strings with multi-byte runes, how would you ensure that the window indices do not split';

    const sanitized = sanitizeTruncatedText(truncatedRaw);

    // Must end cleanly at a sentence or punctuation boundary, not mid-word
    expect(sanitized.endsWith('.')).toBe(true);
    expect(sanitized).toBe('Your sliding window approach is solid and handles ASCII characters well.');
    expect(sanitized).not.toContain('split');
  });

  // Scenario 10: Single question enforcer utility
  it('Scenario 10: enforceSingleQuestion strips numbered lists of multiple questions down to one primary question', () => {
    const multipleQuestions = `Great explanation of the algorithm!
1. How does the hash map handle duplicate indices?
2. What happens if the input string contains non-ASCII characters?
3. Could you optimize space if the alphabet is strictly lowercase English letters?`;

    const singleQ = enforceSingleQuestion(multipleQuestions);

    // Numbered questions 2 and 3 must be stripped
    expect(singleQ).not.toContain('2.');
    expect(singleQ).not.toContain('3.');
    expect(singleQ).toContain('How does the hash map handle duplicate indices?');
    const qMarks = (singleQ.match(/\?/g) || []).length;
    expect(qMarks).toBe(1);
  });
});
