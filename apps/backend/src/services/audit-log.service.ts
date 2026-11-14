import { prisma } from '@codesync/database';

export interface RecordAuditLogParams {
  action: string;
  actorId: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  details?: Record<string, any> | string;
}

export class AuditLogService {
  public async record(params: RecordAuditLogParams): Promise<void> {
    try {
      const detailsStr =
        typeof params.details === 'object'
          ? JSON.stringify(params.details)
          : params.details || null;

      await prisma.auditLog.create({
        data: {
          action: params.action,
          actorId: params.actorId,
          actorEmail: params.actorEmail,
          targetType: params.targetType,
          targetId: params.targetId,
          details: detailsStr,
        },
      });
    } catch (err) {
      console.error('Failed to record audit log:', err);
    }
  }

  public async getLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    targetType?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.action && params.action !== 'ALL') {
      where.action = params.action;
    }
    if (params.targetType && params.targetType !== 'ALL') {
      where.targetType = params.targetType;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditLogService = new AuditLogService();
