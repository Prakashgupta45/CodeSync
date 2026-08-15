import request from 'supertest';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import { prisma } from '@codesync/database';
import { setupCollaborationSockets } from '../socket/collaboration.socket';

describe('Phase 6 — AI Assistant & Pair Programming Intelligence Security Suite', () => {
  const userOwner = {
    email: 'ai_owner@example.com',
    password: 'Password123!',
    name: 'AI Owner',
  };

  const userParticipant = {
    email: 'ai_part@example.com',
    password: 'Password123!',
    name: 'AI Participant',
  };

  const userViewer = {
    email: 'ai_viewer@example.com',
    password: 'Password123!',
    name: 'AI Viewer',
  };

  const userNonMember = {
    email: 'ai_nonmember@example.com',
    password: 'Password123!',
    name: 'AI NonMember',
  };

  let ownerCookie: string[];
  let ownerUserId: string;

  let participantCookie: string[];
  let participantUserId: string;

  let viewerCookie: string[];
  let viewerUserId: string;

  let nonMemberCookie: string[];

  let testRoomId: string;

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

    // 5. Create Test Room
    const createRoomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'AI Intelligence Suite Room', language: 'python' });
    expect(createRoomRes.status).toBe(201);
    testRoomId = createRoomRes.body.data.id;

    // 6. Join Participant & Viewer to Room
    await request(app).post(`/api/v1/rooms/${testRoomId}/join`).set('Cookie', participantCookie);
    await prisma.roomMember.create({
      data: { roomId: testRoomId, userId: viewerUserId, role: 'VIEWER' },
    });
  });

  afterEach(async () => {
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  it('1. Authenticated room OWNER can send prompt to AI Assistant', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', ownerCookie)
      .send({ action: 'CHAT', prompt: 'How does binary search work?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userName).toBe(userOwner.name);
    expect(res.body.data.userRole).toBe('OWNER');
    expect(res.body.data.response).toContain('AI Pair Programmer Response');
  });

  it('2. Authenticated room PARTICIPANT can send prompt to AI Assistant', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', participantCookie)
      .send({ action: 'CHAT', prompt: 'Explain Python recursion' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userName).toBe(userParticipant.name);
    expect(res.body.data.userRole).toBe('PARTICIPANT');
  });

  it('3. VIEWER is strictly rejected from sending AI prompts (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', viewerCookie)
      .send({ action: 'CHAT', prompt: 'Viewer prompt attempt' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Viewers have read-only access and cannot send AI prompts');
  });

  it('4. Non-member is rejected from accessing AI endpoints (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', nonMemberCookie)
      .send({ action: 'CHAT', prompt: 'Non-member prompt attempt' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('You are not a member of this room and cannot access AI assistant');
  });

  it('5. Unauthenticated request returns 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .send({ action: 'CHAT', prompt: 'No auth prompt' });

    expect(res.status).toBe(401);
  });

  it('6. Explain Code action works (/ai/explain)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/explain`)
      .set('Cookie', ownerCookie)
      .send({ code: 'def add(a, b):\n    return a + b' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('EXPLAIN');
    expect(res.body.data.response).toContain('Code Explanation');
  });

  it('7. Debug Error action works (/ai/debug)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/debug`)
      .set('Cookie', ownerCookie)
      .send({ code: 'x = 1 / 0', errorContext: 'ZeroDivisionError: division by zero' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('DEBUG');
    expect(res.body.data.response).toContain('AI Debugger Analysis');
  });

  it('8. Refactor Code action works (/ai/refactor)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/refactor`)
      .set('Cookie', ownerCookie)
      .send({ code: 'def foo(): pass' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('REFACTOR');
    expect(res.body.data.response).toContain('Refactoring');
  });

  it('9. Generate Tests action works (/ai/tests)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/tests`)
      .set('Cookie', ownerCookie)
      .send({ code: 'def solve(x): return x * 2' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('TESTS');
    expect(res.body.data.response).toContain('Unit Test Suite');
  });

  it('10. AI response is broadcast in real time to connected room members via Socket.IO', (done) => {
    const socketParticipant = createSocketClient(participantCookie);

    socketParticipant.on('connect', () => {
      socketParticipant.emit('collaboration:join', { roomId: testRoomId });
    });

    socketParticipant.on('collaboration:sync', () => {
      request(app)
        .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
        .set('Cookie', ownerCookie)
        .send({ action: 'CHAT', prompt: 'Sync AI Response Test' })
        .then((res) => {
          expect(res.status).toBe(200);
        });
    });

    socketParticipant.on('ai:response', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(data.userName).toBe(userOwner.name);
      expect(data.userRole).toBe('OWNER');
      expect(data.prompt).toBe('Sync AI Response Test');
      expect(data.response).toBeTruthy();
      socketParticipant.disconnect();
      done();
    });
  });

  it('11. AI conversation history persists in PostgreSQL database and can be fetched', async () => {
    await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', ownerCookie)
      .send({ action: 'CHAT', prompt: 'History Test Prompt 1' });

    await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', participantCookie)
      .send({ action: 'EXPLAIN', prompt: 'History Test Prompt 2' });

    const historyRes = await request(app)
      .get(`/api/v1/rooms/${testRoomId}/ai/history`)
      .set('Cookie', viewerCookie); // Viewer CAN view history

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(2);
    expect(historyRes.body.data[0].prompt).toBe('History Test Prompt 1');
    expect(historyRes.body.data[1].prompt).toBe('History Test Prompt 2');
  });

  it('12. Cross-room isolation: Non-members do NOT receive another room AI response events', (done) => {
    const socketNonMember = createSocketClient(nonMemberCookie);
    let receivedUnintendedEvent = false;

    socketNonMember.on('connect', () => {
      socketNonMember.on('ai:response', () => {
        receivedUnintendedEvent = true;
      });

      request(app)
        .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
        .set('Cookie', ownerCookie)
        .send({ action: 'CHAT', prompt: 'Isolated Room AI Prompt' })
        .then((res) => {
          expect(res.status).toBe(200);
          setTimeout(() => {
            expect(receivedUnintendedEvent).toBe(false);
            socketNonMember.disconnect();
            done();
          }, 600);
        });
    });
  });

  it('13. Oversized prompt payload (>4000 chars) is rejected (400 BAD REQUEST)', async () => {
    const oversizedPrompt = 'a'.repeat(4001);
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/ai/prompt`)
      .set('Cookie', ownerCookie)
      .send({ action: 'CHAT', prompt: oversizedPrompt });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Prompt exceeds 4000 characters limit');
  });

  it('14. Non-existent room returns 404 ROOM_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/00000000-0000-0000-0000-000000000000/ai/prompt')
      .set('Cookie', ownerCookie)
      .send({ action: 'CHAT', prompt: 'Test' });

    expect(res.status).toBe(404);
  });
});
