import request from 'supertest';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import app from '../app';
import { prisma } from '@codesync/database';
import { dockerRunnerService } from '../services/docker-runner.service';
import { setupCollaborationSockets } from '../socket/collaboration.socket';
import { collaborationService } from '../services/collaboration.service';
import { signCandidateInterviewToken } from '../utils/jwt';

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
  }, 20000);

  afterEach(async () => {
    collaborationService.clearSessions();
    if (ioServer) {
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    } else if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
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
    expect(res.body.error.message).toContain('Unsupported language');
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

  it('20. Regression: C++ Two Sum with unordered_map executes without timeout and returns [0, 1]', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const cppTwoSumCode = `
#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int complement = target - nums[i];
            if (seen.find(complement) != seen.end()) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    Solution sol;
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    vector<int> res = sol.twoSum(nums, target);
    cout << "[" << res[0] << ", " << res[1] << "]" << endl;
    return 0;
}
`;

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'cpp', code: cppTwoSumCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timedOut).toBe(false);
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.stdout).toBe('[0, 1]');
    expect(res.body.data.executionTimeMs).toBeLessThan(10000);
  }, 25000);

  it('21. Regression: C++ Two Sum verifies Test Cases 1, 2, and 3 correctly', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const generateCppCode = (nums: number[], target: number) => `
#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int complement = target - nums[i];
            if (seen.find(complement) != seen.end()) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    Solution sol;
    vector<int> nums = {${nums.join(', ')}};
    int target = ${target};
    vector<int> res = sol.twoSum(nums, target);
    cout << "[" << res[0] << ", " << res[1] << "]" << endl;
    return 0;
}
`;

    // Case 1
    const res1 = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'cpp', code: generateCppCode([2, 7, 11, 15], 9) });
    expect(res1.body.data.stdout).toBe('[0, 1]');
    expect(res1.body.data.exitCode).toBe(0);

    // Case 2
    const res2 = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'cpp', code: generateCppCode([3, 2, 4], 6) });
    expect(res2.body.data.stdout).toBe('[1, 2]');
    expect(res2.body.data.exitCode).toBe(0);

    // Case 3
    const res3 = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'cpp', code: generateCppCode([3, 3], 6) });
    expect(res3.body.data.stdout).toBe('[0, 1]');
    expect(res3.body.data.exitCode).toBe(0);
  }, 45000);

  it('22. Regression: C++ Two Sum handles large input (10,000 items) with O(n) performance', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const largeInputCode = `
#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int complement = target - nums[i];
            if (seen.find(complement) != seen.end()) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    Solution sol;
    vector<int> nums(10000);
    for (int i = 0; i < 10000; i++) {
        nums[i] = i * 2;
    }
    int target = nums[9998] + nums[9999];
    vector<int> res = sol.twoSum(nums, target);
    cout << "[" << res[0] << ", " << res[1] << "]" << endl;
    return 0;
}
`;

    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'cpp', code: largeInputCode });

    expect(res.status).toBe(200);
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.stdout).toBe('[9998, 9999]');
    expect(res.body.data.timedOut).toBe(false);
  }, 25000);

  it('23. Multi-language: Java execution functions properly in Docker', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const javaCode = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello Java Docker");
    }
}
`;
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'java', code: javaCode });

    expect(res.status).toBe(200);
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.stdout).toBe('Hello Java Docker');
  }, 25000);

  it('24. Multi-language: TypeScript execution functions properly in Docker', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const tsCode = `
const greeting: string = "Hello TypeScript Docker";
console.log(greeting);
`;
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('Cookie', ownerCookie)
      .send({ language: 'typescript', code: tsCode });

    expect(res.status).toBe(200);
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.stdout).toBe('Hello TypeScript Docker');
  }, 25000);

  it('25. Interview Assessment: Executes code in virtual interview room with valid signed candidate token', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const interviewRoomId = 'room-interview-dmmueag';
    const candidateToken = signCandidateInterviewToken('cs_inv_test_25', interviewRoomId);
    const pyCode = 'print("Interview room execution works!")';

    const res = await request(app)
      .post(`/api/v1/rooms/${interviewRoomId}/execute`)
      .set('X-Interview-Token', candidateToken)
      .send({ language: 'python', code: pyCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.stdout).toBe('Interview room execution works!');
    expect(res.body.data.roomId).toBe(interviewRoomId);
  }, 25000);

  it('26. LIS Execution: Executes C++ Longest Increasing Subsequence across all test cases', async () => {
    const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
    if (!isDockerAvailable) return;

    const interviewRoomId = 'room-interview-dmmueag';
    const candidateToken = signCandidateInterviewToken('cs_inv_test_26', interviewRoomId);

    const lisCppProgram = `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int longestIncreasingSubsequence(vector<int>& nums) {
        if (nums.empty()) return 0;
        vector<int> tails;
        for (int x : nums) {
            auto it = lower_bound(tails.begin(), tails.end(), x);
            if (it == tails.end()) tails.push_back(x);
            else *it = x;
        }
        return tails.size();
    }
};

int main() {
    Solution sol;
    vector<int> t1 = {10, 9, 2, 5, 3, 7, 101, 18};
    vector<int> t2 = {0, 1, 0, 3, 2, 3};
    vector<int> t3 = {7, 7, 7, 7, 7};
    vector<int> t4 = {1};
    vector<int> t5 = {};

    cout << sol.longestIncreasingSubsequence(t1) << " ";
    cout << sol.longestIncreasingSubsequence(t2) << " ";
    cout << sol.longestIncreasingSubsequence(t3) << " ";
    cout << sol.longestIncreasingSubsequence(t4) << " ";
    cout << sol.longestIncreasingSubsequence(t5) << endl;
    return 0;
}`;

    const res = await request(app)
      .post(`/api/v1/rooms/${interviewRoomId}/execute`)
      .set('X-Interview-Token', candidateToken)
      .send({ language: 'cpp', code: lisCppProgram });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exitCode).toBe(0);
    expect(res.body.data.stdout.trim()).toBe('4 4 1 1 0');
  }, 30000);

  it('27. Security: Unauthenticated request to room-interview-* prefix without signed token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/room-interview-unauth/execute')
      .send({ language: 'python', code: 'print(1)' });

    expect(res.status).toBe(401);
  });

  it('28. Security: Forged X-Interview-Token header is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/room-interview-forged/execute')
      .set('X-Interview-Token', 'cs_inv_forged_raw_string')
      .send({ language: 'python', code: 'print(1)' });

    expect(res.status).toBe(401);
  });

  it('29. Security: Signed candidate token bound to another room is rejected with 403 FORBIDDEN', async () => {
    const wrongRoomToken = signCandidateInterviewToken('cs_inv_wrong', 'room-interview-other');
    const res = await request(app)
      .post(`/api/v1/rooms/${testRoomId}/execute`)
      .set('X-Interview-Token', wrongRoomToken)
      .send({ language: 'python', code: 'print(1)' });

    expect(res.status).toBe(403);
  });
});
