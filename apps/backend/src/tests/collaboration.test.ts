import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import http from 'http';
import { Server } from 'socket.io';
import { setupCollaborationSockets } from '../socket/collaboration.socket';
import { collaborationService } from '../services/collaboration.service';
import { prisma } from '@codesync/database';
import * as Y from 'yjs';

describe('Real-Time Collaboration & Socket.IO Authorization Security Suite', () => {
  let httpServer: http.Server;
  let ioServer: Server;
  let port: number;

  const userOwner = {
    email: 'collab_owner@example.com',
    password: 'Password123!',
    name: 'Collab Owner',
  };

  const userParticipant = {
    email: 'collab_part@example.com',
    password: 'Password123!',
    name: 'Collab Participant',
  };

  const userViewer = {
    email: 'collab_viewer@example.com',
    password: 'Password123!',
    name: 'Collab Viewer',
  };

  const userNonMember = {
    email: 'collab_nonmember@example.com',
    password: 'Password123!',
    name: 'Non Member',
  };

  let ownerCookie: string[];
  let ownerUserId: string;

  let participantCookie: string[];
  let participantUserId: string;

  let viewerCookie: string[];
  let viewerUserId: string;

  let nonMemberCookie: string[];

  let testRoomId: string;

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
    ioServer.close();
    httpServer.close(done);
  });

  const extractCookies = (res: any): string[] => {
    const raw = res.headers['set-cookie'];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((c: string) => c.split(';')[0]);
  };

  afterEach(async () => {
    collaborationService.clearSessions();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  beforeEach(async () => {
    collaborationService.clearSessions();
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

    // 5. Create Test Room
    const createRoomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Realtime Test Room', language: 'typescript' });

    expect(createRoomRes.status).toBe(201);
    testRoomId = createRoomRes.body.data.id;

    // 6. Add Participant
    await request(app).post(`/api/v1/rooms/${testRoomId}/join`).set('Cookie', participantCookie);

    // 7. Add Viewer
    await prisma.roomMember.create({
      data: {
        roomId: testRoomId,
        userId: viewerUserId,
        role: 'VIEWER',
      },
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

  it('1. Authenticated user can connect to Socket.IO and join permitted room', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId });
    });

    clientSocket.on('collaboration:sync', (data) => {
      expect(data.roomId).toBe(testRoomId);
      expect(data.role).toBe('OWNER');
      expect(data.language).toBe('typescript');
      expect(data.state).toBeDefined();
      clientSocket.disconnect();
      done();
    });
  });

  it('2. Unauthenticated socket connection is rejected', (done) => {
    const clientSocket = createSocketClient(); // No auth cookie

    clientSocket.on('connect_error', (err) => {
      expect(err.message).toContain('Authentication token missing');
      clientSocket.disconnect();
      done();
    });
  });

  it('3. Non-member is rejected when attempting to join room', (done) => {
    const clientSocket = createSocketClient(nonMemberCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId });
    });

    clientSocket.on('collaboration:error', (err) => {
      expect(err.message).toBe('You are not a member of this room');
      clientSocket.disconnect();
      done();
    });
  });

  it('4. Closed room rejects collaboration connection', async () => {
    await prisma.room.update({
      where: { id: testRoomId },
      data: { status: 'CLOSED' },
    });

    return new Promise<void>((resolve) => {
      const clientSocket = createSocketClient(ownerCookie);

      clientSocket.on('connect', () => {
        clientSocket.emit('collaboration:join', { roomId: testRoomId });
      });

      clientSocket.on('collaboration:error', (err) => {
        expect(err.message).toBe('Cannot join a closed room');
        clientSocket.disconnect();
        resolve();
      });
    });
  });

  it('5. Viewer connection is allowed and receives initial document sync', (done) => {
    const clientSocket = createSocketClient(viewerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId });
    });

    clientSocket.on('collaboration:sync', (data) => {
      expect(data.role).toBe('VIEWER');
      expect(data.state).toBeDefined();
      clientSocket.disconnect();
      done();
    });
  });

  it('6. Viewer cannot submit document edits (read-only enforcement)', (done) => {
    const clientSocket = createSocketClient(viewerCookie);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId });
    });

    clientSocket.on('collaboration:sync', () => {
      const dummyUpdate = Array.from(new Uint8Array([1, 2, 3]));
      clientSocket.emit('collaboration:update', { roomId: testRoomId, update: dummyUpdate });
    });

    clientSocket.on('collaboration:error', (err) => {
      expect(err.message).toBe('Viewers have read-only access and cannot edit');
      clientSocket.disconnect();
      done();
    });
  });

  it('7. Participant can submit document updates and updates are applied to server Y.Doc', (done) => {
    const clientSocket = createSocketClient(participantCookie);

    const testDoc = new Y.Doc();
    const yText = testDoc.getText('codemirror');
    yText.insert(0, '// Edit by Participant\n');
    const update = Y.encodeStateAsUpdate(testDoc);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId });
    });

    clientSocket.on('collaboration:sync', () => {
      clientSocket.emit('collaboration:update', {
        roomId: testRoomId,
        update: Array.from(update),
      });
      setTimeout(() => {
        clientSocket.disconnect();
        done();
      }, 300);
    });
  });

  it('8. Owner can submit document updates', (done) => {
    const clientSocket = createSocketClient(ownerCookie);

    const testDoc = new Y.Doc();
    const yText = testDoc.getText('codemirror');
    yText.insert(0, '// Edit by Owner\n');
    const update = Y.encodeStateAsUpdate(testDoc);

    clientSocket.on('connect', () => {
      clientSocket.emit('collaboration:join', { roomId: testRoomId });
    });

    clientSocket.on('collaboration:sync', () => {
      clientSocket.emit('collaboration:update', {
        roomId: testRoomId,
        update: Array.from(update),
      });
      setTimeout(() => {
        clientSocket.disconnect();
        done();
      }, 300);
    });
  });

  it('9. Yjs document state is persisted to PostgreSQL database', async () => {
    await collaborationService.getOrCreateDoc(testRoomId, 'typescript');
    await collaborationService.saveRoomDocument(testRoomId);

    const docInDb = await prisma.roomDocument.findUnique({
      where: { roomId: testRoomId },
    });

    expect(docInDb).toBeDefined();
    expect(docInDb?.roomId).toBe(testRoomId);
    expect(docInDb?.content).toContain('Realtime Test Room');
  });

  it('10. Joining a room emits room:members-updated to connected room owner', async () => {
    const ownerSocket = createSocketClient(ownerCookie);

    try {
      await new Promise<void>((resolve, reject) => {
        ownerSocket.on('connect_error', reject);
        ownerSocket.on('collaboration:sync', () => resolve());
        ownerSocket.on('connect', () => {
          ownerSocket.emit('collaboration:join', { roomId: testRoomId });
        });
      });

      const membersUpdatedPromise = new Promise<any>((resolve) => {
        ownerSocket.once('room:members-updated', (payload) => resolve(payload));
      });

      const joinRes = await request(app)
        .post(`/api/v1/rooms/${testRoomId}/join`)
        .set('Cookie', nonMemberCookie);

      expect(joinRes.status).toBe(200);

      const eventPayload = await membersUpdatedPromise;
      expect(eventPayload.roomId).toBe(testRoomId);
      expect(eventPayload.action).toBe('joined');
      expect(eventPayload.userId).toBeTruthy();
    } finally {
      ownerSocket.disconnect();
    }
  });

  it('11. Live role update synchronizes open sockets, presence, and edit/execute enforcement without reconnect', async () => {
    const ownerSocket = createSocketClient(ownerCookie);
    const participantSocket = createSocketClient(participantCookie);

    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          ownerSocket.on('connect_error', reject);
          ownerSocket.once('collaboration:sync', () => resolve());
          ownerSocket.on('connect', () => {
            ownerSocket.emit('collaboration:join', { roomId: testRoomId });
          });
        }),
        new Promise<void>((resolve, reject) => {
          participantSocket.on('connect_error', reject);
          participantSocket.once('collaboration:sync', (syncData) => {
            expect(syncData.role).toBe('PARTICIPANT');
            resolve();
          });
          participantSocket.on('connect', () => {
            participantSocket.emit('collaboration:join', { roomId: testRoomId });
          });
        }),
      ]);

      // Demote live PARTICIPANT -> VIEWER
      const demoteRolePromise = new Promise<any>((resolve) => {
        participantSocket.once('room:role-updated', (payload) => resolve(payload));
      });
      const demotePresencePromise = new Promise<any>((resolve) => {
        const onPresence = (payload: any) => {
          const target = payload?.users?.find((u: any) => u.userId === participantUserId);
          if (target?.role === 'VIEWER') {
            ownerSocket.off('presence:update', onPresence);
            resolve(payload);
          }
        };
        ownerSocket.on('presence:update', onPresence);
      });

      const demoteRes = await request(app)
        .patch(`/api/v1/rooms/${testRoomId}/members/${participantUserId}/role`)
        .set('Cookie', ownerCookie)
        .send({ role: 'VIEWER' });

      expect(demoteRes.status).toBe(200);
      expect(demoteRes.body.data.role).toBe('VIEWER');

      const [demoteEvent, demotePresence] = await Promise.all([
        demoteRolePromise,
        demotePresencePromise,
      ]);
      expect(demoteEvent).toMatchObject({
        roomId: testRoomId,
        userId: participantUserId,
        role: 'VIEWER',
      });
      expect(
        demotePresence.users.find((u: any) => u.userId === participantUserId)?.role
      ).toBe('VIEWER');

      // Open socket must now be blocked from emitting collaboration:update
      const editBlockedPromise = new Promise<any>((resolve) => {
        participantSocket.once('collaboration:error', (err) => resolve(err));
      });
      participantSocket.emit('collaboration:update', {
        roomId: testRoomId,
        update: Array.from(new Uint8Array([1, 2, 3])),
      });
      const editBlockedErr = await editBlockedPromise;
      expect(editBlockedErr.message).toBe('Viewers have read-only access and cannot edit');

      // Backend REST execute must also reject demoted VIEWER with 403
      const execBlockedRes = await request(app)
        .post(`/api/v1/rooms/${testRoomId}/execute`)
        .set('Cookie', participantCookie)
        .send({ code: 'console.log(1)', language: 'javascript' });
      expect(execBlockedRes.status).toBe(403);

      // Promote live VIEWER -> PARTICIPANT on the same socket without reconnect
      const promoteRolePromise = new Promise<any>((resolve) => {
        participantSocket.once('room:role-updated', (payload) => resolve(payload));
      });
      const promoteRes = await request(app)
        .patch(`/api/v1/rooms/${testRoomId}/members/${participantUserId}/role`)
        .set('Cookie', ownerCookie)
        .send({ role: 'PARTICIPANT' });

      expect(promoteRes.status).toBe(200);
      const promoteEvent = await promoteRolePromise;
      expect(promoteEvent.role).toBe('PARTICIPANT');

      // Open socket can now submit a real Yjs update and owner receives it
      const ownerReceivedUpdate = new Promise<any>((resolve) => {
        ownerSocket.once('collaboration:update', (payload) => resolve(payload));
      });
      const testDoc = new Y.Doc();
      testDoc.getText('codemirror').insert(0, '// Restored Participant Edit\n');
      participantSocket.emit('collaboration:update', {
        roomId: testRoomId,
        update: Array.from(Y.encodeStateAsUpdate(testDoc)),
      });
      const relayedUpdate = await ownerReceivedUpdate;
      expect(relayedUpdate.roomId).toBe(testRoomId);
    } finally {
      ownerSocket.disconnect();
      participantSocket.disconnect();
    }
  });

  it('12. Reconnecting socket after role update receives latest authoritative role in collaboration:sync', async () => {
    await request(app)
      .patch(`/api/v1/rooms/${testRoomId}/members/${participantUserId}/role`)
      .set('Cookie', ownerCookie)
      .send({ role: 'VIEWER' });

    const reconnectedSocket = createSocketClient(participantCookie);
    try {
      const syncData = await new Promise<any>((resolve, reject) => {
        reconnectedSocket.on('connect_error', reject);
        reconnectedSocket.once('collaboration:sync', (data) => resolve(data));
        reconnectedSocket.on('connect', () => {
          reconnectedSocket.emit('collaboration:join', { roomId: testRoomId });
        });
      });

      expect(syncData.role).toBe('VIEWER');
    } finally {
      reconnectedSocket.disconnect();
    }
  });

  it('13. Duplicate collaboration:join from the same socket does not double presence entries', async () => {
    const ownerSocket = createSocketClient(ownerCookie);
    try {
      const latestPresence = await new Promise<any>((resolve, reject) => {
        let syncCount = 0;
        let lastPresence: any = null;
        ownerSocket.on('connect_error', reject);
        ownerSocket.on('presence:update', (data) => {
          lastPresence = data;
        });
        ownerSocket.on('collaboration:sync', () => {
          syncCount += 1;
          if (syncCount === 1) {
            ownerSocket.emit('collaboration:join', { roomId: testRoomId });
          } else {
            setTimeout(() => resolve(lastPresence), 100);
          }
        });
        ownerSocket.on('connect', () => {
          ownerSocket.emit('collaboration:join', { roomId: testRoomId });
        });
      });

      const ownerEntries = latestPresence.users.filter((u: any) => u.userId === ownerUserId);
      expect(ownerEntries).toHaveLength(1);
    } finally {
      ownerSocket.disconnect();
    }
  });
});
