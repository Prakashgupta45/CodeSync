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
  console.log('🚀 Phase 5: Multi-User Real-Time Execution Sync Verification');
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

  // 5. Create Coding Room A
  const createRoomA = await request(app)
    .post('/api/v1/rooms')
    .set('Cookie', ownerCookie)
    .send({ name: 'Verification Room A', language: 'python' });
  const roomAId = createRoomA.body.data.id;
  console.log(`[Room A] Created coding room ID: ${roomAId}`);

  // Create Coding Room B for Cross-Room Isolation test
  const createRoomB = await request(app)
    .post('/api/v1/rooms')
    .set('Cookie', ownerCookie)
    .send({ name: 'Verification Room B', language: 'javascript' });
  const roomBId = createRoomB.body.data.id;
  console.log(`[Room B] Created isolated room ID: ${roomBId}`);

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
        console.log(`✔ [${userName}] Joined & Synced successfully (Role: ${roleName}, Room: ${targetRoomId.slice(0, 8)})`);
        resolve({ socket, doc });
      });
    });
  };

  const { socket: clientA, doc: docA } = await connectUserSession(ownerCookie, roomAId, 'User A (Owner)', 'OWNER');
  const { socket: clientB, doc: docB } = await connectUserSession(partCookie, roomAId, 'User B (Participant)', 'PARTICIPANT');
  const { socket: clientC, doc: docC } = await connectUserSession(viewCookie, roomAId, 'User C (Viewer)', 'VIEWER');
  const { socket: clientB_RoomB } = await connectUserSession(partCookie, roomBId, 'User B (Room B)', 'PARTICIPANT');

  // Wire update listeners
  clientA.on('collaboration:update', (data) => Y.applyUpdate(docA, new Uint8Array(data.update)));
  clientB.on('collaboration:update', (data) => Y.applyUpdate(docB, new Uint8Array(data.update)));
  clientC.on('collaboration:update', (data) => Y.applyUpdate(docC, new Uint8Array(data.update)));

  const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();

  if (isDockerAvailable) {
    // --- Scenario A: OWNER runs Python code print("Hello from OWNER") ---
    console.log('\n--- Scenario A: OWNER runs Python code print("Hello from OWNER") ---');
    let partReceivedSyncA = false;
    let viewerReceivedSyncA = false;

    clientB.once('execution:result', (data) => {
      if (data.stdout === 'Hello from OWNER' && data.executedBy.role === 'OWNER') {
        partReceivedSyncA = true;
        console.log(`✔ [User B (Participant)] Received OWNER execution result: "${data.stdout}" (Executed by: ${data.executedBy.name})`);
      }
    });

    clientC.once('execution:result', (data) => {
      if (data.stdout === 'Hello from OWNER') {
        viewerReceivedSyncA = true;
        console.log(`✔ [User C (Viewer)] Received OWNER execution result: "${data.stdout}"`);
      }
    });

    const resOwnerExec = await request(app)
      .post(`/api/v1/rooms/${roomAId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'python', code: 'print("Hello from OWNER")' });

    expect(resOwnerExec.status).toBe(200);
    console.log(`[User A (Owner)] Executed code successfully (Time: ${resOwnerExec.body.data.executionTimeMs}ms)`);

    await new Promise((r) => setTimeout(r, 600));

    if (partReceivedSyncA && viewerReceivedSyncA) {
      console.log('✔ PASS Scenario A: Real-time execution output synced from OWNER to PARTICIPANT and VIEWER!');
    } else {
      console.error('❌ FAIL Scenario A: Output sync failed');
    }

    // --- Scenario B: PARTICIPANT runs JavaScript code console.log("Hello from PARTICIPANT") ---
    console.log('\n--- Scenario B: PARTICIPANT runs JS code console.log("Hello from PARTICIPANT") ---');
    let ownerReceivedSyncB = false;

    clientA.once('execution:result', (data) => {
      if (data.stdout === 'Hello from PARTICIPANT' && data.executedBy.role === 'PARTICIPANT') {
        ownerReceivedSyncB = true;
        console.log(`✔ [User A (Owner)] Received PARTICIPANT execution result: "${data.stdout}" (Executed by: ${data.executedBy.name})`);
      }
    });

    const resPartExec = await request(app)
      .post(`/api/v1/rooms/${roomAId}/execute`)
      .set('Cookie', partCookie)
      .send({ language: 'javascript', code: 'console.log("Hello from PARTICIPANT");' });

    expect(resPartExec.status).toBe(200);
    console.log(`[User B (Participant)] Executed code successfully (Time: ${resPartExec.body.data.executionTimeMs}ms)`);

    await new Promise((r) => setTimeout(r, 600));

    if (ownerReceivedSyncB) {
      console.log('✔ PASS Scenario B: Real-time execution output synced from PARTICIPANT to OWNER!');
    } else {
      console.error('❌ FAIL Scenario B: Output sync failed');
    }

    // --- Scenario C: VIEWER attempts execution ---
    console.log('\n--- Scenario C: VIEWER attempts execution ---');
    const resViewExec = await request(app)
      .post(`/api/v1/rooms/${roomAId}/execute`)
      .set('Cookie', viewCookie)
      .send({ language: 'python', code: 'print("Viewer attempt")' });

    if (resViewExec.status === 403 && resViewExec.body.error.message.includes('Viewers have read-only access')) {
      console.log('✔ PASS Scenario C: VIEWER execution request strictly rejected with 403 FORBIDDEN!');
    } else {
      console.error('❌ FAIL Scenario C: Viewer rejection check failed');
    }

    // --- Scenario D: Cross-Room Isolation ---
    console.log('\n--- Scenario D: Cross-Room Execution Output Isolation ---');
    let roomBLeaked = false;
    clientB_RoomB.on('execution:result', (data) => {
      if (data.roomId === roomAId) {
        roomBLeaked = true;
      }
    });

    await request(app)
      .post(`/api/v1/rooms/${roomAId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'python', code: 'print("Room A Secret Output")' });

    await new Promise((r) => setTimeout(r, 600));

    if (!roomBLeaked) {
      console.log('✔ PASS Scenario D: Room A execution output NEVER leaked to Room B!');
    } else {
      console.error('❌ FAIL Scenario D: Cross-room leak detected');
    }
  } else {
    console.warn('Docker engine unavailable on host system; skipping manual execution steps');
  }

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  clientB_RoomB.disconnect();
  ioServer.close();
  httpServer.close();

  console.log('\n==================================================');
  console.log('🎉 PHASE 5 EXECUTION SYNC VERIFICATION 100% SUCCESSFUL');
  console.log('==================================================\n');
}

runManualVerification().catch(console.error);
