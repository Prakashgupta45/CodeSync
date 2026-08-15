import request from 'supertest';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import { prisma } from '@codesync/database';
import { setupCollaborationSockets } from '../socket/collaboration.socket';
import { callService } from '../services/call.service';

describe('Phase 7 — WebRTC Real-Time Video & Audio Calling Security Suite', () => {
  const userOwner = {
    email: 'webrtc_owner@example.com',
    password: 'Password123!',
    name: 'WebRTC Owner',
  };

  const userParticipant = {
    email: 'webrtc_part@example.com',
    password: 'Password123!',
    name: 'WebRTC Participant',
  };

  const userViewer = {
    email: 'webrtc_viewer@example.com',
    password: 'Password123!',
    name: 'WebRTC Viewer',
  };

  const userNonMember = {
    email: 'webrtc_nonmember@example.com',
    password: 'Password123!',
    name: 'WebRTC NonMember',
  };

  let ownerCookie: string[];
  let ownerUserId: string;

  let participantCookie: string[];
  let participantUserId: string;

  let viewerCookie: string[];
  let viewerUserId: string;

  let nonMemberCookie: string[];

  let testRoomId: string;
  let isolatedRoomId: string;

  let httpServer: http.Server;
  let ioServer: Server;
  let port: number;

  const extractCookies = (res: any): string[] => {
    const raw = res.headers['set-cookie'];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((c: string) => c.split(';')[0]);
  };

  const createSocketClient = (cookieHeaders?: string[]): ClientSocket => {
    const cookieHeaderStr = cookieHeaders ? cookieHeaders.join('; ') : '';
    return Client(`http://localhost:${port}`, {
      extraHeaders: cookieHeaderStr ? { cookie: cookieHeaderStr } : {},
      transports: ['websocket'],
      reconnection: false,
    });
  };

  beforeEach(async () => {
    callService.clearAll();
    await prisma.aiMessage.deleteMany({});
    await prisma.chatMessage.deleteMany({});
    await prisma.roomDocument.deleteMany({});
    await prisma.roomMember.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [userOwner.email, userParticipant.email, userViewer.email, userNonMember.email],
        },
      },
    });

    // Setup HTTP + Socket.IO server
    httpServer = http.createServer(app);
    ioServer = new Server(httpServer, {
      cors: { origin: '*', credentials: true },
    });
    setupCollaborationSockets(ioServer);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as any;
    port = address.port;

    // 1. Register Users
    const regOwner = await request(app).post('/api/v1/auth/register').send(userOwner);
    ownerCookie = extractCookies(regOwner);
    ownerUserId = regOwner.body.data.user.id;

    const regPart = await request(app).post('/api/v1/auth/register').send(userParticipant);
    participantCookie = extractCookies(regPart);
    participantUserId = regPart.body.data.user.id;

    const regView = await request(app).post('/api/v1/auth/register').send(userViewer);
    viewerCookie = extractCookies(regView);
    viewerUserId = regView.body.data.user.id;

    const regNon = await request(app).post('/api/v1/auth/register').send(userNonMember);
    nonMemberCookie = extractCookies(regNon);

    // 2. Create Rooms
    const createRoomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'WebRTC Suite Room', language: 'python' });
    testRoomId = createRoomRes.body.data.id;

    const createIsolatedRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'WebRTC Isolated Room', language: 'javascript' });
    isolatedRoomId = createIsolatedRes.body.data.id;

    // 3. Join Members to testRoomId
    await request(app).post(`/api/v1/rooms/${testRoomId}/join`).set('Cookie', participantCookie);
    await prisma.roomMember.create({
      data: { roomId: testRoomId, userId: viewerUserId, role: 'VIEWER' },
    });
  });

  afterEach(async () => {
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  it('1. Authenticated room OWNER can join WebRTC call and receives sync payload', (done) => {
    const socket = createSocketClient(ownerCookie);

    socket.on('connect', () => {
      socket.emit('collaboration:join', { roomId: testRoomId });
    });

    socket.on('collaboration:sync', () => {
      socket.emit('call:join', { roomId: testRoomId });
    });

    socket.on('call:sync', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(Array.isArray(data.participants)).toBe(true);
      socket.disconnect();
      done();
    });
  });

  it('2. Authenticated PARTICIPANT receives call:peer-joined when OWNER joins', (done) => {
    const socketOwner = createSocketClient(ownerCookie);
    const socketPart = createSocketClient(participantCookie);

    socketPart.on('connect', () => {
      socketPart.emit('collaboration:join', { roomId: testRoomId });
    });

    socketPart.on('collaboration:sync', () => {
      socketPart.emit('call:join', { roomId: testRoomId });
    });

    socketPart.on('call:sync', () => {
      socketOwner.emit('collaboration:join', { roomId: testRoomId });
    });

    socketOwner.on('collaboration:sync', () => {
      socketOwner.emit('call:join', { roomId: testRoomId });
    });

    socketPart.on('call:peer-joined', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(data.participant.userId).toBe(ownerUserId);
      expect(data.participant.role).toBe('OWNER');
      socketOwner.disconnect();
      socketPart.disconnect();
      done();
    });
  });

  it('3. VIEWER can join call in subscriber mode (media publishing disabled)', (done) => {
    const socketViewer = createSocketClient(viewerCookie);

    socketViewer.on('connect', () => {
      socketViewer.emit('collaboration:join', { roomId: testRoomId });
    });

    socketViewer.on('collaboration:sync', () => {
      socketViewer.emit('call:join', { roomId: testRoomId });
    });

    socketViewer.on('call:sync', () => {
      const participants = callService.getParticipants(testRoomId);
      const viewerPart = participants.find((p) => p.userId === viewerUserId);

      expect(viewerPart).toBeTruthy();
      expect(viewerPart?.role).toBe('VIEWER');
      expect(viewerPart?.cameraEnabled).toBe(false);
      expect(viewerPart?.microphoneEnabled).toBe(false);

      socketViewer.disconnect();
      done();
    });
  });

  it('4. VIEWER cannot enable camera or microphone (call:error)', (done) => {
    const socketViewer = createSocketClient(viewerCookie);

    socketViewer.on('connect', () => {
      socketViewer.emit('collaboration:join', { roomId: testRoomId });
    });

    socketViewer.on('collaboration:sync', () => {
      socketViewer.emit('call:join', { roomId: testRoomId });
    });

    socketViewer.on('call:sync', () => {
      socketViewer.emit('call:media-state', {
        roomId: testRoomId,
        cameraEnabled: true,
        microphoneEnabled: true,
      });
    });

    socketViewer.on('call:error', (err) => {
      expect(err.message).toContain('Viewers are watch-only');
      socketViewer.disconnect();
      done();
    });
  });

  it('5. Non-member cannot join call in another room', (done) => {
    const socketNonMember = createSocketClient(nonMemberCookie);

    socketNonMember.on('connect', () => {
      socketNonMember.emit('call:join', { roomId: testRoomId });
    });

    socketNonMember.on('call:error', (err) => {
      expect(err.message).toContain('You are not a member of this room');
      socketNonMember.disconnect();
      done();
    });
  });

  it('6. WebRTC SDP offer is delivered to target user in the same room', (done) => {
    const socketOwner = createSocketClient(ownerCookie);
    const socketPart = createSocketClient(participantCookie);

    socketPart.on('call:offer', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(data.senderUserId).toBe(ownerUserId);
      expect(data.offer.sdp).toBe('dummy-sdp-offer');
      socketOwner.disconnect();
      socketPart.disconnect();
      done();
    });

    socketPart.on('connect', () => {
      socketPart.emit('collaboration:join', { roomId: testRoomId });
    });

    socketPart.on('collaboration:sync', () => {
      socketPart.emit('call:join', { roomId: testRoomId });
    });

    socketPart.on('call:sync', () => {
      socketOwner.emit('collaboration:join', { roomId: testRoomId });
    });

    socketOwner.on('collaboration:sync', () => {
      socketOwner.emit('call:join', { roomId: testRoomId });
    });

    socketOwner.on('call:sync', () => {
      socketOwner.emit('call:offer', {
        roomId: testRoomId,
        targetUserId: participantUserId,
        offer: { type: 'offer', sdp: 'dummy-sdp-offer' },
      });
    });
  });

  it('7. WebRTC ICE candidate is delivered to target user in the same room', (done) => {
    const socketOwner = createSocketClient(ownerCookie);
    const socketPart = createSocketClient(participantCookie);

    socketPart.on('call:ice-candidate', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(data.senderUserId).toBe(ownerUserId);
      expect(data.candidate.candidate).toBe('dummy-ice-candidate');
      socketOwner.disconnect();
      socketPart.disconnect();
      done();
    });

    socketPart.on('connect', () => {
      socketPart.emit('collaboration:join', { roomId: testRoomId });
    });

    socketPart.on('collaboration:sync', () => {
      socketPart.emit('call:join', { roomId: testRoomId });
    });

    socketPart.on('call:sync', () => {
      socketOwner.emit('collaboration:join', { roomId: testRoomId });
    });

    socketOwner.on('collaboration:sync', () => {
      socketOwner.emit('call:join', { roomId: testRoomId });
    });

    socketOwner.on('call:sync', () => {
      socketOwner.emit('call:ice-candidate', {
        roomId: testRoomId,
        targetUserId: participantUserId,
        candidate: { candidate: 'dummy-ice-candidate' },
      });
    });
  });

  it('8. call:leave broadcasts call:peer-left to room members', (done) => {
    const socketOwner = createSocketClient(ownerCookie);
    const socketPart = createSocketClient(participantCookie);

    socketPart.on('call:peer-left', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(data.userId).toBe(ownerUserId);
      socketOwner.disconnect();
      socketPart.disconnect();
      done();
    });

    socketPart.on('connect', () => {
      socketPart.emit('collaboration:join', { roomId: testRoomId });
    });

    socketPart.on('collaboration:sync', () => {
      socketPart.emit('call:join', { roomId: testRoomId });
    });

    socketPart.on('call:sync', () => {
      socketOwner.emit('collaboration:join', { roomId: testRoomId });
    });

    socketOwner.on('collaboration:sync', () => {
      socketOwner.emit('call:join', { roomId: testRoomId });
    });

    socketOwner.on('call:sync', () => {
      socketOwner.emit('call:leave', { roomId: testRoomId });
    });
  });

  it('9. Cross-room isolation: WebRTC offer in Room A does NOT reach sockets in Room B', (done) => {
    const socketNonMember = createSocketClient(nonMemberCookie);
    let receivedUnintendedOffer = false;

    socketNonMember.on('connect', () => {
      socketNonMember.on('call:offer', () => {
        receivedUnintendedOffer = true;
      });

      const socketOwner = createSocketClient(ownerCookie);
      socketOwner.on('connect', () => {
        socketOwner.emit('collaboration:join', { roomId: testRoomId });
      });

      socketOwner.on('collaboration:sync', () => {
        socketOwner.emit('call:join', { roomId: testRoomId });
      });

      socketOwner.on('call:sync', () => {
        socketOwner.emit('call:offer', {
          roomId: testRoomId,
          targetUserId: participantUserId,
          offer: { type: 'offer', sdp: 'secret-sdp' },
        });

        setTimeout(() => {
          expect(receivedUnintendedOffer).toBe(false);
          socketOwner.disconnect();
          socketNonMember.disconnect();
          done();
        }, 500);
      });
    });
  });

  it('10. Camera state toggle ON -> OFF -> ON broadcasts updated call:media-state to room members', (done) => {
    const socketOwner = createSocketClient(ownerCookie);
    const socketPart = createSocketClient(participantCookie);

    const receivedStates: boolean[] = [];

    socketPart.on('call:media-state', (data) => {
      if (data.userId === ownerUserId) {
        receivedStates.push(data.cameraEnabled);

        if (receivedStates.length === 1) {
          // Camera turned OFF -> Turn back ON
          socketOwner.emit('call:media-state', {
            roomId: testRoomId,
            cameraEnabled: true,
            microphoneEnabled: true,
          });
        } else if (receivedStates.length === 2) {
          // Received OFF and ON state broadcasts
          expect(receivedStates).toEqual([false, true]);
          socketOwner.disconnect();
          socketPart.disconnect();
          done();
        }
      }
    });

    socketPart.on('connect', () => {
      socketPart.emit('collaboration:join', { roomId: testRoomId });
    });

    socketPart.on('collaboration:sync', () => {
      socketPart.emit('call:join', { roomId: testRoomId });
    });

    socketPart.on('call:sync', () => {
      socketOwner.emit('collaboration:join', { roomId: testRoomId });
    });

    socketOwner.on('collaboration:sync', () => {
      socketOwner.emit('call:join', { roomId: testRoomId });
    });

    socketOwner.on('call:sync', () => {
      // Step 1: Turn Camera OFF
      socketOwner.emit('call:media-state', {
        roomId: testRoomId,
        cameraEnabled: false,
        microphoneEnabled: true,
      });
    });
  });
});
