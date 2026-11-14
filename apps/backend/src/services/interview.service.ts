import crypto from 'crypto';
import { prisma } from '@codesync/database';
import {
  InterviewDto,
  InterviewMessageDto,
  InterviewReportDto,
  ProblemDto,
  InterviewActionType,
} from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';
import { getIoInstance } from '../socket/collaboration.socket';
import { interviewAiService } from './interview-ai.service';
import { interviewEvaluationService } from './interview-evaluation.service';

const SEED_PROBLEMS = [
  {
    title: 'Two Sum',
    difficulty: 'EASY',
    description:
      'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9',
    examples: JSON.stringify([
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ]),
    starterCode:
      'function twoSum(nums, target) {\n  // Write your O(N) hash map or two-pointer solution here\n  return [];\n}',
  },
  {
    title: 'Valid Anagram',
    difficulty: 'EASY',
    description:
      'Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise. An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.',
    constraints: '1 <= s.length, t.length <= 5 * 10^4',
    examples: JSON.stringify([
      { input: 's = "anagram", t = "nagaram"', output: 'true' },
      { input: 's = "rat", t = "car"', output: 'false' },
    ]),
    starterCode:
      'function isAnagram(s, t) {\n  // Write your solution here\n  return false;\n}',
  },
  {
    title: 'Reverse Linked List',
    difficulty: 'MEDIUM',
    description:
      'Given the `head` of a singly linked list, reverse the list, and return the reversed list head.',
    constraints: 'The number of nodes in the list is in the range [0, 5000].',
    examples: JSON.stringify([
      { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' },
    ]),
    starterCode:
      'function reverseList(head) {\n  // Write your iterative or recursive list reversal here\n  return head;\n}',
  },
];

export class InterviewService {
  /**
   * Seeds default coding problems into database if empty.
   */
  public async ensureSeedProblems(): Promise<ProblemDto[]> {
    const existing = await prisma.problem.findMany();
    if (existing.length === 0) {
      for (const p of SEED_PROBLEMS) {
        await prisma.problem.create({ data: p });
      }
      return (await prisma.problem.findMany()).map(this.mapProblemToDto);
    }
    return existing.map(this.mapProblemToDto);
  }

  /**
   * Fetches available interview problems.
   */
  public async getProblems(): Promise<ProblemDto[]> {
    return this.ensureSeedProblems();
  }

  /**
   * Creates a new Interview session for a coding room (OWNER only).
   */
  public async createInterview(
    userId: string,
    roomId: string,
    title: string,
    problemId?: string,
    language: string = 'javascript',
    duration: number = 45,
    instructions?: string
  ): Promise<InterviewDto> {
    // 1. Verify Room membership & OWNER authorization
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this room', 403, 'FORBIDDEN');
    }

    if (member.role !== 'OWNER') {
      throw new AppError('Only the room OWNER can create an interview', 403, 'FORBIDDEN');
    }

    // 2. Identify Candidate (first PARTICIPANT or OWNER if solo)
    const participantMember = room.members.find((m) => m.role === 'PARTICIPANT') || member;

    let targetProblemId = problemId;
    if (!targetProblemId) {
      const problems = await this.ensureSeedProblems();
      targetProblemId = problems[0]?.id;
    }

    // 3. Create Interview Record
    const interview = await prisma.interview.create({
      data: {
        roomId,
        ownerId: userId,
        candidateId: participantMember.userId,
        problemId: targetProblemId,
        title,
        status: 'READY',
        language,
        duration,
        instructions,
      },
      include: {
        problem: true,
        candidate: { select: { id: true, name: true } },
        messages: true,
      },
    });

    // 4. Log creation event
    await prisma.interviewEvent.create({
      data: {
        interviewId: interview.id,
        eventType: 'INTERVIEW_CREATED',
        payload: `Interview "${title}" created by owner ${userId}`,
      },
    });

    const dto = this.mapInterviewToDto(interview);

    // 5. Broadcast Socket.IO event
    const io = getIoInstance();
    if (io) {
      io.to(roomId).emit('interview:status', dto);
    }

    return dto;
  }

  /**
   * Starts an interview session (OWNER only).
   */
  public async startInterview(userId: string, interviewId: string): Promise<InterviewDto> {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        room: { include: { members: true } },
        problem: true,
        candidate: { select: { id: true, name: true } },
      },
    });

    if (!interview || interview.isDeleted) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const member = interview.room.members.find((m) => m.userId === userId);
    if (!member || member.role !== 'OWNER') {
      throw new AppError('Only room OWNER can start the interview', 403, 'FORBIDDEN');
    }

    // Update status to IN_PROGRESS
    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: {
        problem: true,
        candidate: { select: { id: true, name: true } },
        messages: true,
      },
    });

    // Generate initial AI Interviewer Greeting / Question
    const aiResponse = await interviewAiService.generateInterviewerResponse(
      'START_INTERVIEW',
      interview.problem?.title || interview.title,
      interview.problem?.description || 'Explain your high-level approach.',
      'Starting interview session',
      interview.problem?.starterCode || '',
      interview.language
    );

    // Save initial AI message
    await prisma.interviewMessage.create({
      data: {
        interviewId,
        senderType: 'AI_INTERVIEWER',
        content: aiResponse,
        action: 'START_INTERVIEW',
      },
    });

    await prisma.interviewEvent.create({
      data: {
        interviewId,
        eventType: 'START_INTERVIEW',
        payload: 'Interview started by owner',
      },
    });

    const refreshed = await this.getInterviewById(userId, interviewId);

    const io = getIoInstance();
    if (io) {
      io.to(interview.roomId).emit('interview:start', refreshed);
      io.to(interview.roomId).emit('interview:status', refreshed);
    }

    return refreshed;
  }

  /**
   * Candidate responds to AI Interviewer question.
   */
  public async sendCandidateMessage(
    userId: string,
    interviewId: string,
    content: string,
    action: InterviewActionType = 'ASK_APPROACH',
    codeContext?: string,
    errorContext?: string
  ): Promise<InterviewMessageDto[]> {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        room: { include: { members: true, document: true } },
        problem: true,
      },
    });

    if (!interview || interview.isDeleted) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const member = interview.room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this interview room', 403, 'FORBIDDEN');
    }

    // Security Authorization Guard: VIEWER cannot send candidate prompts/answers
    if (member.role === 'VIEWER') {
      throw new AppError('Viewers have read-only access and cannot send interview messages', 403, 'FORBIDDEN');
    }

    if (interview.status !== 'IN_PROGRESS') {
      throw new AppError('Interview is not currently in progress', 400, 'INTERVIEW_NOT_ACTIVE');
    }

    // 1. Save candidate message
    const candidateMsg = await prisma.interviewMessage.create({
      data: {
        interviewId,
        senderType: 'CANDIDATE',
        senderId: userId,
        content,
        action,
      },
    });

    const activeCode = codeContext || interview.room.document?.content || interview.problem?.starterCode || '';

    // 2. Generate AI Interviewer Follow-up Question
    const aiResponse = await interviewAiService.generateInterviewerResponse(
      action,
      interview.problem?.title || interview.title,
      interview.problem?.description || '',
      content,
      activeCode,
      interview.language,
      errorContext
    );

    // 3. Save AI message
    const aiMsg = await prisma.interviewMessage.create({
      data: {
        interviewId,
        senderType: 'AI_INTERVIEWER',
        content: aiResponse,
        action: errorContext ? 'DEBUG_ERROR' : action,
      },
    });

    // 4. Log event
    await prisma.interviewEvent.create({
      data: {
        interviewId,
        eventType: errorContext ? 'RUNTIME_ERROR' : 'CANDIDATE_ANSWER',
        payload: content.slice(0, 100),
      },
    });

    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const candidateDto: InterviewMessageDto = {
      id: candidateMsg.id,
      interviewId,
      senderType: 'CANDIDATE',
      senderId: userId,
      senderName: userRecord?.name || 'Candidate',
      content: candidateMsg.content,
      action: candidateMsg.action as InterviewActionType,
      createdAt: candidateMsg.createdAt.toISOString(),
    };

    const aiDto: InterviewMessageDto = {
      id: aiMsg.id,
      interviewId,
      senderType: 'AI_INTERVIEWER',
      senderId: null,
      senderName: 'AI Interviewer',
      content: aiMsg.content,
      action: aiMsg.action as InterviewActionType,
      createdAt: aiMsg.createdAt.toISOString(),
    };

    // 5. Broadcast to room via Socket.IO
    const io = getIoInstance();
    if (io) {
      io.to(interview.roomId).emit('interview:message', candidateDto);
      io.to(interview.roomId).emit('interview:message', aiDto);
    }

    return [candidateDto, aiDto];
  }

  /**
   * Completes interview session and generates final evaluation report.
   */
  public async completeInterview(
    userId: string,
    interviewId: string,
    finalCode?: string
  ): Promise<{ interview: InterviewDto; report: InterviewReportDto }> {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        room: { include: { members: true, document: true } },
        problem: true,
        messages: true,
        events: true,
      },
    });

    if (!interview || interview.isDeleted) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const member = interview.room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this interview room', 403, 'FORBIDDEN');
    }

    // VIEWERS cannot complete interviews
    if (member.role === 'VIEWER') {
      throw new AppError('Viewers cannot complete the interview', 403, 'FORBIDDEN');
    }

    const codeToEvaluate = finalCode || interview.room.document?.content || interview.problem?.starterCode || '';
    const hasRuntimeErrors = interview.events.some((e) => e.eventType === 'RUNTIME_ERROR');

    // 1. Generate Evaluation Report
    const reportData = interviewEvaluationService.generateEvaluationReport(
      interviewId,
      interview.problem?.title || interview.title,
      interview.messages.length,
      interview.events.length,
      codeToEvaluate,
      hasRuntimeErrors
    );

    // 2. Persist Report & Update Status to COMPLETED
    const createdReport = await prisma.interviewReport.upsert({
      where: { interviewId },
      create: {
        interviewId,
        overallScore: reportData.overallScore,
        problemSolvingScore: reportData.problemSolvingScore,
        algorithmScore: reportData.algorithmScore,
        codeQualityScore: reportData.codeQualityScore,
        debuggingScore: reportData.debuggingScore,
        complexityScore: reportData.complexityScore,
        communicationScore: reportData.communicationScore,
        strengths: JSON.stringify(reportData.strengths),
        weaknesses: JSON.stringify(reportData.weaknesses),
        improvements: JSON.stringify(reportData.improvements),
        importantEvents: JSON.stringify(reportData.importantEvents),
        assessment: reportData.assessment,
        recommendedNextSteps: reportData.recommendedNextSteps,
      },
      update: {
        overallScore: reportData.overallScore,
        problemSolvingScore: reportData.problemSolvingScore,
        algorithmScore: reportData.algorithmScore,
        codeQualityScore: reportData.codeQualityScore,
        debuggingScore: reportData.debuggingScore,
        complexityScore: reportData.complexityScore,
        communicationScore: reportData.communicationScore,
        strengths: JSON.stringify(reportData.strengths),
        weaknesses: JSON.stringify(reportData.weaknesses),
        improvements: JSON.stringify(reportData.improvements),
        importantEvents: JSON.stringify(reportData.importantEvents),
        assessment: reportData.assessment,
        recommendedNextSteps: reportData.recommendedNextSteps,
      },
    });

    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        problem: true,
        candidate: { select: { id: true, name: true } },
        messages: true,
        report: true,
      },
    });

    const reportDto = this.mapReportToDto(updated.report || createdReport)!;
    const interviewDto = this.mapInterviewToDto(updated);

    // Broadcast completion to room via Socket.IO
    const io = getIoInstance();
    if (io) {
      io.to(interview.roomId).emit('interview:complete', { interview: interviewDto, report: reportDto });
      io.to(interview.roomId).emit('interview:report', reportDto);
    }

    return { interview: interviewDto, report: reportDto };
  }

  /**
   * Gets details for an interview session by room ID.
   */
  public async getInterviewByRoomId(userId: string, roomId: string): Promise<InterviewDto | null> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: { select: { userId: true } } },
    });

    if (!room) {
      throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new AppError('You are not authorized to view interviews for this room', 403, 'FORBIDDEN');
    }

    const interview = await prisma.interview.findFirst({
      where: { roomId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        problem: true,
        candidate: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        report: true,
      },
    });

    return interview ? this.mapInterviewToDto(interview) : null;
  }

  /**
   * Gets details for a specific interview session.
   */
  public async getInterviewById(userId: string, interviewId: string): Promise<InterviewDto> {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        room: { include: { members: { select: { userId: true } } } },
        problem: true,
        candidate: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        report: true,
      },
    });

    if (!interview || interview.isDeleted) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const isMember = interview.room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new AppError('You are not authorized to access this interview session', 403, 'FORBIDDEN');
    }

    return this.mapInterviewToDto(interview);
  }

  private mapProblemToDto(p: any): ProblemDto {
    let examples = [];
    try {
      examples = typeof p.examples === 'string' ? JSON.parse(p.examples) : p.examples;
    } catch (_) {
      examples = [];
    }

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      constraints: p.constraints,
      examples,
      expectedInput: p.expectedInput,
      expectedOutput: p.expectedOutput,
      starterCode: p.starterCode,
    };
  }

  private mapInterviewToDto(i: any): InterviewDto {
    return {
      id: i.id,
      roomId: i.roomId,
      ownerId: i.ownerId,
      candidateId: i.candidateId,
      candidateName: i.candidate?.name || null,
      problemId: i.problemId,
      problem: i.problem ? this.mapProblemToDto(i.problem) : null,
      title: i.title,
      status: i.status,
      language: i.language,
      duration: i.duration,
      instructions: i.instructions,
      startedAt: i.startedAt ? i.startedAt.toISOString() : null,
      completedAt: i.completedAt ? i.completedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      messages: (i.messages || []).map((m: any) => ({
        id: m.id,
        interviewId: m.interviewId,
        senderType: m.senderType,
        senderId: m.senderId,
        senderName: m.senderType === 'AI_INTERVIEWER' ? 'AI Interviewer' : 'Candidate',
        content: m.content,
        action: m.action,
        createdAt: m.createdAt.toISOString(),
      })),
      report: i.report ? this.mapReportToDto(i.report) : null,
    };
  }

  private mapReportToDto(r: any): InterviewReportDto | null {
    if (!r) return null;
    const parseArray = (str: any) => {
      try {
        return typeof str === 'string' ? JSON.parse(str) : (Array.isArray(str) ? str : []);
      } catch (_) {
        return [];
      }
    };

    return {
      id: r.id,
      interviewId: r.interviewId,
      overallScore: r.overallScore,
      problemSolvingScore: r.problemSolvingScore,
      algorithmScore: r.algorithmScore,
      codeQualityScore: r.codeQualityScore,
      debuggingScore: r.debuggingScore,
      complexityScore: r.complexityScore,
      communicationScore: r.communicationScore,
      strengths: parseArray(r.strengths),
      weaknesses: parseArray(r.weaknesses),
      improvements: parseArray(r.improvements),
      importantEvents: parseArray(r.importantEvents),
      assessment: r.assessment,
      recommendedNextSteps: r.recommendedNextSteps,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Translates candidate invite token to UUID and vice-versa
   */
  public tokenToUuid(token: string): string {
    if (!token) return token;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return token;
    }
    const hex = token.replace(/^cs_inv_/, '').replace(/^int-/, '');
    if (hex.length === 32) {
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
      ].join('-');
    }
    return token;
  }

  public uuidToToken(uuid: string): string {
    if (!uuid) return uuid;
    return `cs_inv_${uuid.replace(/-/g, '')}`;
  }

  public mapDbStatusToPortal(status: string): 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' {
    switch (status) {
      case 'IN_PROGRESS':
        return 'ACTIVE';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'READY':
      case 'DRAFT':
      default:
        return 'SCHEDULED';
    }
  }

  public mapPortalStatusToDb(status: string): 'DRAFT' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' {
    switch (status) {
      case 'ACTIVE':
        return 'IN_PROGRESS';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'SCHEDULED':
      default:
        return 'READY';
    }
  }

  public mapInterviewToPortalItem(interview: any, options: { sanitizeForCandidate?: boolean } = {}): any {
    const metadataEvent = interview.events?.find((e: any) => e.eventType === 'PORTAL_METADATA');
    let metadata: any = {};
    if (metadataEvent?.payload) {
      try {
        metadata = JSON.parse(metadataEvent.payload);
      } catch (_) {}
    }

    const submissionEvent = interview.events?.find((e: any) => e.eventType === 'SUBMISSION_RECORD');
    let submission: any = undefined;
    if (submissionEvent?.payload) {
      try {
        submission = JSON.parse(submissionEvent.payload);
      } catch (_) {}
    } else if (interview.report) {
      submission = {
        score: interview.report.overallScore,
        completedAt: interview.report.createdAt ? new Date(interview.report.createdAt).toISOString() : new Date().toISOString(),
        verdict: interview.report.overallScore >= 70 ? 'ACCEPTED' : 'WRONG_ANSWER',
      };
    }

    const token = this.uuidToToken(interview.id);
    const rawProblems = metadata.problems || (interview.problem ? [this.mapProblemToDto(interview.problem)] : []);

    const problems = rawProblems.map((p: any) => {
      const hiddenCount = Array.isArray(p.hiddenTestCases) ? p.hiddenTestCases.length : (p.hiddenTestCount || 0);
      if (options.sanitizeForCandidate) {
        return {
          ...p,
          hiddenTestCases: [],
          hiddenTestCount: hiddenCount,
        };
      }
      return {
        ...p,
        hiddenTestCount: hiddenCount,
      };
    });

    const portalItem: any = {
      id: interview.id,
      token,
      roomId: interview.roomId,
      title: interview.title,
      role: metadata.role || interview.jobRole || 'SDE',
      candidateName: interview.candidateName || metadata.candidateName || 'Candidate',
      candidateEmail: interview.candidateEmail || metadata.candidateEmail || '',
      experienceLevel: metadata.experienceLevel || 'Mid-level (2-5 yrs)',
      interviewType: metadata.interviewType || 'DSA',
      difficulty: metadata.difficulty || (interview.problem?.difficulty ? interview.problem.difficulty.charAt(0) + interview.problem.difficulty.slice(1).toLowerCase() : 'Medium'),
      duration: interview.duration,
      scheduledDate: metadata.scheduledDate || interview.createdAt.toISOString(),
      instructions: interview.instructions || '',
      permittedLanguages: metadata.permittedLanguages || ['typescript', 'python', 'java', 'cpp', 'javascript'],
      defaultLanguage: metadata.defaultLanguage || interview.language || 'typescript',
      problems,
      aiSettings: metadata.aiSettings || {
        enableAi: true,
        followUpQuestions: true,
        allowHints: true,
        allowAssistance: true,
        requireApproachExplanation: true,
        enableExecution: true,
        enableVideoProctor: true,
        evaluationCriteria: ['Algorithmic Efficiency', 'Code Quality & Cleanliness', 'Edge Case Handling', 'Technical Communication'],
      },
      status: this.mapDbStatusToPortal(interview.status),
      createdAt: interview.createdAt.toISOString(),
      submission,
    };

    if (!options.sanitizeForCandidate) {
      portalItem.ownerId = interview.ownerId;
    }

    return portalItem;
  }

  /**
   * Lists all portal interviews owned by authenticated HR user.
   */
  public async getUserInterviews(userId: string): Promise<any[]> {
    const list = await prisma.interview.findMany({
      where: {
        ownerId: userId,
        isDeleted: false,
      },
      include: {
        problem: true,
        report: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((i) => this.mapInterviewToPortalItem(i, { sanitizeForCandidate: false }));
  }

  /**
   * Creates a durable portal interview with PostgreSQL room and metadata event.
   */
  public async createPortalInterview(userId: string, data: any): Promise<any> {
    const shortId = crypto.randomUUID().slice(0, 8);
    const roomId = `room-interview-${shortId}`;

    // 1. Create Room satisfying foreign key and enabling room collaboration
    await prisma.room.create({
      data: {
        id: roomId,
        name: data.title,
        language: data.defaultLanguage || 'typescript',
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });

    // 2. Identify or seed default problem if available
    let problemId: string | undefined = undefined;
    if (data.problems && data.problems.length > 0 && data.problems[0].id) {
      const existingProb = await prisma.problem.findUnique({ where: { id: data.problems[0].id } });
      if (existingProb) {
        problemId = existingProb.id;
      }
    }

    // 3. Create Interview in PostgreSQL
    const interview = await prisma.interview.create({
      data: {
        roomId,
        ownerId: userId,
        title: data.title,
        candidateName: data.candidateName,
        candidateEmail: data.candidateEmail,
        jobRole: data.role,
        status: 'READY',
        language: data.defaultLanguage || 'typescript',
        duration: data.duration,
        instructions: data.instructions || '',
        problemId,
      },
      include: {
        problem: true,
        report: true,
        events: true,
      },
    });

    // 4. Save full portal metadata in InterviewEvent
    const metadataPayload = {
      role: data.role,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail,
      experienceLevel: data.experienceLevel,
      interviewType: data.interviewType,
      difficulty: data.difficulty,
      scheduledDate: data.scheduledDate,
      permittedLanguages: data.permittedLanguages,
      defaultLanguage: data.defaultLanguage,
      problems: data.problems,
      aiSettings: data.aiSettings,
    };

    const metaEvent = await prisma.interviewEvent.create({
      data: {
        interviewId: interview.id,
        eventType: 'PORTAL_METADATA',
        payload: JSON.stringify(metadataPayload),
      },
    });

    const fullInterview = {
      ...interview,
      events: [metaEvent],
    };

    return this.mapInterviewToPortalItem(fullInterview, { sanitizeForCandidate: false });
  }

  /**
   * Fetches interview for candidate using invite token or ID, strictly sanitizing hidden cases.
   */
  public async getCandidateInterviewByToken(tokenOrId: string): Promise<any> {
    const targetId = this.tokenToUuid(tokenOrId);

    const interview = await prisma.interview.findFirst({
      where: {
        OR: [
          { id: targetId },
          { id: tokenOrId },
          { roomId: tokenOrId },
        ],
        isDeleted: false,
      },
      include: {
        problem: true,
        report: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!interview) {
      throw new AppError('Interview session not found or link has expired', 404, 'INTERVIEW_NOT_FOUND');
    }

    if (interview.status === 'CANCELLED') {
      throw new AppError('This interview invitation has been cancelled or revoked.', 410, 'INTERVIEW_CANCELLED');
    }

    return this.mapInterviewToPortalItem(interview, { sanitizeForCandidate: true });
  }

  /**
   * Updates an interview record (enforcing owner authorization).
   */
  public async updatePortalInterview(
    userId: string,
    tokenOrId: string,
    updates: { status?: string; scheduledDate?: string; instructions?: string }
  ): Promise<any> {
    const targetId = this.tokenToUuid(tokenOrId);

    const interview = await prisma.interview.findFirst({
      where: {
        OR: [
          { id: targetId },
          { id: tokenOrId },
          { roomId: tokenOrId },
        ],
        isDeleted: false,
      },
      include: {
        events: true,
        problem: true,
        report: true,
      },
    });

    if (!interview) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    if (interview.ownerId !== userId) {
      throw new AppError('You are not authorized to modify this interview', 403, 'FORBIDDEN');
    }

    const updateData: any = {};
    if (updates.status) {
      updateData.status = this.mapPortalStatusToDb(updates.status);
      if (updates.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }
    if (updates.instructions !== undefined) {
      updateData.instructions = updates.instructions;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.interview.update({
        where: { id: interview.id },
        data: updateData,
      });
    }

    if (updates.scheduledDate) {
      const metaEvent = interview.events.find((e) => e.eventType === 'PORTAL_METADATA');
      if (metaEvent && metaEvent.payload) {
        try {
          const parsed = JSON.parse(metaEvent.payload);
          parsed.scheduledDate = updates.scheduledDate;
          await prisma.interviewEvent.update({
            where: { id: metaEvent.id },
            data: { payload: JSON.stringify(parsed) },
          });
        } catch (_) {}
      }
    }

    const refreshed = await prisma.interview.findUnique({
      where: { id: interview.id },
      include: {
        problem: true,
        report: true,
        events: { orderBy: { createdAt: 'desc' } },
      },
    });

    return this.mapInterviewToPortalItem(refreshed, { sanitizeForCandidate: false });
  }

  /**
   * Persists completed candidate evaluation report and submission record into PostgreSQL.
   */
  public async recordPortalSubmission(tokenOrId: string, submission: any): Promise<any> {
    const targetId = this.tokenToUuid(tokenOrId);

    const interview = await prisma.interview.findFirst({
      where: {
        OR: [
          { id: targetId },
          { id: tokenOrId },
          { roomId: tokenOrId },
        ],
        isDeleted: false,
      },
    });

    if (!interview) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    if (interview.status === 'CANCELLED') {
      throw new AppError('Interview session has been cancelled', 410, 'INTERVIEW_CANCELLED');
    }

    // 1. Update Interview status to COMPLETED
    await prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 2. Persist InterviewReport in PostgreSQL
    const score = typeof submission?.score === 'number' ? submission.score : 0;
    const assessment = score >= 85 ? 'STRONG_HIRE' : score >= 65 ? 'HIRE' : 'NEEDS_WORK';
    const strengths = score >= 70 ? ['Correct solution output', 'Clean code structure'] : ['Attempted implementation'];
    const weaknesses = score < 100 ? ['Some hidden or edge cases failed'] : [];
    const improvements = ['Optimize time and space complexity', 'Handle boundary edge cases'];

    await prisma.interviewReport.upsert({
      where: { interviewId: interview.id },
      create: {
        interviewId: interview.id,
        overallScore: score,
        problemSolvingScore: Math.min(100, Math.round(score * 1.05)),
        algorithmScore: score,
        codeQualityScore: Math.min(100, Math.round(score * 0.95 + 10)),
        debuggingScore: score === 100 ? 95 : 70,
        complexityScore: score >= 80 ? 90 : 65,
        communicationScore: 85,
        strengths: JSON.stringify(strengths),
        weaknesses: JSON.stringify(weaknesses),
        improvements: JSON.stringify(improvements),
        importantEvents: JSON.stringify([`Submission in ${submission?.language || 'code'} scored ${score}%`]),
        assessment,
        recommendedNextSteps: score >= 70 ? 'Advance to next round' : 'Review fundamental algorithms',
      },
      update: {
        overallScore: score,
        problemSolvingScore: Math.min(100, Math.round(score * 1.05)),
        algorithmScore: score,
        codeQualityScore: Math.min(100, Math.round(score * 0.95 + 10)),
        debuggingScore: score === 100 ? 95 : 70,
        complexityScore: score >= 80 ? 90 : 65,
        communicationScore: 85,
        strengths: JSON.stringify(strengths),
        weaknesses: JSON.stringify(weaknesses),
        improvements: JSON.stringify(improvements),
        importantEvents: JSON.stringify([`Submission in ${submission?.language || 'code'} scored ${score}%`]),
        assessment,
        recommendedNextSteps: score >= 70 ? 'Advance to next round' : 'Review fundamental algorithms',
      },
    });

    // 3. Save Submission Record in InterviewEvent
    await prisma.interviewEvent.create({
      data: {
        interviewId: interview.id,
        eventType: 'SUBMISSION_RECORD',
        payload: JSON.stringify(submission),
      },
    });

    return { success: true, interviewId: interview.id };
  }

  /**
   * Fetches durable evaluation report for an interview.
   */
  public async getPortalInterviewReport(userId: string, tokenOrId: string): Promise<any> {
    const targetId = this.tokenToUuid(tokenOrId);

    const interview = await prisma.interview.findFirst({
      where: {
        OR: [
          { id: targetId },
          { id: tokenOrId },
          { roomId: tokenOrId },
        ],
        isDeleted: false,
      },
      include: {
        report: true,
        room: {
          include: { members: true },
        },
        events: true,
      },
    });

    if (!interview) {
      throw new AppError('Interview not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const isOwner = interview.ownerId === userId;
    const isMember = interview.room?.members?.some((m) => m.userId === userId);
    if (!isOwner && !isMember) {
      throw new AppError('You are not authorized to view this report', 403, 'FORBIDDEN');
    }

    if (!interview.report) {
      throw new AppError('Evaluation report not yet available for this interview', 404, 'REPORT_NOT_FOUND');
    }

    return this.mapReportToDto(interview.report);
  }
}

export const interviewService = new InterviewService();
