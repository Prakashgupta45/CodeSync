import { prisma } from '@codesync/database';
import { RoomExecutionResultDto, executeCodeSchema } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';
import { dockerRunnerService } from './docker-runner.service';
import { getIoInstance } from '../socket/collaboration.socket';
import { randomUUID } from 'crypto';

export class ExecutionService {
  public async runRoomCode(
    roomId: string,
    userId: string,
    inputLanguage?: string,
    inputCode?: string
  ): Promise<RoomExecutionResultDto> {
    // 1. Verify Room and Database Membership with User details
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        document: {
          select: { content: true },
        },
      },
    });

    if (!room) {
      throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this room and cannot execute code', 403, 'FORBIDDEN');
    }

    // Security Authorization Guard: VIEWER role cannot execute code
    if (member.role === 'VIEWER') {
      throw new AppError('Viewers have read-only access and cannot execute code', 403, 'FORBIDDEN');
    }

    const language = inputLanguage || room.language;
    // Fall back to room document content if inputCode is undefined, null, or empty string
    const code =
      inputCode !== undefined && inputCode !== null && inputCode.trim().length > 0
        ? inputCode
        : room.document?.content || '';

    // 2. Validate input schema with Zod
    const validationResult = executeCodeSchema.safeParse({
      roomId,
      language,
      code,
    });

    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      throw new AppError(issue.message, 400, 'INVALID_EXECUTION_PAYLOAD');
    }

    // 3. Delegate execution to DockerRunnerService
    const executionResult = await dockerRunnerService.executeCode(
      validationResult.data.language,
      validationResult.data.code || ''
    );

    // 4. Construct Room-Scoped Execution Result Payload with Executor Identity
    const fullResultPayload: RoomExecutionResultDto = {
      ...executionResult,
      roomId,
      executionId: randomUUID(),
      executedBy: {
        userId: member.user.id,
        name: member.user.name,
        role: member.role,
      },
      language: validationResult.data.language,
      timestamp: new Date().toISOString(),
    };

    // 5. Broadcast execution result in real time to connected room members via Socket.IO
    const io = getIoInstance();
    if (io) {
      io.to(roomId).emit('execution:result', fullResultPayload);
    }

    return fullResultPayload;
  }
}

export const executionService = new ExecutionService();
