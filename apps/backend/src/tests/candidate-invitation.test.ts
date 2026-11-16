import { prisma } from '@codesync/database';
import { interviewService } from '../services/interview.service';
import { executionService } from '../services/execution.service';
import { aiService } from '../services/ai.service';
import { signCandidateInterviewToken, verifyCandidateInterviewToken } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';

describe('Candidate Interview Invitation & Verification Tests', () => {
  let hrUserId: string;
  let testInterviewId: string;
  let testToken: string;
  let testRoomId: string;

  beforeAll(async () => {
    // Create test HR user
    const hr = await prisma.user.create({
      data: {
        email: `hr_candidate_test_${Date.now()}@example.com`,
        passwordHash: 'Password123!',
        name: 'HR Test Lead',
        role: 'USER',
      },
    });
    hrUserId = hr.id;

    // Create interview
    const payload = {
      title: 'Senior Frontend Assessment',
      role: 'Frontend Engineer',
      candidateName: 'Test Candidate',
      candidateEmail: 'candidate@example.com',
      experienceLevel: 'Mid-Senior',
      interviewType: 'Frontend',
      difficulty: 'Medium',
      duration: 45,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      instructions: 'Solve the problem cleanly with good performance.',
      permittedLanguages: ['javascript', 'typescript', 'python'],
      defaultLanguage: 'typescript',
      problems: [
        {
          id: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          category: 'Array',
          description: 'Return indices summing to target',
          inputFormat: 'nums, target',
          outputFormat: '[i, j]',
          constraints: ['2 <= nums.length <= 10^4'],
          examples: [{ input: '[2,7,11,15], 9', output: '[0,1]' }],
          visibleTestCases: [{ id: 1, input: '[2,7,11,15], 9', expectedOutput: '[0,1]' }],
          hiddenTestCases: [{ id: 2, input: '[3,2,4], 6', expectedOutput: '[1,2]' }],
          hiddenTestCount: 1,
          expectedTimeComplexity: 'O(N)',
          expectedSpaceComplexity: 'O(N)',
          starterTemplates: { typescript: 'function twoSum() {}' },
        },
      ],
      aiSettings: {
        enableAi: true,
        followUpQuestions: true,
        allowHints: true,
        allowAssistance: true,
        requireApproachExplanation: false,
        enableExecution: true,
        enableVideoProctor: false,
        evaluationCriteria: ['Problem Solving', 'Code Quality'],
      },
    };

    const created = await interviewService.createPortalInterview(hrUserId, payload);
    testInterviewId = created.id;
    testToken = created.token;
    testRoomId = created.roomId!;
  });

  afterAll(async () => {
    // Clean up
    await prisma.aiMessage.deleteMany({ where: { roomId: testRoomId } }).catch(() => null);
    await prisma.interviewReport.deleteMany({ where: { interview: { ownerId: hrUserId } } }).catch(() => null);
    await prisma.interviewEvent.deleteMany({ where: { interview: { ownerId: hrUserId } } }).catch(() => null);
    await prisma.interview.deleteMany({ where: { ownerId: hrUserId } }).catch(() => null);
    await prisma.roomMember.deleteMany({ where: { userId: hrUserId } }).catch(() => null);
    await prisma.room.deleteMany({ where: { ownerId: hrUserId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: hrUserId } }).catch(() => null);
  });

  test('1. Should look up interview by invite token (cs_inv_...) and return sanitized candidate payload', async () => {
    const candidateData = await interviewService.getCandidateInterviewByToken(testToken);

    expect(candidateData).toBeDefined();
    expect(candidateData.id).toBe(testInterviewId);
    expect(candidateData.token).toBe(testToken);
    expect(candidateData.candidateName).toBe('Test Candidate');
    expect(candidateData.candidateEmail).toBe('candidate@example.com');
    expect(candidateData.title).toBe('Senior Frontend Assessment');
    expect(candidateData.roomId).toBe(testRoomId);

    // Verify hidden test cases and ownerId are sanitized from candidate view
    const problem = candidateData.problems?.[0];
    expect(problem).toBeDefined();
    expect(problem.visibleTestCases).toHaveLength(1);
    expect(problem.hiddenTestCases).toEqual([]);
    expect(problem.hiddenTestCount).toBe(1);
    expect(candidateData.ownerId).toBeUndefined();
  });

  test('2. Should reject unknown or nonexistent token with 404', async () => {
    const nonExistentToken = 'cs_inv_00000000000000000000000000000000';
    await expect(interviewService.getCandidateInterviewByToken(nonExistentToken)).rejects.toThrow(
      'Interview session not found or link has expired'
    );
  });

  test('3. Should reject malformed token format with 404', async () => {
    const malformedToken = 'invalid-token-format-xyz';
    await expect(interviewService.getCandidateInterviewByToken(malformedToken)).rejects.toThrow(
      'Interview session not found or link has expired'
    );
  });

  test('4. Should sign and verify candidate interview JWT', () => {
    const candidateJwt = signCandidateInterviewToken(testToken, testRoomId);
    expect(candidateJwt).toBeDefined();
    expect(typeof candidateJwt).toBe('string');

    // Verify decoded contents
    const decoded = verifyCandidateInterviewToken(candidateJwt);
    expect(decoded.inviteToken).toBe(testToken);
    expect(decoded.roomId).toBe(testRoomId);
    expect(decoded.purpose).toBe('CANDIDATE_INTERVIEW');

    // Tampered token rejection
    const tampered = candidateJwt.slice(0, -6) + 'abcdef';
    expect(() => verifyCandidateInterviewToken(tampered)).toThrow();
  });

  test('5. Should allow candidate execution with verified candidate authorization', async () => {
    const execResult = await executionService.runRoomCode(
      testRoomId,
      'candidate-user',
      'typescript',
      'console.log("Candidate code execution verified!");',
      testRoomId
    );

    expect(execResult).toBeDefined();
    expect(execResult.roomId).toBe(testRoomId);
    expect(execResult.executedBy.userId).toBe('candidate-user');
    expect(execResult.executedBy.name).toBe('Candidate');
    expect(execResult.executedBy.role).toBe('PARTICIPANT');
    expect(execResult.stdout).toContain('Candidate code execution verified!');
  });

  test('6. Should allow candidate AI prompt with foreign key safety', async () => {
    const aiResult = await aiService.promptAi(
      testRoomId,
      'candidate-user',
      'EXPLAIN',
      'Please explain this function stub',
      'function test() { return 42; }',
      undefined,
      testRoomId
    );

    expect(aiResult).toBeDefined();
    expect(aiResult.roomId).toBe(testRoomId);
    expect(aiResult.userId).toBe('candidate-user');
    expect(aiResult.userName).toBe('Candidate');
    expect(aiResult.response).toBeDefined();
    expect(aiResult.response.length).toBeGreaterThan(10);

    // Verify persisted in PostgreSQL without foreign key violation
    const savedMessage = await prisma.aiMessage.findFirst({
      where: { roomId: testRoomId },
    });
    expect(savedMessage).toBeDefined();
    expect(savedMessage?.userId).toBe(hrUserId); // Foreign key mapped to room owner
  });

  test('7. Should reject cancelled interview with 410', async () => {
    // Cancel the interview
    await prisma.interview.update({
      where: { id: testInterviewId },
      data: { status: 'CANCELLED' },
    });

    try {
      await interviewService.getCandidateInterviewByToken(testToken);
      fail('Expected 410 error to be thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(410);
      expect(err.message).toBe('This interview invitation has been cancelled or revoked.');
    }
  });
});
