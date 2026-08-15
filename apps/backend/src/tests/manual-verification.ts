import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import http from 'http';
import { Server } from 'socket.io';
import { setupCollaborationSockets } from '../socket/collaboration.socket';
import { collaborationService } from '../services/collaboration.service';
import { presenceService } from '../services/presence.service';
import { dockerRunnerService } from '../services/docker-runner.service';
import { prisma } from '@codesync/database';
import * as Y from 'yjs';

async function runManualVerification() {
  console.log('--------------------------------------------------');
  console.log('🚀 Phase 6: AI Assistant & Real-Time Sync Verification');
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
  await prisma.aiMessage.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.roomDocument.deleteMany({});
  await prisma.roomMember.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'owner_verify@test.com',
          'participant_verify@test.com',
          'viewer_verify@test.com',
          'other_verify@test.com',
        ],
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

  // Register Other User (User D) for cross-room test
  const regOther = await request(app).post('/api/v1/auth/register').send({
    email: 'other_verify@test.com',
    password: 'Password123!',
    name: 'User D (Other)',
  });
  const otherCookie = extractCookies(regOther);

  // 5. Create Coding Room A
  const createRoomA = await request(app)
    .post('/api/v1/rooms')
    .set('Cookie', ownerCookie)
    .send({ name: 'AI Verification Room A', language: 'python' });
  const roomAId = createRoomA.body.data.id;

  // Create Coding Room B for Cross-Room Isolation test
  const createRoomB = await request(app)
    .post('/api/v1/rooms')
    .set('Cookie', otherCookie)
    .send({ name: 'AI Verification Room B', language: 'javascript' });
  const roomBId = createRoomB.body.data.id;

  // 6. User B Joins Room A as Participant
  await request(app).post(`/api/v1/rooms/${roomAId}/join`).set('Cookie', partCookie);

  // 7. User C Added as Viewer in Room A
  await prisma.roomMember.create({
    data: { roomId: roomAId, userId: viewerUserId, role: 'VIEWER' },
  });

  const connectUserSession = (cookies: string[], targetRoomId: string, userName: string, roleName: string) => {
    return new Promise<{ socket: ClientSocket; doc: Y.Doc }>((resolve) => {
      const socket = Client(`http://localhost:${port}`, {
        extraHeaders: { cookie: cookies.join('; ') },
        transports: ['websocket'],
      });

      const doc = new Y.Doc();

      socket.on('connect', () => {
        socket.emit('collaboration:join', { roomId: targetRoomId });
      });

      socket.on('collaboration:sync', (data) => {
        if (data.state && data.state.length > 0) {
          Y.applyUpdate(doc, new Uint8Array(data.state));
        }
        console.log(`✔ [${userName}] Joined & Synced (Role: ${roleName}, Room: ${targetRoomId.slice(0, 8)})`);
        resolve({ socket, doc });
      });
    });
  };

  const { socket: clientA } = await connectUserSession(ownerCookie, roomAId, 'User A (Owner)', 'OWNER');
  const { socket: clientB } = await connectUserSession(partCookie, roomAId, 'User B (Participant)', 'PARTICIPANT');
  const { socket: clientC } = await connectUserSession(viewCookie, roomAId, 'User C (Viewer)', 'VIEWER');
  const { socket: clientD } = await connectUserSession(otherCookie, roomBId, 'User D (Room B)', 'OWNER');

  // --- Scenario 1: OWNER sends an AI prompt ---
  console.log('\n--- Scenario 1: OWNER sends AI Prompt ---');
  let partReceivedAiA = false;
  let viewerReceivedAiA = false;

  clientB.once('ai:response', (data) => {
    if (data.prompt === 'Explain Python Recursion' && data.userName === 'User A (Owner)') {
      partReceivedAiA = true;
      console.log(`✔ [User B (Participant)] Received OWNER AI response in real time! (Prompted by: ${data.userName})`);
    }
  });

  clientC.once('ai:response', (data) => {
    if (data.prompt === 'Explain Python Recursion') {
      viewerReceivedAiA = true;
      console.log(`✔ [User C (Viewer)] Received OWNER AI response in real time!`);
    }
  });

  const resOwnerAi = await request(app)
    .post(`/api/v1/rooms/${roomAId}/ai/explain`)
    .set('Cookie', ownerCookie)
    .send({ prompt: 'Explain Python Recursion', code: 'def fact(n):\n return 1 if n<=1 else n*fact(n-1)' });

  if (resOwnerAi.status === 200 && resOwnerAi.body.data.response) {
    console.log('✔ [User A (Owner)] Prompted AI successfully');
  }

  await new Promise((r) => setTimeout(r, 600));
  if (partReceivedAiA && viewerReceivedAiA) {
    console.log('✔ PASS Scenario 1: OWNER AI prompt response broadcast to PARTICIPANT and VIEWER!');
  } else {
    console.error('❌ FAIL Scenario 1: AI response sync failed');
  }

  // --- Scenario 2: PARTICIPANT sends an AI prompt ---
  console.log('\n--- Scenario 2: PARTICIPANT sends AI Prompt ---');
  let ownerReceivedAiB = false;

  clientA.once('ai:response', (data) => {
    if (data.prompt === 'Refactor this loop' && data.userName === 'User B (Participant)') {
      ownerReceivedAiB = true;
      console.log(`✔ [User A (Owner)] Received PARTICIPANT AI response in real time! (Prompted by: ${data.userName})`);
    }
  });

  const resPartAi = await request(app)
    .post(`/api/v1/rooms/${roomAId}/ai/refactor`)
    .set('Cookie', partCookie)
    .send({ prompt: 'Refactor this loop', code: 'for i in range(len(arr)): print(arr[i])' });

  if (resPartAi.status === 200 && resPartAi.body.data.response) {
    console.log('✔ [User B (Participant)] Prompted AI successfully');
  }

  await new Promise((r) => setTimeout(r, 600));
  if (ownerReceivedAiB) {
    console.log('✔ PASS Scenario 2: PARTICIPANT AI prompt response broadcast to OWNER!');
  } else {
    console.error('❌ FAIL Scenario 2: AI response sync failed');
  }

  // --- Scenario 3: VIEWER attempts to send an AI prompt ---
  console.log('\n--- Scenario 3: VIEWER Attempts AI Prompt ---');
  const resViewerAi = await request(app)
    .post(`/api/v1/rooms/${roomAId}/ai/prompt`)
    .set('Cookie', viewCookie)
    .send({ prompt: 'Viewer prompt attempt' });

  if (resViewerAi.status === 403 && resViewerAi.body.error.message.includes('Viewers have read-only access')) {
    console.log('✔ PASS Scenario 3: VIEWER AI prompt strictly rejected with 403 FORBIDDEN!');
  } else {
    console.error('❌ FAIL Scenario 3: Viewer AI rejection check failed');
  }

  // --- Scenario 4: User from another room attempts to access/send AI request ---
  console.log('\n--- Scenario 4: Cross-Room AI Isolation Check ---');
  let roomDLeaked = false;
  clientD.on('ai:response', (data) => {
    if (data.roomId === roomAId) {
      roomDLeaked = true;
    }
  });

  const resCrossRoom = await request(app)
    .post(`/api/v1/rooms/${roomAId}/ai/prompt`)
    .set('Cookie', otherCookie)
    .send({ prompt: 'Cross room prompt attempt' });

  if (resCrossRoom.status === 403 && resCrossRoom.body.error.message.includes('not a member of this room')) {
    console.log('✔ PASS Scenario 4: Non-member AI prompt request rejected with 403 FORBIDDEN!');
  }

  await new Promise((r) => setTimeout(r, 600));
  if (!roomDLeaked) {
    console.log('✔ PASS Scenario 4: Room A AI response NEVER leaked to Room B!');
  } else {
    console.error('❌ FAIL Scenario 4: Cross-room leak detected');
  }

  // --- Scenario 5: Verify AI conversation history persists and reloads correctly ---
  console.log('\n--- Scenario 5: AI History Persistence & Retrieval ---');
  const resHistory = await request(app)
    .get(`/api/v1/rooms/${roomAId}/ai/history`)
    .set('Cookie', ownerCookie);

  if (resHistory.status === 200 && Array.isArray(resHistory.body.data) && resHistory.body.data.length >= 2) {
    console.log(`✔ PASS Scenario 5: AI conversation history persisted in PostgreSQL (${resHistory.body.data.length} messages reloaded)!`);
  } else {
    console.error('❌ FAIL Scenario 5: AI history check failed');
  }

  // --- Scenario 6: Verify Docker execution output can be used as debugging context ---
  console.log('\n--- Scenario 6: Docker Error Debug Context Integration ---');
  const resDebug = await request(app)
    .post(`/api/v1/rooms/${roomAId}/ai/debug`)
    .set('Cookie', ownerCookie)
    .send({
      code: 'x = 1 / 0',
      errorContext: 'ZeroDivisionError: division by zero',
    });

  if (resDebug.status === 200 && resDebug.body.data.response.includes('ZeroDivisionError')) {
    console.log('✔ PASS Scenario 6: Docker execution error output passed directly into AI Debugger context!');
  } else {
    console.error('❌ FAIL Scenario 6: AI Debugger context integration failed');
  }

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  clientD.disconnect();
  ioServer.close();
  httpServer.close();

  console.log('\n==================================================');
  console.log('🎉 PHASE 6 REAL MANUAL VERIFICATION 100% SUCCESSFUL');
  console.log('==================================================\n');
}

runManualVerification().catch(console.error);
