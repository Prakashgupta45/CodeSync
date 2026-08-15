import { prisma } from '@codesync/database';
import { CallParticipantDto, RoomRole } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';

interface InCallUser {
  userId: string;
  name: string;
  role: RoomRole;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  joinedAt: number;
}

class CallService {
  // Ephemeral in-memory call participant map: roomId -> Map<userId, InCallUser>
  private roomCalls = new Map<string, Map<string, InCallUser>>();

  public async joinCall(
    roomId: string,
    userId: string
  ): Promise<{ participant: CallParticipantDto; existingParticipants: CallParticipantDto[] }> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this room and cannot join the call', 403, 'FORBIDDEN');
    }

    let participantsMap = this.roomCalls.get(roomId);
    if (!participantsMap) {
      participantsMap = new Map<string, InCallUser>();
      this.roomCalls.set(roomId, participantsMap);
    }

    const existingParticipants: CallParticipantDto[] = Array.from(participantsMap.values()).map((p) => ({
      userId: p.userId,
      name: p.name,
      role: p.role,
      cameraEnabled: p.cameraEnabled,
      microphoneEnabled: p.microphoneEnabled,
    }));

    // Viewer role defaults: Cannot publish camera/mic (watch-only)
    const isViewer = member.role === 'VIEWER';
    const newParticipant: InCallUser = {
      userId: member.user.id,
      name: member.user.name,
      role: member.role,
      cameraEnabled: !isViewer,
      microphoneEnabled: !isViewer,
      joinedAt: Date.now(),
    };

    participantsMap.set(userId, newParticipant);

    return {
      participant: {
        userId: newParticipant.userId,
        name: newParticipant.name,
        role: newParticipant.role,
        cameraEnabled: newParticipant.cameraEnabled,
        microphoneEnabled: newParticipant.microphoneEnabled,
      },
      existingParticipants,
    };
  }

  public leaveCall(roomId: string, userId: string): CallParticipantDto | null {
    const participantsMap = this.roomCalls.get(roomId);
    if (!participantsMap) return null;

    const existing = participantsMap.get(userId);
    if (!existing) return null;

    participantsMap.delete(userId);
    if (participantsMap.size === 0) {
      this.roomCalls.delete(roomId);
    }

    return {
      userId: existing.userId,
      name: existing.name,
      role: existing.role,
      cameraEnabled: existing.cameraEnabled,
      microphoneEnabled: existing.microphoneEnabled,
    };
  }

  public async updateMediaState(
    roomId: string,
    userId: string,
    cameraEnabled: boolean,
    microphoneEnabled: boolean
  ): Promise<CallParticipantDto> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { members: { select: { userId: true, role: true } } },
    });

    if (!room) {
      throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this room', 403, 'FORBIDDEN');
    }

    // Role Enforcement: Viewer cannot publish audio/video tracks
    if (member.role === 'VIEWER' && (cameraEnabled || microphoneEnabled)) {
      throw new AppError('Viewers are watch-only and cannot publish audio or video', 403, 'FORBIDDEN');
    }

    const participantsMap = this.roomCalls.get(roomId);
    if (!participantsMap || !participantsMap.has(userId)) {
      throw new AppError('You have not joined the video call in this room', 400, 'NOT_IN_CALL');
    }

    const current = participantsMap.get(userId)!;
    current.cameraEnabled = member.role === 'VIEWER' ? false : cameraEnabled;
    current.microphoneEnabled = member.role === 'VIEWER' ? false : microphoneEnabled;
    participantsMap.set(userId, current);

    return {
      userId: current.userId,
      name: current.name,
      role: current.role,
      cameraEnabled: current.cameraEnabled,
      microphoneEnabled: current.microphoneEnabled,
    };
  }

  public getParticipants(roomId: string): CallParticipantDto[] {
    const participantsMap = this.roomCalls.get(roomId);
    if (!participantsMap) return [];
    return Array.from(participantsMap.values()).map((p) => ({
      userId: p.userId,
      name: p.name,
      role: p.role,
      cameraEnabled: p.cameraEnabled,
      microphoneEnabled: p.microphoneEnabled,
    }));
  }

  public clearAll() {
    this.roomCalls.clear();
  }
}

export const callService = new CallService();
