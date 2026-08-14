import { prisma } from '@codesync/database';
import { CreateRoomInput, RoomDto, RoomMemberDto, RoomRole } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';

export class RoomService {
  private formatRoomMember(member: any): RoomMemberDto {
    return {
      id: member.id,
      roomId: member.roomId,
      userId: member.userId,
      role: member.role as RoomRole,
      joinedAt: member.joinedAt.toISOString(),
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
      },
    };
  }

  private formatRoom(room: any, currentUserId?: string): RoomDto {
    const memberCount = room._count?.members ?? room.members?.length ?? 0;
    const currentUserMember = currentUserId
      ? room.members?.find((m: any) => m.userId === currentUserId)
      : undefined;

    return {
      id: room.id,
      name: room.name,
      ownerId: room.ownerId,
      language: room.language,
      status: room.status,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      role: currentUserMember ? (currentUserMember.role as RoomRole) : undefined,
      memberCount,
      members: room.members ? room.members.map((m: any) => this.formatRoomMember(m)) : undefined,
      owner: room.owner
        ? {
            id: room.owner.id,
            name: room.owner.name,
            email: room.owner.email,
            avatarUrl: room.owner.avatarUrl,
          }
        : undefined,
    };
  }

  public async createRoom(userId: string, input: CreateRoomInput): Promise<RoomDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const room = await prisma.room.create({
      data: {
        name: input.name,
        language: input.language,
        ownerId: userId,
        status: 'ACTIVE',
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return this.formatRoom(room, userId);
  }

  public async listUserRooms(
    userId: string,
    search?: string,
    language?: string,
    status?: string
  ): Promise<RoomDto[]> {
    const whereClause: any = {
      members: {
        some: {
          userId,
        },
      },
    };

    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (language) {
      whereClause.language = language;
    }

    if (status) {
      whereClause.status = status;
    }

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return rooms.map((r) => this.formatRoom(r, userId));
  }

  public async getRoomDetails(roomId: string, userId: string): Promise<RoomDto> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new AppError('You are not authorized to view this room', 403, 'FORBIDDEN');
    }

    return this.formatRoom(room, userId);
  }

  public async joinRoom(roomId: string, userId: string): Promise<RoomDto> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.status === 'CLOSED') {
      throw new AppError('Cannot join a closed room', 400, 'ROOM_CLOSED');
    }

    const existingMember = room.members.find((m) => m.userId === userId);

    if (!existingMember) {
      await prisma.roomMember.create({
        data: {
          roomId,
          userId,
          role: 'PARTICIPANT',
        },
      });
    }

    return this.getRoomDetails(roomId, userId);
  }

  public async leaveRoom(roomId: string, userId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError('You are not a member of this room', 403, 'FORBIDDEN');
    }

    if (member.role === 'OWNER' || room.ownerId === userId) {
      throw new AppError(
        'Room owner cannot leave the room. Delete the room or transfer ownership.',
        400,
        'OWNER_CANNOT_LEAVE'
      );
    }

    await prisma.roomMember.delete({
      where: {
        id: member.id,
      },
    });

    return { success: true };
  }

  public async deleteRoom(roomId: string, userId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.ownerId !== userId) {
      throw new AppError('Only the room owner can delete this room', 403, 'FORBIDDEN');
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    return { success: true };
  }

  public async getRoomMembers(roomId: string, userId: string): Promise<RoomMemberDto[]> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new AppError('You are not authorized to view members of this room', 403, 'FORBIDDEN');
    }

    return room.members.map((m) => this.formatRoomMember(m));
  }

  public async removeMember(roomId: string, ownerUserId: string, memberUserId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.ownerId !== ownerUserId) {
      throw new AppError('Only the room owner can remove members', 403, 'FORBIDDEN');
    }

    if (ownerUserId === memberUserId) {
      throw new AppError('Owner cannot remove themselves from the room', 400, 'CANNOT_REMOVE_SELF');
    }

    const targetMember = room.members.find((m) => m.userId === memberUserId);
    if (!targetMember) {
      throw new AppError('Target user is not a member of this room', 404, 'MEMBER_NOT_FOUND');
    }

    await prisma.roomMember.delete({
      where: { id: targetMember.id },
    });

    return { success: true };
  }

  public async updateMemberRole(
    roomId: string,
    ownerUserId: string,
    targetUserId: string,
    newRole: RoomRole
  ): Promise<RoomMemberDto> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.ownerId !== ownerUserId) {
      throw new AppError('Only the room owner can change member roles', 403, 'FORBIDDEN');
    }

    if (ownerUserId === targetUserId) {
      throw new AppError('Owner cannot change their own role', 400, 'CANNOT_CHANGE_OWN_ROLE');
    }

    if (newRole !== 'PARTICIPANT' && newRole !== 'VIEWER') {
      throw new AppError('Allowed roles are PARTICIPANT or VIEWER', 400, 'INVALID_ROLE');
    }

    const targetMember = room.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new AppError('Target user is not a member of this room', 404, 'MEMBER_NOT_FOUND');
    }

    const updatedMember = await prisma.roomMember.update({
      where: { id: targetMember.id },
      data: { role: newRole as any },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return this.formatRoomMember(updatedMember);
  }
}

export const roomService = new RoomService();

