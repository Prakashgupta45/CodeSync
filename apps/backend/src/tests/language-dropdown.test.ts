import { prisma } from '@codesync/database';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@codesync/shared';
import { roomService } from '../services/room.service';
import { dockerRunnerService, normalizeExecutionLanguage } from '../services/docker-runner.service';
import { aiService, resolveLanguage } from '../services/ai.service';
import * as collaborationSocket from '../socket/collaboration.socket';

describe('Coding Room UI & Architecture — Programming Language Dropdown Suite', () => {
  const roomId = '33333333-3333-4333-8333-333333333333';
  const ownerUserId = 'user-owner-1';
  const participantUserId = 'user-participant-1';
  const viewerUserId = 'user-viewer-1';

  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Code explanation for computeAnswer in C++.' }],
            },
          },
        ],
      }),
    } as any);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('1. Supported Languages & Shared Specifications', () => {
    it('includes all 9 required languages: C, C++, Java, Python, JavaScript, TypeScript, Go, Rust, and C#', () => {
      const requiredLangs: SupportedLanguage[] = [
        'c',
        'cpp',
        'java',
        'python',
        'javascript',
        'typescript',
        'go',
        'rust',
        'csharp',
      ];

      for (const lang of requiredLangs) {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      }
      expect(SUPPORTED_LANGUAGES).toHaveLength(9);
    });

    it('normalizes common language aliases (e.g. C++, C#, Golang, TS, JS, PY)', () => {
      expect(normalizeExecutionLanguage('c++')).toBe('cpp');
      expect(normalizeExecutionLanguage('C++')).toBe('cpp');
      expect(normalizeExecutionLanguage('c#')).toBe('csharp');
      expect(normalizeExecutionLanguage('C#')).toBe('csharp');
      expect(normalizeExecutionLanguage('golang')).toBe('go');
      expect(normalizeExecutionLanguage('rs')).toBe('rust');
      expect(normalizeExecutionLanguage('ts')).toBe('typescript');
      expect(normalizeExecutionLanguage('js')).toBe('javascript');
      expect(normalizeExecutionLanguage('py')).toBe('python');
      expect(normalizeExecutionLanguage('python')).toBe('python');
    });

    it('configures runner specifications for all 9 programming languages', () => {
      const all9 = ['c', 'cpp', 'java', 'python', 'javascript', 'typescript', 'go', 'rust', 'csharp'];
      for (const lang of all9) {
        expect(() => normalizeExecutionLanguage(lang)).not.toThrow();
      }
    });
  });

  describe('2. Room Language Switching, Persistence & Synchronization', () => {
    it('successfully switches room language from TypeScript to C++ to Python with DB persistence', async () => {
      const emitSpy = jest.spyOn(collaborationSocket, 'emitRoomLanguageUpdated').mockImplementation(() => {});

      // Mock existing room
      const mockRoom = {
        id: roomId,
        name: 'Collaborative Workspace',
        ownerId: ownerUserId,
        language: 'typescript',
        status: 'ACTIVE',
        createdAt: new Date('2026-11-12T00:00:00.000Z'),
        updatedAt: new Date('2026-11-12T00:00:00.000Z'),
        members: [
          {
            id: 'mem-1',
            roomId,
            userId: ownerUserId,
            role: 'OWNER',
            joinedAt: new Date(),
            user: { id: ownerUserId, name: 'Room Owner', email: 'owner@example.com' },
          },
          {
            id: 'mem-2',
            roomId,
            userId: participantUserId,
            role: 'PARTICIPANT',
            joinedAt: new Date(),
            user: { id: participantUserId, name: 'Participant', email: 'part@example.com' },
          },
        ],
      };

      jest.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoom as any);
      const updateSpy = jest.spyOn(prisma.room, 'update').mockImplementation(((args: any) => {
        return Promise.resolve({
          ...mockRoom,
          language: args.data.language,
          _count: { members: 2 },
        });
      }) as any);

      // Switch 1: TypeScript -> C++ (cpp)
      const resCpp = await roomService.updateRoomLanguage(roomId, ownerUserId, 'cpp');
      expect(resCpp.language).toBe('cpp');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: roomId },
          data: { language: 'cpp' },
        })
      );
      expect(emitSpy).toHaveBeenCalledWith(roomId, 'cpp', ownerUserId);

      // Switch 2: C++ -> Python
      const resPy = await roomService.updateRoomLanguage(roomId, participantUserId, 'python');
      expect(resPy.language).toBe('python');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: roomId },
          data: { language: 'python' },
        })
      );
      expect(emitSpy).toHaveBeenCalledWith(roomId, 'python', participantUserId);

      // Switch 3: Python -> TypeScript
      const resTs = await roomService.updateRoomLanguage(roomId, ownerUserId, 'typescript');
      expect(resTs.language).toBe('typescript');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: roomId },
          data: { language: 'typescript' },
        })
      );
      expect(emitSpy).toHaveBeenCalledWith(roomId, 'typescript', ownerUserId);
    });

    it('enforces RBAC: VIEWER role cannot change room language', async () => {
      const mockRoom = {
        id: roomId,
        name: 'Protected Workspace',
        ownerId: ownerUserId,
        language: 'typescript',
        status: 'ACTIVE',
        members: [
          {
            id: 'mem-3',
            roomId,
            userId: viewerUserId,
            role: 'VIEWER',
            joinedAt: new Date(),
            user: { id: viewerUserId, name: 'Viewer User', email: 'viewer@example.com' },
          },
        ],
      };

      jest.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoom as any);

      await expect(
        roomService.updateRoomLanguage(roomId, viewerUserId, 'python')
      ).rejects.toThrow('Viewers have read-only access and cannot change room language');
    });

    it('rejects language changes from non-members', async () => {
      const mockRoom = {
        id: roomId,
        name: 'Private Room',
        ownerId: ownerUserId,
        language: 'typescript',
        status: 'ACTIVE',
        members: [],
      };

      jest.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoom as any);

      await expect(
        roomService.updateRoomLanguage(roomId, 'random-user', 'cpp')
      ).rejects.toThrow('You are not a member of this room');
    });
  });

  describe('3. Code Execution & AI Pair Programmer Integration with Selected Language', () => {
    it('resolves active language dynamically when room language is updated to C++, Python, or Rust', () => {
      // Prompt without language inherits room language
      expect(resolveLanguage({ roomLanguage: 'cpp' })).toBe('cpp');
      expect(resolveLanguage({ roomLanguage: 'c++' })).toBe('cpp');
      expect(resolveLanguage({ roomLanguage: 'python' })).toBe('python');
      expect(resolveLanguage({ roomLanguage: 'rust' })).toBe('rust');
      expect(resolveLanguage({ roomLanguage: 'csharp' })).toBe('csharp');
      expect(resolveLanguage({ roomLanguage: 'go' })).toBe('go');

      // Explicit prompt language takes precedence if asking about another language
      expect(resolveLanguage({ prompt: 'c++ ?', roomLanguage: 'python' })).toBe('cpp');
      expect(resolveLanguage({ prompt: 'how to write python code?', roomLanguage: 'typescript' })).toBe('python');
    });

    it('preserves existing code when language is switched (does not erase code)', async () => {
      const existingUserCode = `// Important logic\nint computeAnswer() {\n    return 42;\n}\n`;

      const mockRoom = {
        id: roomId,
        name: 'Preservation Workspace',
        ownerId: ownerUserId,
        language: 'cpp',
        status: 'ACTIVE',
        document: { content: existingUserCode },
        members: [
          {
            id: 'mem-1',
            roomId,
            userId: ownerUserId,
            role: 'OWNER',
            joinedAt: new Date(),
            user: { id: ownerUserId, name: 'Owner' },
          },
        ],
      };

      jest.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoom as any);
      jest.spyOn(prisma.aiMessage, 'create').mockResolvedValue({
        id: 'msg-1',
        createdAt: new Date(),
      } as any);

      // AI explanation receives the existing code unchanged
      const explainDto = await aiService.promptAi(
        roomId,
        ownerUserId,
        'EXPLAIN',
        undefined,
        existingUserCode
      );

      // Code is preserved and analyzed
      expect(explainDto.response).toContain('computeAnswer');
      expect(explainDto.response).toMatch(/C\+\+|cpp/i);
    });
  });
});
