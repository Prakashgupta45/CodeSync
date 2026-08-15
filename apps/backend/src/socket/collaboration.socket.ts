import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import cookie from 'cookie';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '@codesync/database';
import { collaborationService } from '../services/collaboration.service';
import { chatService } from '../services/chat.service';
import { presenceService } from '../services/presence.service';
import { callService } from '../services/call.service';
import { ACCESS_TOKEN_COOKIE } from '../utils/cookie';

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      userId: string;
      email: string;
      role: string;
      name?: string;
    };
    roomId?: string;
    role?: 'OWNER' | 'PARTICIPANT' | 'VIEWER';
  };
}

let ioInstance: Server | null = null;

export function getIoInstance(): Server | null {
  return ioInstance;
}

export function setupCollaborationSockets(io: Server) {
  ioInstance = io;
  // Socket Authentication Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      let token: string | undefined;

      // 1. Try extracting token from cookies
      const cookieHeader = socket.handshake.headers.cookie;
      if (cookieHeader) {
        const parsedCookies = cookie.parse(cookieHeader);
        token = parsedCookies[ACCESS_TOKEN_COOKIE];
      }

      // 2. Fallback to handshake auth or authorization header
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }

      if (!token && socket.handshake.headers.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const payload = verifyAccessToken(token);

      // Fetch user details for name
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, role: true, name: true },
      });

      if (!user) {
        return next(new Error('Authenticated user not found'));
      }

      socket.data.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };

      next();
    } catch (err) {
      return next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // 1. Join Coding Room & Initialize Presence / Chat Session
    socket.on('collaboration:join', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload || {};
        if (!roomId || typeof roomId !== 'string') {
          socket.emit('collaboration:error', { message: 'Invalid room ID provided' });
          return;
        }

        const roomMember = await prisma.roomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: user.userId,
            },
          },
          include: {
            room: true,
          },
        });

        if (!roomMember) {
          socket.emit('collaboration:error', { message: 'You are not a member of this room' });
          return;
        }

        if (roomMember.room.status === 'CLOSED') {
          socket.emit('collaboration:error', { message: 'Cannot join a closed room' });
          return;
        }

        socket.data.roomId = roomId;
        socket.data.role = roomMember.role;

        socket.join(roomId);

        const presenceResult = presenceService.userConnected(
          roomId,
          user.userId,
          user.name || 'User',
          roomMember.role
        );

        io.to(roomId).emit('presence:update', {
          roomId,
          users: presenceResult.users,
        });

        socket.to(roomId).emit('presence:join', {
          userId: user.userId,
          name: user.name,
          role: roomMember.role,
        });

        const doc = await collaborationService.getOrCreateDoc(roomId, roomMember.room.language);
        const state = Y.encodeStateAsUpdate(doc);

        socket.emit('collaboration:sync', {
          roomId,
          role: roomMember.role,
          language: roomMember.room.language,
          state: Array.from(state),
        });
      } catch (err: any) {
        socket.emit('collaboration:error', { message: err.message || 'Failed to join collaboration session' });
      }
    });

    // 2. Yjs Document Updates (Viewer Read-Only Restriction Enforced)
    socket.on('collaboration:update', async (payload: { roomId: string; update: number[] }) => {
      try {
        const { roomId, update } = payload || {};
        if (!roomId || !update || socket.data.roomId !== roomId) {
          return;
        }

        if (socket.data.role === 'VIEWER') {
          socket.emit('collaboration:error', { message: 'Viewers have read-only access and cannot edit' });
          return;
        }

        const doc = collaborationService.getDoc(roomId) || (await collaborationService.getOrCreateDoc(roomId, 'javascript'));
        Y.applyUpdate(doc, new Uint8Array(update));

        socket.to(roomId).emit('collaboration:update', {
          roomId,
          update,
        });
      } catch (err: any) {
        socket.emit('collaboration:error', { message: 'Failed to process document update' });
      }
    });

    // 3. Remote Cursor & Selection Awareness
    socket.on('collaboration:awareness', (payload: { roomId: string; cursor: any }) => {
      const { roomId, cursor } = payload || {};
      if (roomId && socket.data.roomId === roomId) {
        socket.to(roomId).emit('collaboration:awareness', {
          userId: user.userId,
          name: user.name,
          cursor,
        });
      }
    });

    // 4. Real-Time Chat: Send Message
    socket.on('chat:send', async (payload: { roomId: string; content: string }) => {
      try {
        const { roomId, content } = payload || {};
        if (!roomId || typeof roomId !== 'string') {
          socket.emit('chat:error', { message: 'Invalid room ID' });
          return;
        }

        const messageDto = await chatService.createMessage(roomId, user.userId, content);
        io.to(roomId).emit('chat:message', messageDto);
      } catch (err: any) {
        socket.emit('chat:error', { message: err.message || 'Failed to send chat message' });
      }
    });

    // 5. Real-Time Chat: History Fetch
    socket.on('chat:history', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload || {};
        if (!roomId || typeof roomId !== 'string') {
          socket.emit('chat:error', { message: 'Invalid room ID' });
          return;
        }

        const messages = await chatService.getRoomHistory(roomId, user.userId);
        socket.emit('chat:history', { roomId, messages });
      } catch (err: any) {
        socket.emit('chat:error', { message: err.message || 'Failed to load chat history' });
      }
    });

    // 6. Real-Time Chat: Typing Indicators
    socket.on('chat:typing', (payload: { roomId: string }) => {
      const { roomId } = payload || {};
      if (roomId) {
        socket.to(roomId).emit('chat:user-typing', {
          userId: user.userId,
          name: user.name,
        });
      }
    });

    socket.on('chat:stop-typing', (payload: { roomId: string }) => {
      const { roomId } = payload || {};
      if (roomId) {
        socket.to(roomId).emit('chat:user-stop-typing', {
          userId: user.userId,
          name: user.name,
        });
      }
    });

    // 7. Phase 7: WebRTC Real-Time Video & Audio Signaling Handlers
    socket.on('call:join', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload || {};
        if (!roomId || typeof roomId !== 'string') {
          socket.emit('call:error', { message: 'Invalid room ID provided' });
          return;
        }

        const { participant, existingParticipants } = await callService.joinCall(roomId, user.userId);
        socket.data.roomId = roomId;
        socket.join(roomId);
        socket.join(`call:${roomId}`);

        socket.emit('call:sync', { roomId, participants: existingParticipants });

        socket.to(roomId).emit('call:peer-joined', {
          roomId,
          participant,
        });
      } catch (err: any) {
        socket.emit('call:error', { message: err.message || 'Failed to join video call' });
      }
    });

    socket.on('call:leave', (payload: { roomId: string }) => {
      const { roomId } = payload || {};
      if (roomId) {
        const leftParticipant = callService.leaveCall(roomId, user.userId);
        if (leftParticipant) {
          socket.leave(`call:${roomId}`);
          io.to(roomId).emit('call:peer-left', {
            roomId,
            userId: user.userId,
          });
        }
      }
    });

    socket.on('call:offer', (payload: { roomId: string; targetUserId: string; offer: any }) => {
      const { roomId, targetUserId, offer } = payload || {};
      if (roomId && targetUserId && offer) {
        socket.to(roomId).emit('call:offer', {
          roomId,
          senderUserId: user.userId,
          targetUserId,
          offer,
        });
      }
    });

    socket.on('call:answer', (payload: { roomId: string; targetUserId: string; answer: any }) => {
      const { roomId, targetUserId, answer } = payload || {};
      if (roomId && targetUserId && answer) {
        socket.to(roomId).emit('call:answer', {
          roomId,
          senderUserId: user.userId,
          targetUserId,
          answer,
        });
      }
    });

    socket.on('call:ice-candidate', (payload: { roomId: string; targetUserId: string; candidate: any }) => {
      const { roomId, targetUserId, candidate } = payload || {};
      if (roomId && targetUserId && candidate) {
        socket.to(roomId).emit('call:ice-candidate', {
          roomId,
          senderUserId: user.userId,
          targetUserId,
          candidate,
        });
      }
    });

    socket.on('call:media-state', async (payload: { roomId: string; cameraEnabled: boolean; microphoneEnabled: boolean }) => {
      try {
        const { roomId, cameraEnabled, microphoneEnabled } = payload || {};
        if (roomId) {
          const updated = await callService.updateMediaState(roomId, user.userId, cameraEnabled, microphoneEnabled);
          io.to(roomId).emit('call:media-state', {
            roomId,
            userId: user.userId,
            cameraEnabled: updated.cameraEnabled,
            microphoneEnabled: updated.microphoneEnabled,
          });
        }
      } catch (err: any) {
        socket.emit('call:error', { message: err.message || 'Failed to update media state' });
      }
    });

    // 8. Handle Disconnect
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        collaborationService.decrementClientCount(roomId);

        // Leave active WebRTC call if connected
        const leftCallParticipant = callService.leaveCall(roomId, user.userId);
        if (leftCallParticipant) {
          socket.to(roomId).emit('call:peer-left', {
            roomId,
            userId: user.userId,
          });
        }

        // Multi-tab socket reference counting update for presence
        const presenceResult = presenceService.userDisconnected(roomId, user.userId);

        if (presenceResult.userFullyDisconnected) {
          socket.to(roomId).emit('presence:leave', {
            userId: user.userId,
            name: user.name,
          });
        }

        io.to(roomId).emit('presence:update', {
          roomId,
          users: presenceResult.users,
        });
      }
    });
  });
}
