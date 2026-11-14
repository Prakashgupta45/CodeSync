import { prisma } from '@codesync/database';
import { AppError } from '../middleware/error.middleware';
import { auditLogService } from './audit-log.service';
import { dockerRunnerService } from './docker-runner.service';
import { getIoInstance } from '../socket/collaboration.socket';
import { TokenPayload } from '../utils/jwt';
import os from 'os';

export class AdminService {
  /**
   * Fetches high-level platform statistics for the Admin Dashboard.
   */
  public async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalRooms,
      activeRooms,
      totalInterviews,
      scheduledInterviews,
      activeInterviews,
      completedInterviews,
      cancelledInterviews,
      deletedInterviews,
      totalAiMessages,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.room.count(),
      prisma.room.count({ where: { status: 'ACTIVE' } }),
      prisma.interview.count({ where: { isDeleted: false } }),
      prisma.interview.count({
        where: {
          isDeleted: false,
          status: { in: ['READY', 'DRAFT'] },
        },
      }),
      prisma.interview.count({
        where: { isDeleted: false, status: 'IN_PROGRESS' },
      }),
      prisma.interview.count({
        where: { isDeleted: false, status: 'COMPLETED' },
      }),
      prisma.interview.count({
        where: { isDeleted: false, status: 'CANCELLED' },
      }),
      prisma.interview.count({ where: { isDeleted: true } }),
      prisma.aiMessage.count(),
    ]);

    const hrUsers = Math.max(0, totalUsers - adminUsers);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        hrUsers,
        admins: adminUsers,
      },
      rooms: {
        total: totalRooms,
        active: activeRooms,
      },
      interviews: {
        total: totalInterviews,
        scheduled: scheduledInterviews,
        active: activeInterviews,
        completed: completedInterviews,
        cancelled: cancelledInterviews,
        deleted: deletedInterviews,
      },
      ai: {
        totalRequests: totalAiMessages,
      },
    };
  }

  /**
   * Lists users with search, role and status filters, and pagination.
   */
  public async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.role && params.role !== 'ALL') {
      where.role = params.role;
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              ownedRooms: true,
              ownedInterviews: true,
            },
          },
        },
      }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Suspends or reactivates a user account with safety guards.
   */
  public async updateUserStatus(
    actor: TokenPayload,
    targetUserId: string,
    nextStatus: 'ACTIVE' | 'SUSPENDED'
  ) {
    if (actor.userId === targetUserId) {
      throw new AppError('Cannot modify your own account status', 400, 'CANNOT_SUSPEND_SELF');
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (target.role === 'ADMIN' && nextStatus === 'SUSPENDED') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', status: 'ACTIVE' },
      });
      if (adminCount <= 1) {
        throw new AppError('Cannot suspend the last remaining active administrator', 400, 'LAST_ADMIN_PROTECTION');
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { status: nextStatus },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await auditLogService.record({
      action: nextStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'USER',
      targetId: targetUserId,
      details: { previousStatus: target.status, newStatus: nextStatus, email: target.email },
    });

    return updated;
  }

  /**
   * Updates user role (USER vs ADMIN) with safety guards.
   */
  public async updateUserRole(
    actor: TokenPayload,
    targetUserId: string,
    nextRole: 'USER' | 'ADMIN'
  ) {
    if (actor.userId === targetUserId && nextRole !== 'ADMIN') {
      throw new AppError('Cannot demote your own administrator privileges', 400, 'CANNOT_DEMOTE_SELF');
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (target.role === 'ADMIN' && nextRole === 'USER') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', status: 'ACTIVE' },
      });
      if (adminCount <= 1) {
        throw new AppError('Cannot demote the last remaining administrator', 400, 'LAST_ADMIN_PROTECTION');
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: nextRole },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    await auditLogService.record({
      action: 'USER_ROLE_UPDATED',
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'USER',
      targetId: targetUserId,
      details: { previousRole: target.role, newRole: nextRole, email: target.email },
    });

    return updated;
  }

  /**
   * Lists coding rooms for admin inspection.
   */
  public async getRooms(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { owner: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    const [total, rooms] = await Promise.all([
      prisma.room.count({ where }),
      prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              chatMessages: true,
              aiMessages: true,
            },
          },
        },
      }),
    ]);

    return {
      rooms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Administratively terminates a coding room and notifies active sockets.
   */
  public async terminateRoom(actor: TokenPayload, roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { owner: true },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { status: 'CLOSED' },
    });

    // Notify connected socket clients
    const io = getIoInstance();
    if (io) {
      io.to(roomId).emit('room:terminated', {
        roomId,
        reason: 'Terminated by platform administrator',
      });
    }

    await auditLogService.record({
      action: 'ROOM_TERMINATED',
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'ROOM',
      targetId: roomId,
      details: { roomName: room.name, ownerEmail: room.owner.email },
    });

    return updated;
  }

  /**
   * Lists interviews platform-wide with filtering, search, and soft-delete toggle.
   */
  public async getInterviews(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    difficulty?: string;
    jobRole?: string;
    includeDeleted?: boolean;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (!params.includeDeleted) {
      where.isDeleted = false;
    }

    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { candidateName: { contains: q, mode: 'insensitive' } },
        { candidateEmail: { contains: q, mode: 'insensitive' } },
        { owner: { name: { contains: q, mode: 'insensitive' } } },
        { owner: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    if (params.jobRole && params.jobRole !== 'ALL') {
      where.jobRole = params.jobRole;
    }

    const [total, interviews] = await Promise.all([
      prisma.interview.count({ where }),
      prisma.interview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          candidate: {
            select: { id: true, name: true, email: true },
          },
          problem: {
            select: { id: true, title: true, difficulty: true },
          },
          report: true,
          _count: {
            select: {
              messages: true,
              events: true,
            },
          },
        },
      }),
    ]);

    return {
      interviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Safely deletes an interview (Exclusive to ADMIN).
   * Automatically terminates active sessions and preserves referential integrity.
   */
  public async deleteInterview(actor: TokenPayload, interviewId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { owner: true, room: true },
    });

    if (!interview) {
      throw new AppError('Interview not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    if (interview.isDeleted) {
      return interview; // Already deleted
    }

    // If active, safely terminate the live session first
    if (interview.status === 'IN_PROGRESS') {
      const io = getIoInstance();
      if (io) {
        io.to(interview.roomId).emit('interview:terminated', {
          interviewId,
          reason: 'Interview session terminated and deleted by platform administrator',
        });
      }
    }

    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: actor.userId,
        status: interview.status === 'IN_PROGRESS' ? 'CANCELLED' : interview.status,
      },
    });

    await auditLogService.record({
      action: 'INTERVIEW_DELETED',
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'INTERVIEW',
      targetId: interviewId,
      details: {
        title: interview.title,
        ownerEmail: interview.owner.email,
        candidateName: interview.candidateName,
        candidateEmail: interview.candidateEmail,
        previousStatus: interview.status,
      },
    });

    return updated;
  }

  /**
   * Recovers a soft-deleted interview (Exclusive to ADMIN).
   */
  public async recoverInterview(actor: TokenPayload, interviewId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { owner: true },
    });

    if (!interview) {
      throw new AppError('Interview not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
    });

    await auditLogService.record({
      action: 'INTERVIEW_RECOVERED',
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'INTERVIEW',
      targetId: interviewId,
      details: { title: interview.title, ownerEmail: interview.owner.email },
    });

    return updated;
  }

  /**
   * Cancels a scheduled interview.
   */
  public async cancelInterview(actor: TokenPayload, interviewId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { owner: true },
    });

    if (!interview) {
      throw new AppError('Interview not found', 404, 'INTERVIEW_NOT_FOUND');
    }

    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: { status: 'CANCELLED' },
    });

    await auditLogService.record({
      action: 'INTERVIEW_CANCELLED',
      actorId: actor.userId,
      actorEmail: actor.email,
      targetType: 'INTERVIEW',
      targetId: interviewId,
      details: { title: interview.title, ownerEmail: interview.owner.email },
    });

    return updated;
  }

  /**
   * System health check returning deep dependency and resource status.
   */
  public async getSystemHealth() {
    let dbStatus = 'ok';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'down';
    }

    const dockerAvailable = await dockerRunnerService.verifyDockerAvailable();

    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;

    return {
      status: dbStatus === 'ok' && dockerAvailable ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      docker: {
        status: dockerAvailable ? 'up' : 'unavailable',
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: Math.floor(os.uptime()),
        memory: {
          totalMb: Math.round(memTotal / (1024 * 1024)),
          usedMb: Math.round(memUsed / (1024 * 1024)),
          freeMb: Math.round(memFree / (1024 * 1024)),
          usagePercentage: Math.round((memUsed / memTotal) * 100),
        },
        cpus: os.cpus().length,
      },
    };
  }

  /**
   * AI Usage Monitoring statistics.
   */
  public async getAiUsageStats() {
    const [totalAiMessages, recentAiMessages, actionsCount] = await Promise.all([
      prisma.aiMessage.count(),
      prisma.aiMessage.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          room: { select: { id: true, name: true, language: true } },
        },
      }),
      prisma.aiMessage.groupBy({
        by: ['action'],
        _count: { action: true },
      }),
    ]);

    return {
      totalRequests: totalAiMessages,
      recentRequests: recentAiMessages,
      actionBreakdown: actionsCount.map((a) => ({ action: a.action, count: a._count.action })),
      geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      geminiStatus: Boolean(process.env.GEMINI_API_KEY) ? 'configured' : 'unconfigured',
      llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
    };
  }

  /**
   * Code Execution Monitoring statistics.
   */
  public async getExecutionStats() {
    const dockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    const supportedLanguages = [
      { language: 'c', image: 'gcc:alpine', timeoutMs: 10000, memoryLimit: '256m' },
      { language: 'cpp', image: 'gcc:alpine', timeoutMs: 10000, memoryLimit: '256m' },
      { language: 'java', image: 'openjdk:17-alpine', timeoutMs: 10000, memoryLimit: '512m' },
      { language: 'python', image: 'python:3.11-alpine', timeoutMs: 10000, memoryLimit: '256m' },
      { language: 'javascript', image: 'node:18-alpine', timeoutMs: 10000, memoryLimit: '256m' },
      { language: 'typescript', image: 'node:18-alpine', timeoutMs: 10000, memoryLimit: '256m' },
      { language: 'go', image: 'golang:1.21-alpine', timeoutMs: 10000, memoryLimit: '256m' },
      { language: 'rust', image: 'rust:alpine', timeoutMs: 15000, memoryLimit: '512m' },
      { language: 'csharp', image: 'mcr.microsoft.com/dotnet/sdk:8.0-alpine', timeoutMs: 15000, memoryLimit: '512m' },
    ];

    return {
      dockerStatus: dockerAvailable ? 'up' : 'unavailable',
      securityRestrictions: {
        networkDisabled: true,
        readOnlyRoot: true,
        memoryLimitEnforced: true,
        cpuLimitEnforced: true,
        pidsLimit: 64,
      },
      supportedLanguages,
    };
  }
}

export const adminService = new AdminService();
