import { prisma } from '@codesync/database';
import { interviewService } from '../services/interview.service';

describe('Phase 19 — Durable Interview Persistence Tests', () => {
  let hrUserId: string;
  let outsiderUserId: string;
  let testInterviewId: string;
  let testToken: string;

  beforeAll(async () => {
    // 1. Create test HR user
    const hr = await prisma.user.create({
      data: {
        email: `hr_p19_${Date.now()}@example.com`,
        passwordHash: 'Password123!',
        name: 'HR Lead Phase 19',
        role: 'USER',
      },
    });
    hrUserId = hr.id;

    // 2. Create test outsider user
    const outsider = await prisma.user.create({
      data: {
        email: `outsider_p19_${Date.now()}@example.com`,
        passwordHash: 'Password123!',
        name: 'Outsider Phase 19',
        role: 'USER',
      },
    });
    outsiderUserId = outsider.id;
  });

  afterAll(async () => {
    // Clean up all created test data
    await prisma.interviewReport.deleteMany({ where: { interview: { ownerId: hrUserId } } }).catch(() => null);
    await prisma.interviewEvent.deleteMany({ where: { interview: { ownerId: hrUserId } } }).catch(() => null);
    await prisma.interview.deleteMany({ where: { ownerId: hrUserId } }).catch(() => null);
    await prisma.roomMember.deleteMany({ where: { userId: hrUserId } }).catch(() => null);
    await prisma.room.deleteMany({ where: { ownerId: hrUserId } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: [hrUserId, outsiderUserId] } } }).catch(() => null);
  });

  test('1. Should create a durable portal interview with PostgreSQL room and metadata event', async () => {
    const payload = {
      title: 'Senior Systems Architect Interview',
      role: 'Full Stack Developer',
      candidateName: 'Alice Candidate',
      candidateEmail: 'alice@candidate.ai',
      experienceLevel: 'Senior (5+ yrs)',
      interviewType: 'Full Stack',
      difficulty: 'Hard',
      duration: 60,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      instructions: 'Please walk through your high-level architecture before coding.',
      permittedLanguages: ['typescript', 'python'],
      defaultLanguage: 'typescript',
      problems: [
        {
          id: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          category: 'Array',
          description: 'Find two indices summing to target.',
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
        requireApproachExplanation: true,
        enableExecution: true,
        enableVideoProctor: true,
        evaluationCriteria: ['Algorithmic Efficiency', 'System Design'],
      },
    };

    const created = await interviewService.createPortalInterview(hrUserId, payload);
    testInterviewId = created.id;
    testToken = created.token;

    expect(created.id).toBeDefined();
    expect(created.token).toMatch(/^cs_inv_[0-9a-f]{32}$/);
    expect(created.status).toBe('SCHEDULED');
    expect(created.ownerId).toBe(hrUserId);

    // Verify persisted directly in PostgreSQL
    const dbRecord = await prisma.interview.findUnique({
      where: { id: created.id },
      include: { room: true, events: true },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.roomId).toBeDefined();
    expect(dbRecord?.room.ownerId).toBe(hrUserId);

    const metaEvent = dbRecord?.events.find((e) => e.eventType === 'PORTAL_METADATA');
    expect(metaEvent).toBeDefined();
    const metaParsed = JSON.parse(metaEvent!.payload!);
    expect(metaParsed.candidateName).toBe('Alice Candidate');
  });

  test('2. Should resolve candidate view via invite token and sanitize hidden test cases', async () => {
    const candidateView = await interviewService.getCandidateInterviewByToken(testToken);

    expect(candidateView.title).toBe('Senior Systems Architect Interview');
    expect(candidateView.candidateName).toBe('Alice Candidate');
    expect(candidateView.ownerId).toBeUndefined(); // Stripped for candidate privacy

    const prob = candidateView.problems[0];
    expect(prob.visibleTestCases).toHaveLength(1);
    expect(prob.hiddenTestCases).toHaveLength(0); // Strictly sanitized!
    expect(prob.hiddenTestCount).toBe(1);
  });

  test('3. Should record candidate submission and persist InterviewReport in PostgreSQL', async () => {
    const submissionRecord = {
      submittedCode: 'function twoSum(nums, target) { return [0, 1]; }',
      language: 'typescript',
      score: 100,
      visiblePassed: 1,
      visibleTotal: 1,
      hiddenPassed: 1,
      hiddenTotal: 1,
      runtimeMs: 12,
      memoryMb: '256 MB Limit',
      verdict: 'ACCEPTED',
      completedAt: new Date().toISOString(),
    };

    await interviewService.recordPortalSubmission(testToken, submissionRecord);

    const updated = await prisma.interview.findUnique({
      where: { id: testInterviewId },
      include: { report: true, events: true },
    });

    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.report).not.toBeNull();
    expect(updated?.report?.overallScore).toBe(100);
    expect(updated?.report?.assessment).toBe('STRONG_HIRE');

    const subEvent = updated?.events.find((e) => e.eventType === 'SUBMISSION_RECORD');
    expect(subEvent).toBeDefined();
  });

  test('4. Should list user interviews from PostgreSQL with completion status and report', async () => {
    const list = await interviewService.getUserInterviews(hrUserId);

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(testInterviewId);
    expect(list[0].status).toBe('COMPLETED');
    expect(list[0].submission?.score).toBe(100);
    expect(list[0].submission?.verdict).toBe('ACCEPTED');
  });

  test('5. Should enforce ownership authorization against unauthorized modification', async () => {
    await expect(
      interviewService.updatePortalInterview(outsiderUserId, testInterviewId, { instructions: 'Malicious modification' })
    ).rejects.toThrow('You are not authorized to modify this interview');
  });

  test('6. Should fetch durable interview report directly from PostgreSQL', async () => {
    const report = await interviewService.getPortalInterviewReport(hrUserId, testInterviewId);

    expect(report).not.toBeNull();
    expect(report.overallScore).toBe(100);
    expect(report.assessment).toBe('STRONG_HIRE');
  });
});
