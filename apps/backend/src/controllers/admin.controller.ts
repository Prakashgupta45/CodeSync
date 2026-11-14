import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { adminService } from '../services/admin.service';
import { auditLogService } from '../services/audit-log.service';

export class AdminController {
  public async getDashboardStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  public async getUsers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string;
      const role = req.query.role as string;
      const status = req.query.status as string;

      const data = await adminService.getUsers({ page, limit, search, role, status });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async updateUserStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = req.params.userId as string;
      const { status } = req.body;
      const updated = await adminService.updateUserStatus(req.user!, targetUserId, status);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public async updateUserRole(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const targetUserId = req.params.userId as string;
      const { role } = req.body;
      const updated = await adminService.updateUserRole(req.user!, targetUserId, role);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  public async getRooms(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string;
      const status = req.query.status as string;

      const data = await adminService.getRooms({ page, limit, search, status });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async terminateRoom(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const roomId = req.params.roomId as string;
      const data = await adminService.terminateRoom(req.user!, roomId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getInterviews(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const difficulty = req.query.difficulty as string;
      const jobRole = req.query.jobRole as string;
      const includeDeleted = req.query.includeDeleted === 'true';

      const data = await adminService.getInterviews({
        page,
        limit,
        search,
        status,
        difficulty,
        jobRole,
        includeDeleted,
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async deleteInterview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const interviewId = req.params.interviewId as string;
      const data = await adminService.deleteInterview(req.user!, interviewId);
      res.status(200).json({
        success: true,
        message: 'Interview deleted successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  public async recoverInterview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const interviewId = req.params.interviewId as string;
      const data = await adminService.recoverInterview(req.user!, interviewId);
      res.status(200).json({
        success: true,
        message: 'Interview recovered successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  public async cancelInterview(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const interviewId = req.params.interviewId as string;
      const data = await adminService.cancelInterview(req.user!, interviewId);
      res.status(200).json({
        success: true,
        message: 'Interview cancelled successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getAuditLogs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const action = req.query.action as string;
      const targetType = req.query.targetType as string;

      const data = await auditLogService.getLogs({ page, limit, action, targetType });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getSystemHealth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await adminService.getSystemHealth();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getAiUsage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await adminService.getAiUsageStats();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getExecutions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await adminService.getExecutionStats();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
