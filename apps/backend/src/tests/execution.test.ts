import request from 'supertest';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import { prisma } from '@codesync/database';
import { dockerRunnerService } from '../services/docker-runner.service';
import { setupCollaborationSockets } from '../socket/collaboration.socket';

describe('Phase 5 — Secure Docker Code Execution & Security Suite', () => {
  const userOwner = {
    email: 'exec_owner@example.com',
    password: 'Password123!',
    name: 'Exec Owner',
  };

  const userParticipant = {
    email: 'exec_part@example.com',
    password: 'Password123!',
    name: 'Exec Participant',
  };

  const userViewer = {
    email: 'exec_viewer@example.com',
    password: 'Password123!',
    name: 'Exec Viewer',
  };

  const userNonMember = {
    email: 'exec_nonmember@example.com',
    password: 'Password123!',
    name: 'Exec NonMember',
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

    // Setup HTTP + Socket.IO test server
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
      .send({ name: 'Docker Execution Suite Room', language: 'javascript' });
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

  it('1. Authenticated room OWNER can execute JavaScript code in Docker', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) {
      console.warn('Docker engine unavailable on host; skipping container execution test');
      return;
    }

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'javascript', code: 'console.log("Hello Docker JS!");' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stdout).toBe('Hello Docker JS!');
    expect(res.body.data.exitCode).toBe(0);
  }, 15000);

  it('2. Authenticated room PARTICIPANT can execute Python code in Docker', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', participantCookie)
      .send({ language: 'python', code: 'print("Hello Docker Python!")' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stdout).toBe('Hello Docker Python!');
    expect(res.body.data.exitCode).toBe(0);
  }, 15000);

  it('3. VIEWER is strictly rejected from executing code (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', viewerCookie)
      .send({ language: 'javascript', code: 'console.log("Viewer attempt");' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Viewers have read-only access and cannot execute code');
  });

  it('4. Non-member is rejected from executing room code (403 FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', nonMemberCookie)
      .send({ language: 'javascript', code: 'console.log("Non-member attempt");' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('You are not a member of this room and cannot execute code');
  });

  it('5. Unauthenticated request is rejected (401 UNAUTHORIZED)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .send({ language: 'javascript', code: 'console.log("No auth");' });

    expect(res.status).toBe(401);
  });

  it('6. Supported languages are accepted by Zod validator', async () => {
    const languages = ['javascript', 'python', 'cpp', 'java', 'typescript'];
    for (const lang of languages) {
      const res = await request(app)
        .post(`/api/v1/rooms/${testRoomId}/execute`)
        .set('Cookie', ownerCookie)
        .send({ language: lang, code: '// test' });

      expect(res.status).not.toBe(400);
    }
  }, 30000);

  it('7. Unsupported language is rejected by Zod validation (400 BAD REQUEST)', async () => {
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'ruby', code: 'puts "Hello"' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('javascript');
  });

  it('8. Oversized code payload (>50KB) is rejected (400 BAD REQUEST)', async () => {
    const oversizedCode = 'a'.repeat(50001);
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'javascript', code: oversizedCode });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Code payload exceeds 50KB maximum limit');
  });

  it('9. Compilation error is captured correctly', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'cpp', code: 'int main() { invalid_cpp_code syntax; }' });

    expect(res.status).toBe(200);
    expect(res.body.data.exitCode).not.toBe(0);
    expect(res.body.data.compileError).toBeTruthy();
  }, 15000);

  it('10. Runtime error is captured correctly', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'python', code: 'x = 1 / 0' });

    expect(res.status).toBe(200);
    expect(res.body.data.exitCode).not.toBe(0);
    expect(res.body.data.runtimeError).toContain('ZeroDivisionError');
  }, 15000);

  it('11. Execution timeout is enforced on infinite loop', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'javascript', code: 'while(true) {}' });

    expect(res.status).toBe(200);
    expect(res.body.data.timedOut).toBe(true);
    expect(res.body.data.stderr).toContain('timed out');
  }, 15000);

  it('12. Network access is disabled inside execution container (--net=none)', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const code = `
import socket
try:
    socket.create_connection(("8.8.8.8", 53), timeout=2)
    print("NET_CONNECTED")
except Exception as e:
    print("NET_BLOCKED")
`;
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'python', code });

    expect(res.status).toBe(200);
    expect(res.body.data.stdout).toBe('NET_BLOCKED');
  }, 15000);

  it('13. User code cannot write to host filesystem (--read-only container root)', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const code = `
try:
    with open('/etc/malicious.txt', 'w') as f:
        f.write('hacked')
    print("WRITE_SUCCESS")
except Exception as e:
    print("WRITE_BLOCKED")
`;
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'python', code });

    expect(res.status).toBe(200);
    expect(res.body.data.stdout).toBe('WRITE_BLOCKED');
  }, 15000);

  it('14. Verification check for Docker Engine status', async () => {
    const status = await dockerRunnerService.verifyDockerAvailable();
    expect(typeof status).toBe('boolean');
  });

  it('15. Concurrent code executions run independently without race conditions', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const req1 = request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'python', code: 'import time; time.sleep(1); print("TASK_1")' });

    const req2 = request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', participantCookie)
      .send({ language: 'javascript', code: 'console.log("TASK_2");' });

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.status).toBe(200);
    expect(res1.body.data.stdout).toBe('TASK_1');

    expect(res2.status).toBe(200);
    expect(res2.body.data.stdout).toBe('TASK_2');
  }, 20000);

  it('16. Non-existent room returns 404 ROOM_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/00000000-0000-0000-0000-000000000000/execute')
      .set('Cookie', ownerCookie)
      .send({ language: 'javascript', code: 'console.log("404 test")' });

    expect(res.status).toBe(404);
  });

  it('17. OWNER execution result is broadcast in real time to connected room members', (done) => {
    const isDockerAvailable = dockerRunnerService.verifyDockerAvailable();
    isDockerAvailable.then((available) => {
      if (!available) return done();

      const socketParticipant = createSocketClient(participantCookie);

      socketParticipant.on('connect', () => {
        socketParticipant.emit('collaboration:join', { roomId: testRoomId });
      });

      socketParticipant.on('collaboration:sync', () => {
        // Trigger execution from OWNER HTTP endpoint
        request(app)
          .post(`/api/v1/rooms/${testRoomId}/execute`)
          .set('Cookie', ownerCookie)
          .send({ language: 'javascript', code: 'console.log("Broadcast Owner Output");' })
          .then((res) => {
            expect(res.status).toBe(200);
          });
      });

      socketParticipant.on('execution:result', (data) => {
        expect(data.roomId).toBe(testRoomId);
        expect(data.executedBy.name).toBe(userOwner.name);
        expect(data.executedBy.role).toBe('OWNER');
        expect(data.stdout).toBe('Broadcast Owner Output');
        expect(data.exitCode).toBe(0);
        socketParticipant.disconnect();
        done();
      });
    });
  }, 15000);

  it('18. PARTICIPANT execution result is broadcast in real time to connected room members', (done) => {
    const isDockerAvailable = dockerRunnerService.verifyDockerAvailable();
    isDockerAvailable.then((available) => {
      if (!available) return done();

      const socketOwner = createSocketClient(ownerCookie);

      socketOwner.on('connect', () => {
        socketOwner.emit('collaboration:join', { roomId: testRoomId });
      });

      socketOwner.on('collaboration:sync', () => {
        // Trigger execution from PARTICIPANT HTTP endpoint
        request(app)
          .post(`/api/v1/rooms/${testRoomId}/execute`)
          .set('Cookie', participantCookie)
          .send({ language: 'python', code: 'print("Broadcast Participant Output")' })
          .then((res) => {
            expect(res.status).toBe(200);
          });
      });

      socketOwner.on('execution:result', (data) => {
        expect(data.roomId).toBe(testRoomId);
        expect(data.executedBy.name).toBe(userParticipant.name);
        expect(data.executedBy.role).toBe('PARTICIPANT');
        expect(data.stdout).toBe('Broadcast Participant Output');
        expect(data.exitCode).toBe(0);
        socketOwner.disconnect();
        done();
      });
    });
  }, 15000);

  it('19. Cross-room isolation: Non-members do NOT receive another room execution result', (done) => {
    const socketNonMember = createSocketClient(nonMemberCookie);
    let receivedUnintendedEvent = false;

    socketNonMember.on('connect', () => {
      socketNonMember.on('execution:result', () => {
        receivedUnintendedEvent = true;
      });

      // Trigger execution in testRoomId
      request(app)
        .post(`/api/v1/rooms/${testRoomId}/execute`)
        .set('Cookie', ownerCookie)
        .send({ language: 'javascript', code: 'console.log("Secret Room Output");' })
        .then((res) => {
          expect(res.status).toBe(200);
          setTimeout(() => {
            expect(receivedUnintendedEvent).toBe(false);
            socketNonMember.disconnect();
            done();
          }, 600);
        });
    });
  }, 15000);
});
