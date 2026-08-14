import { prisma } from '@codesync/database';
import { ChatMessageDto, sendChatMessageSchema } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';

// Per-socket/user chat rate limiter (Max 5 messages in a 3-second window)
class ChatRateLimiter {
  private userMessageTimestamps = new Map<string, number[]>();

  public isRateLimited(userId: string): boolean {
    const now = Date.now();
    const windowMs = 3000; // 3 seconds
    const maxMessages = 5;

    const timestamps = this.userMessageTimestamps.get(userId) || [];
    const validTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= maxMessages) {
      return true;
    }

    validTimestamps.push(now);
    this.userMessageTimestamps.set(userId, validTimestamps);
    return false;
  }

  public clearUser(userId: string) {
    this.userMessageTimestamps.delete(userId);
  }
}

export class ChatService {
  private rateLimiter = new ChatRateLimiter();

  public async createMessage(
    roomId: string,
    senderId: string,
    content: string
  ): Promise<ChatMessageDto> {
    // 1. Zod Validation
    const validationResult = sendChatMessageSchema.safeParse({ roomId, content });
    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      throw new AppError(issue.message, 400, 'INVALID_CHAT_PAYLOAD');
    }

    // 2. Rate Limiting Check
    if (this.rateLimiter.isRateLimited(senderId)) {
      throw new AppError('Rate limit exceeded. Please wait a moment before sending more messages.', 429, 'RATE_LIMIT_EXCEEDED');
    }

    // 3. Verify Room and User Membership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const isMember = room.members.some((m) => m.userId === senderId);
    if (!isMember) {
      throw new AppError('You are not authorized to send messages in this room', 403, 'FORBIDDEN');
    }

    // 4. Save Chat Message to PostgreSQL
    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        content: validationResult.data.content,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.sender.name,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  public async getRoomHistory(roomId: string, userId: string, limit = 50): Promise<ChatMessageDto[]> {
    // Verify room and user membership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404, 'ROOM_NOT_FOUND');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new AppError('You are not authorized to access chat history for this room', 403, 'FORBIDDEN');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    return messages.map((msg) => ({
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      senderName: msg.sender.name,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    }));
  }
}

export const chatService = new ChatService();
