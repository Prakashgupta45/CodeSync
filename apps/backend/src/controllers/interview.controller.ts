import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { interviewService } from '../services/interview.service';
import {
  createInterviewSchema,
  interviewMessageSchema,
  submitInterviewSchema,
  createPortalInterviewSchema,
  updatePortalInterviewSchema,
} from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';

export class InterviewController {
  public async getProblems(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const problems = await interviewService.getProblems();
      res.status(200).json({ success: true, data: problems });
    } catch (err) {
      next(err);
    }
  }

  public async createInterview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parseResult = createInterviewSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(issue.message, 400, 'INVALID_INTERVIEW_PAYLOAD');
      }

      const { roomId, title, problemId, language, duration, instructions } = parseResult.data;
      const interview = await interviewService.createInterview(
        userId,
        roomId,
        title,
        problemId,
        language,
        duration,
        instructions
      );

      res.status(201).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  public async getInterviewByRoomId(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const roomId = req.params.roomId as string;
      const interview = await interviewService.getInterviewByRoomId(userId, roomId);

      res.status(200).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  public async getInterviewById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const interviewId = req.params.interviewId as string;
      const interview = await interviewService.getInterviewById(userId, interviewId);

      res.status(200).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  public async startInterview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const interviewId = req.params.interviewId as string;
      const interview = await interviewService.startInterview(userId, interviewId);

      res.status(200).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  public async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parseResult = interviewMessageSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(issue.message, 400, 'INVALID_MESSAGE_PAYLOAD');
      }

      const { interviewId, content, action, codeContext, errorContext } = parseResult.data;
      const messages = await interviewService.sendCandidateMessage(
        userId,
        interviewId,
        content,
        action,
        codeContext,
        errorContext
      );

      res.status(200).json({ success: true, data: messages });
    } catch (err) {
      next(err);
    }
  }

  public async completeInterview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parseResult = submitInterviewSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(issue.message, 400, 'INVALID_SUBMISSION_PAYLOAD');
      }

      const { interviewId, finalCode } = parseResult.data;
      const result = await interviewService.completeInterview(userId, interviewId, finalCode);

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public async getUserInterviews(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const interviews = await interviewService.getUserInterviews(userId);
      res.status(200).json({ success: true, data: interviews });
    } catch (err) {
      next(err);
    }
  }

  public async createPortalInterview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parseResult = createPortalInterviewSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(issue.message, 400, 'INVALID_PORTAL_INTERVIEW_PAYLOAD');
      }

      const interview = await interviewService.createPortalInterview(userId, parseResult.data);
      res.status(201).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  public async getCandidateInterview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.params.token as string;
      const interview = await interviewService.getCandidateInterviewByToken(token);
      res.status(200).json({ success: true, data: interview });
    } catch (err) {
      next(err);
    }
  }

  public async updateInterview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const interviewId = req.params.interviewId as string;
      const parseResult = updatePortalInterviewSchema.safeParse(req.body);

      if (!parseResult.success) {
        const issue = parseResult.error.issues[0];
        throw new AppError(issue.message, 400, 'INVALID_UPDATE_PAYLOAD');
      }

      const updated = await interviewService.updatePortalInterview(userId, interviewId, parseResult.data);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public async recordSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.params.token as string;
      const { submission } = req.body || {};
      const result = await interviewService.recordPortalSubmission(token, submission);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  public async getInterviewReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const interviewId = req.params.interviewId as string;
      const report = await interviewService.getPortalInterviewReport(userId, interviewId);
      res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
}

export const interviewController = new InterviewController();
