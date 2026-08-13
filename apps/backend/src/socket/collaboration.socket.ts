import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import cookie from 'cookie';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '@codesync/database';
import { collaborationService } from '../services/collaboration.service';
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

export function setupCollaborationSockets(io: Server) {
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

    // 1. Join Coding Room
    socket.on('collaboration:join', async (payload: { roomId: string }) => {
      try {
        const { roomId } = payload || {};
        if (!roomId || typeof roomId !== 'string') {
          socket.emit('collaboration:error', { message: 'Invalid room ID provided' });
          return;
        }

        // Verify room and user membership
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          include: {
            members: true,
          },
        });

        if (!room) {
          socket.emit('collaboration:error', { message: 'Coding room not found' });
          return;
        }

        if (room.status === 'CLOSED') {
          socket.emit('collaboration:error', { message: 'Cannot join a closed room' });
          return;
        }

        const member = room.members.find((m) => m.userId === user.userId);
        if (!member) {
          socket.emit('collaboration:error', { message: 'You are not a member of this room' });
          return;
        }

        // Store active session metadata on socket
        socket.data.roomId = roomId;
        socket.data.role = member.role as 'OWNER' | 'PARTICIPANT' | 'VIEWER';

        socket.join(roomId);

        // Fetch or create room Yjs document
        const doc = await collaborationService.getOrCreateDoc(roomId, room.language);
        const stateVector = Y.encodeStateAsUpdate(doc);

        // Emit initial sync payload to joining socket
        socket.emit('collaboration:sync', {
          roomId,
          language: room.language,
          role: member.role,
          state: Array.from(stateVector),
          content: doc.getText('codemirror').toString(),
        });

        // Notify room of user presence
        socket.to(roomId).emit('collaboration:user-joined', {
          userId: user.userId,
          name: user.name,
          role: member.role,
        });
      } catch (err: any) {
        socket.emit('collaboration:error', { message: err.message || 'Failed to join collaboration session' });
      }
    });

    // 2. Real-Time CRDT Update
    socket.on('collaboration:update', (payload: { roomId: string; update: number[] }) => {
      try {
        const { roomId, update } = payload || {};
        if (!roomId || !update || !Array.isArray(update)) return;

        // Security Authorization Guard: Must be joined to target room
        if (socket.data.roomId !== roomId) {
          socket.emit('collaboration:error', { message: 'Unauthorized room update attempt' });
          return;
        }

        // Security Authorization Guard: Viewer cannot edit
        if (socket.data.role === 'VIEWER') {
          socket.emit('collaboration:error', { message: 'Viewers have read-only access and cannot edit' });
          return;
        }

        const uint8Update = new Uint8Array(update);
        collaborationService.applyUpdate(roomId, uint8Update);

        // Broadcast update to all other connected room members
        socket.to(roomId).emit('collaboration:update', {
          roomId,
          userId: user.userId,
          update: Array.from(uint8Update),
        });
      } catch (err: any) {
        socket.emit('collaboration:error', { message: err.message || 'Failed to process collaboration update' });
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

    // 4. Handle Disconnect
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        collaborationService.decrementClientCount(roomId);
        socket.to(roomId).emit('collaboration:user-left', {
          userId: user.userId,
          name: user.name,
        });
      }
    });
  });
}
