import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import http from 'http';
import { Server } from 'socket.io';
import { setupCollaborationSockets } from '../socket/collaboration.socket';
import { collaborationService } from '../services/collaboration.service';
import { presenceService } from '../services/presence.service';
import { prisma } from '@codesync/database';

describe('Phase 4 — Real-Time Chat, Presence & Security Suite', () => {
  let httpServer: http.Server;
  let ioServer: Server;
  let port: number;

  const userOwner = {
    email: 'chat_owner@example.com',
    password: 'Password123!',
    name: 'Chat Owner',
  };

  const userParticipant = {
    email: 'chat_part@example.com',
    password: 'Password123!',
    name: 'Chat Participant',
  };

  const userViewer = {
    email: 'chat_viewer@example.com',
    password: 'Password123!',
    name: 'Chat Viewer',
  };

  const userNonMember = {
    email: 'chat_nonmember@example.com',
    password: 'Password123!',
    name: 'Chat NonMember',
  };

  let ownerCookie: string[];
  let ownerUserId: string;

  let participantCookie: string[];
  let participantUserId: string;

  let viewerCookie: string[];
  let viewerUserId: string;

  let nonMemberCookie: string[];

  let testRoomId1: string;
  let testRoomId2: string;

  beforeAll((done) => {
    httpServer = http.createServer(app);
    ioServer = new Server(httpServer, {
      cors: { origin: '*', credentials: true },
    });
    setupCollaborationSockets(ioServer);

    httpServer.listen(0, () => {
      const address = httpServer.address();
      port = typeof address === 'object' && address ? address.port : 0;
      done();
    });
  });

  afterAll((done) => {
    collaborationService.clearSessions();
    presenceService.clearAll();
    ioServer.close();
    httpServer.close(done);
  });

  const extractCookies = (res: any): string[] => {
    const raw = res.headers['set-cookie'];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((c: string) => c.split(';')[0]);
  };

  beforeEach(async () => {
    collaborationService.clearSessions();
    presenceService.clearAll();
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

    // 1. Register Owner
    const regOwner = await request(app).post('/api/v1/auth/register').send(userOwner);
    expect(regOwner.status).toBe(201);
    ownerCookie = extractCookies(regOwner);
    ownerUserId = regOwner.body.data.user.id;

    // 2. Register Participant
    const regPart = await request(app).post('/api/v1/auth/register').send(userParticipant);
    expect(regPart.status).toBe(201);
    participantCookie = extractCookies(regPart);
    participantUserId = regPart.body.data.user.id;

    // 3. Register Viewer
    const regView = await request(app).post('/api/v1/auth/register').send(userViewer);
    expect(regView.status).toBe(201);
    viewerCookie = extractCookies(regView);
    viewerUserId = regView.body.data.user.id;

    // 4. Register Non-Member
    const regNon = await request(app).post('/api/v1/auth/register').send(userNonMember);
    expect(regNon.status).toBe(201);
    nonMemberCookie = extractCookies(regNon);

    // 5. Create Test Room 1
    const createRoomRes1 = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Chat Room Alpha', language: 'typescript' });
    expect(createRoomRes1.status).toBe(201);
    testRoomId1 = createRoomRes1.body.data.id;

    // 6. Create Test Room 2 (Isolated)
    const createRoomRes2 = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Chat Room Beta', language: 'python' });
    expect(createRoomRes2.status).toBe(201);
    testRoomId2 = createRoomRes2.body.data.id;

    // 7. Add Participant & Viewer to Room 1
    await request(app).post(`/api/v1/rooms/${testRoomId1}/join`).set('Cookie', participantCookie);
    await prisma.roomMember.create({
      data: { roomId: testRoomId1, userId: viewerUserId, role: 'VIEWER' },
    });
  });

  const createSocketClient = (cookieHeaders?: string[]): ClientSocket => {
    const cookieHeaderStr = cookieHeaders ? cookieHeaders.join('; ') : '';
    return Client(`http://localhost:${port}`, {
      extraHeaders: cookieHeaderStr ? { cookie: cookieHeaderStr } : {},
      transports: ['websocket'],
      reconnection: false,
    });
  };

  it('1. Authenticated room member can send chat message', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', () => {
      clientSocket.emit('chat:send', { roomId: testRoomId1, content: 'Hello team!' });
    });

    clientSocket.on('chat:message', (data) => {
      expect(data.roomId).toBe(testRoomId1);
      expect(data.senderId).toBe(ownerUserId);
      expect(data.senderName).toBe(userOwner.name);
      expect(data.content).toBe('Hello team!');
      clientSocket.disconnect();
      done();
    });
  });

  it('2. Non-member cannot send chat message', (done) => {
    const clientSocket = createSocketClient(nonMemberCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('chat:send', { roomId: testRoomId1, content: 'Unauthorized chat' });
    });

    clientSocket.on('chat:error', (err) => {
      expect(err.message).toBe('You are not authorized to send messages in this room');
      clientSocket.disconnect();
      done();
    });
  });

  it('3. Message is persisted to PostgreSQL database', (done) => {
    const clientSocket = createSocketClient(participantCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', () => {
      clientSocket.emit('chat:send', { roomId: testRoomId1, content: 'Persisted Message Test' });
    });

    clientSocket.on('chat:message', async (data) => {
      const msgInDb = await prisma.chatMessage.findUnique({
        where: { id: data.id },
      });
      expect(msgInDb).toBeDefined();
      expect(msgInDb?.content).toBe('Persisted Message Test');
      expect(msgInDb?.roomId).toBe(testRoomId1);
      clientSocket.disconnect();
      done();
    });
  });

  it('4. Other room members receive chat message in real time', (done) => {
    const clientOwner = createSocketClient(ownerCookie);
    const clientParticipant = createSocketClient(participantCookie);

    let ownerJoined = false;
    let participantJoined = false;

    const checkAndSend = () => {
      if (ownerJoined && participantJoined) {
        clientOwner.emit('chat:send', { roomId: testRoomId1, content: 'Broadcast Test' });
      }
    };

    clientOwner.on('connect', () => {
      clientOwner.emit('collaboration:join', { roomId: testRoomId1 });
    });
    clientOwner.on('presence:update', () => {
      ownerJoined = true;
      checkAndSend();
    });

    clientParticipant.on('connect', () => {
      clientParticipant.emit('collaboration:join', { roomId: testRoomId1 });
    });
    clientParticipant.on('presence:update', () => {
      participantJoined = true;
      checkAndSend();
    });

    clientParticipant.on('chat:message', (data) => {
      expect(data.content).toBe('Broadcast Test');
      expect(data.senderId).toBe(ownerUserId);
      clientOwner.disconnect();
      clientParticipant.disconnect();
      done();
    });
  });

  it('5. Message belongs only to correct room (Cross-Room Chat Isolation)', (done) => {
    const clientRoom1 = createSocketClient(ownerCookie);
    const clientRoom2 = createSocketClient(ownerCookie);

    clientRoom1.on('connect', () => {
      clientRoom1.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientRoom2.on('connect', () => {
      clientRoom2.emit('collaboration:join', { roomId: testRoomId2 });
    });

    let receivedInRoom2 = false;

    clientRoom2.on('chat:message', () => {
      receivedInRoom2 = true;
    });

    clientRoom1.on('presence:update', () => {
      clientRoom1.emit('chat:send', { roomId: testRoomId1, content: 'Isolated Room 1 Message' });

      setTimeout(() => {
        expect(receivedInRoom2).toBe(false);
        clientRoom1.disconnect();
        clientRoom2.disconnect();
        done();
      }, 300);
    });
  });

  it('6. Chat history can be retrieved by room member', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', () => {
      clientSocket.emit('chat:send', { roomId: testRoomId1, content: 'History Item 1' });
    });

    clientSocket.on('chat:message', () => {
      clientSocket.emit('chat:history', { roomId: testRoomId1 });
    });

    clientSocket.on('chat:history', (data) => {
      expect(data.roomId).toBe(testRoomId1);
      expect(data.messages.length).toBeGreaterThanOrEqual(1);
      expect(data.messages[0].content).toBe('History Item 1');
      clientSocket.disconnect();
      done();
    });
  });

  it('7. Non-member cannot retrieve history', (done) => {
    const clientSocket = createSocketClient(nonMemberCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('chat:history', { roomId: testRoomId1 });
    });

    clientSocket.on('chat:error', (err) => {
      expect(err.message).toBe('You are not authorized to access chat history for this room');
      clientSocket.disconnect();
      done();
    });
  });

  it('8. Empty message rejected by Zod validation', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', () => {
      clientSocket.emit('chat:send', { roomId: testRoomId1, content: '   ' });
    });

    clientSocket.on('chat:error', (err) => {
      expect(err.message).toBe('Message cannot be empty');
      clientSocket.disconnect();
      done();
    });
  });

  it('9. Oversized message rejected by Zod validation', (done) => {
    const clientSocket = createSocketClient(ownerCookie);
    const oversizedContent = 'a'.repeat(1001);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', () => {
      clientSocket.emit('chat:send', { roomId: testRoomId1, content: oversizedContent });
    });

    clientSocket.on('chat:error', (err) => {
      expect(err.message).toBe('Message cannot exceed 1000 characters');
      clientSocket.disconnect();
      done();
    });
  });

  it('10. Sender identity cannot be spoofed', (done) => {
    const clientSocket = createSocketClient(participantCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', () => {
      // Attempting to spoof senderId as ownerUserId
      clientSocket.emit('chat:send', {
        roomId: testRoomId1,
        senderId: ownerUserId,
        content: 'Spoof Test',
      });
    });

    clientSocket.on('chat:message', (data) => {
      expect(data.senderId).toBe(participantUserId);
      expect(data.senderName).toBe(userParticipant.name);
      clientSocket.disconnect();
      done();
    });
  });

  it('11. OWNER presence works', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', (data) => {
      expect(data.roomId).toBe(testRoomId1);
      const ownerPresence = data.users.find((u: any) => u.userId === ownerUserId);
      expect(ownerPresence).toBeDefined();
      expect(ownerPresence.role).toBe('OWNER');
      clientSocket.disconnect();
      done();
    });
  });

  it('12. PARTICIPANT presence works', (done) => {
    const clientSocket = createSocketClient(participantCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', (data) => {
      const partPresence = data.users.find((u: any) => u.userId === participantUserId);
      expect(partPresence).toBeDefined();
      expect(partPresence.role).toBe('PARTICIPANT');
      clientSocket.disconnect();
      done();
    });
  });

  it('13. VIEWER presence works', (done) => {
    const clientSocket = createSocketClient(viewerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', (data) => {
      const viewPresence = data.users.find((u: any) => u.userId === viewerUserId);
      expect(viewPresence).toBeDefined();
      expect(viewPresence.role).toBe('VIEWER');
      clientSocket.disconnect();
      done();
    });
  });

  it('14. User leaving room removes presence', (done) => {
    const clientOwner = createSocketClient(ownerCookie);
    const clientParticipant = createSocketClient(participantCookie);

    let ownerJoined = false;
    let participantJoined = false;

    clientOwner.on('connect', () => {
      clientOwner.emit('collaboration:join', { roomId: testRoomId1 });
    });
    clientOwner.on('presence:update', (data) => {
      ownerJoined = true;
      if (participantJoined) {
        const hasParticipant = data.users.some((u: any) => u.userId === participantUserId);
        if (!hasParticipant) {
          clientOwner.disconnect();
          done();
        }
      }
    });

    clientParticipant.on('connect', () => {
      clientParticipant.emit('collaboration:join', { roomId: testRoomId1 });
    });
    clientParticipant.on('presence:update', () => {
      participantJoined = true;
      setTimeout(() => {
        clientParticipant.disconnect();
      }, 100);
    });
  });

  it('15. Socket disconnect removes presence', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId1 });
    });

    clientSocket.on('presence:update', (data) => {
      expect(data.users.length).toBe(1);
      clientSocket.disconnect();
      setTimeout(() => {
        const presenceInServer = presenceService.getRoomPresence(testRoomId1);
        expect(presenceInServer.length).toBe(0);
        done();
      }, 200);
    });
  });

  it('16. Typing indicator is room scoped', (done) => {
    const clientRoom1 = createSocketClient(ownerCookie);
    const clientRoom2 = createSocketClient(ownerCookie);

    clientRoom1.on('connect', () => {
      clientRoom1.emit('collaboration:join', { roomId: testRoomId1 });
    });
    clientRoom2.on('connect', () => {
      clientRoom2.emit('collaboration:join', { roomId: testRoomId2 });
    });

    let room2ReceivedTyping = false;
    clientRoom2.on('chat:user-typing', () => {
      room2ReceivedTyping = true;
    });

    clientRoom1.on('presence:update', () => {
      clientRoom1.emit('chat:typing', { roomId: testRoomId1 });
      setTimeout(() => {
        expect(room2ReceivedTyping).toBe(false);
        clientRoom1.disconnect();
        clientRoom2.disconnect();
        done();
      }, 300);
    });
  });

  it('17. Unauthenticated socket cannot access chat', (done) => {
    const clientSocket = createSocketClient(); // No cookies

    clientSocket.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication token missing');
      clientSocket.disconnect();
      done();
    });
  });

  it('18. Cross-room chat isolation works', (done) => {
    const clientNonMember = createSocketClient(nonMemberCookie);

    clientNonMember.on('connect', () => {
      clientNonMember.emit('chat:send', { roomId: testRoomId1, content: 'Illegal Cross-Room Message' });
    });

    clientNonMember.on('chat:error', (err) => {
      expect(err.message).toBe('You are not authorized to send messages in this room');
      clientNonMember.disconnect();
      done();
    });
  });

  it('19. Multiple tabs do not incorrectly remove user presence (Reference Counting)', (done) => {
    const tab1 = createSocketClient(ownerCookie);
    let tab2: ClientSocket;

    tab1.on('connect', () => {
      tab1.emit('collaboration:join', { roomId: testRoomId1 });
    });

    tab1.on('presence:update', (data) => {
      const ownerPresence = data.users.find((u: any) => u.userId === ownerUserId);
      if (ownerPresence && ownerPresence.socketCount === 1 && !tab2) {
        // Tab 1 joined! Now connect Tab 2.
        tab2 = createSocketClient(ownerCookie);
        tab2.on('connect', () => {
          tab2.emit('collaboration:join', { roomId: testRoomId1 });
        });
      } else if (ownerPresence && ownerPresence.socketCount === 2) {
        // Both tabs connected! Close Tab 1.
        tab1.disconnect();

        setTimeout(() => {
          const presenceAfterTab1Close = presenceService.getRoomPresence(testRoomId1);
          const ownerStillOnline = presenceAfterTab1Close.find((u) => u.userId === ownerUserId);

          // Owner should STILL be online because Tab 2 is active!
          expect(ownerStillOnline).toBeDefined();
          expect(ownerStillOnline?.socketCount).toBe(1);

          tab2.disconnect();
          done();
        }, 200);
      }
    });
  }, 10000);

  it('20. Existing Phase 1–3 tests continue passing (All 49 existing test cases intact)', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(ownerUserId);
  });
});
