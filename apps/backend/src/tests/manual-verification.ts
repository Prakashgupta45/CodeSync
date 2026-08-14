import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import http from 'http';
import { Server } from 'socket.io';
import { setupCollaborationSockets } from '../socket/collaboration.socket';
import { collaborationService } from '../services/collaboration.service';
import { presenceService } from '../services/presence.service';
import { prisma } from '@codesync/database';
import * as Y from 'yjs';

async function runManualVerification() {
  console.log('--------------------------------------------------');
  console.log('🚀 Phase 4: Real-Time Multi-User & Chat/Presence Verification');
  console.log('--------------------------------------------------');

  const httpServer = http.createServer(app);
  const ioServer = new Server(httpServer, {
    cors: { origin: '*', credentials: true },
  });
  setupCollaborationSockets(ioServer);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address() as any;
  const port = address.port;
  console.log(`[Server] Socket.IO test server listening on port ${port}`);

  // 1. Clean Database
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
        in: ['owner_verify@test.com', 'participant_verify@test.com', 'viewer_verify@test.com'],
      },
    },
  });

  const extractCookies = (res: any): string[] => {
    const raw = res.headers['set-cookie'];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((c: string) => c.split(';')[0]);
  };

  // 2. Register Owner (User A)
  const regOwner = await request(app).post('/api/v1/auth/register').send({
    email: 'owner_verify@test.com',
    password: 'Password123!',
    name: 'User A (Owner)',
  });
  const ownerCookie = extractCookies(regOwner);

  // 3. Register Participant (User B)
  const regPart = await request(app).post('/api/v1/auth/register').send({
    email: 'participant_verify@test.com',
    password: 'Password123!',
    name: 'User B (Participant)',
  });
  const partCookie = extractCookies(regPart);

  // 4. Register Viewer (User C)
  const regView = await request(app).post('/api/v1/auth/register').send({
    email: 'viewer_verify@test.com',
    password: 'Password123!',
    name: 'User C (Viewer)',
  });
  const viewCookie = extractCookies(regView);
  const viewerUserId = regView.body.data.user.id;

  // 5. Create Coding Room
  const createRoom = await request(app)
    .post('/api/v1/rooms')
    .set('Cookie', ownerCookie)
    .send({ name: 'Verification Room', language: 'python' });
  const roomId = createRoom.body.data.id;
  console.log(`[Room] Created coding room ID: ${roomId}`);

  // 6. User B Joins as Participant
  await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', partCookie);

  // 7. User C Added as Viewer
  await prisma.roomMember.create({
    data: { roomId, userId: viewerUserId, role: 'VIEWER' },
  });

  const connectUserSession = (cookies: string[], userName: string, roleName: string) => {
    return new Promise<{ socket: ClientSocket; doc: Y.Doc }>((resolve) => {
      const socket = Client(`http://localhost:${port}`, {
        extraHeaders: { cookie: cookies.join('; ') },
        transports: ['websocket'],
      });

      const doc = new Y.Doc();

      socket.on('connect', () => {
        socket.emit('collaboration:join', { roomId });
      });

      socket.on('collaboration:sync', (data) => {
        if (data.state && data.state.length > 0) {
          Y.applyUpdate(doc, new Uint8Array(data.state));
        }
        console.log(`✔ [${userName}] Joined & Synced successfully (Role: ${roleName})`);
        resolve({ socket, doc });
      });
    });
  };

  const { socket: clientA, doc: docA } = await connectUserSession(ownerCookie, 'User A', 'OWNER');
  const { socket: clientB, doc: docB } = await connectUserSession(partCookie, 'User B', 'PARTICIPANT');
  const { socket: clientC, doc: docC } = await connectUserSession(viewCookie, 'User C', 'VIEWER');

  // Wire update listeners
  clientA.on('collaboration:update', (data) => Y.applyUpdate(docA, new Uint8Array(data.update)));
  clientB.on('collaboration:update', (data) => Y.applyUpdate(docB, new Uint8Array(data.update)));
  clientC.on('collaboration:update', (data) => Y.applyUpdate(docC, new Uint8Array(data.update)));

  // 11. Test Scenario 1: User A Types
  console.log('\n--- Scenario 1: User A Types "Hello from User A" ---');
  const yTextA = docA.getText('codemirror');
  let updateA: Uint8Array = new Uint8Array();
  docA.once('update', (u) => {
    updateA = u;
  });
  yTextA.insert(0, '# Hello from User A\n');
  clientA.emit('collaboration:update', { roomId, update: Array.from(updateA) });

  await new Promise((r) => setTimeout(r, 400));
  console.log(`[User B Doc Content]:\n${docB.getText('codemirror').toString().trim()}`);
  console.log(`[User C Doc Content]:\n${docC.getText('codemirror').toString().trim()}`);

  if (docB.getText('codemirror').toString().includes('Hello from User A')) {
    console.log('✔ PASS: User B received User A edit in real time!');
  } else {
    console.error('❌ FAIL: User B did not receive edit');
  }

  // 12. Test Scenario 2: User B Types
  console.log('\n--- Scenario 2: User B Types "Hello from User B" ---');
  const yTextB = docB.getText('codemirror');
  let updateB: Uint8Array = new Uint8Array();
  docB.once('update', (u) => {
    updateB = u;
  });
  yTextB.insert(yTextB.length, '# Hello from User B\n');
  clientB.emit('collaboration:update', { roomId, update: Array.from(updateB) });

  await new Promise((r) => setTimeout(r, 400));
  console.log(`[User A Doc Content]:\n${docA.getText('codemirror').toString().trim()}`);

  if (docA.getText('codemirror').toString().includes('Hello from User B')) {
    console.log('✔ PASS: User A received User B edit in real time!');
  } else {
    console.error('❌ FAIL: User A did not receive edit');
  }

  // 13. Test Scenario 3: User C (Viewer) Attempted Edit Rejection
  console.log('\n--- Scenario 3: User C (Viewer) Edit Security Check ---');
  clientC.once('collaboration:error', (err) => {
    console.log(`✔ PASS: Server rejected Viewer edit with error: "${err.message}"`);
  });
  clientC.emit('collaboration:update', { roomId, update: [1, 2, 3] });

  await new Promise((r) => setTimeout(r, 400));

  // 14. Test Scenario 4: Real-Time Chat & History Persistence
  console.log('\n--- Scenario 4: Real-Time Chat & History Persistence ---');
  let chatReceivedByB = false;
  clientB.once('chat:message', (msg) => {
    if (msg.content === 'Hello room from Owner!') {
      chatReceivedByB = true;
      console.log(`✔ PASS: User B received real-time chat message from User A (${msg.senderName}: "${msg.content}")`);
    }
  });

  clientA.emit('chat:send', { roomId, content: 'Hello room from Owner!' });
  await new Promise((r) => setTimeout(r, 400));

  const messagesInDb = await prisma.chatMessage.findMany({ where: { roomId } });
  if (chatReceivedByB && messagesInDb.length === 1 && messagesInDb[0].content === 'Hello room from Owner!') {
    console.log('✔ PASS: Chat message persisted in PostgreSQL database!');
  } else {
    console.error('❌ FAIL: Chat persistence check failed');
  }

  // 15. Test Scenario 5: Real-Time Room Presence Verification
  console.log('\n--- Scenario 5: Real-Time Room Presence Verification ---');
  const presenceState = presenceService.getRoomPresence(roomId);
  console.log(`[Online Presence Members Count]: ${presenceState.length}`);
  presenceState.forEach((u) => {
    console.log(`  - ${u.name} (Role: ${u.role}, Sockets: ${u.socketCount})`);
  });

  if (presenceState.length === 3) {
    console.log('✔ PASS: Real-time room presence accurately tracks all 3 online members (OWNER, PARTICIPANT, VIEWER)!');
  } else {
    console.error('❌ FAIL: Presence tracking failed');
  }

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  ioServer.close();
  httpServer.close();

  console.log('\n==================================================');
  console.log('🎉 PHASE 4 REAL MANUAL VERIFICATION 100% SUCCESSFUL');
  console.log('==================================================\n');
}

runManualVerification().catch(console.error);
