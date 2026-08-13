import * as Y from 'yjs';
import { prisma } from '@codesync/database';

interface RoomSession {
  doc: Y.Doc;
  clientsCount: number;
  saveTimeout?: NodeJS.Timeout;
}

export class CollaborationService {
  private sessions = new Map<string, RoomSession>();

  public clearSessions() {
    for (const session of this.sessions.values()) {
      if (session.saveTimeout) {
        clearTimeout(session.saveTimeout);
      }
    }
    this.sessions.clear();
  }

  private getDefaultStarterCode(language: string, roomName?: string): string {
    const lang = (language || '').toLowerCase();

    switch (lang) {
      case 'python':
        return `# CodeSync AI - ${roomName || 'Python Workspace'}\n\ndef main():\n    print("Hello, CodeSync AI!")\n\nif __name__ == "__main__":\n    main()\n`;
      case 'cpp':
        return `// CodeSync AI - ${roomName || 'C++ Workspace'}\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, CodeSync AI!" << std::endl;\n    return 0;\n}\n`;
      case 'java':
        return `// CodeSync AI - ${roomName || 'Java Workspace'}\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodeSync AI!");\n    }\n}\n`;
      case 'typescript':
        return `// CodeSync AI - ${roomName || 'TypeScript Workspace'}\nfunction greeting(name: string): string {\n    return \`Hello, \${name}!\`;\n}\n\nconsole.log(greeting("CodeSync AI"));\n`;
      case 'javascript':
      default:
        return `// CodeSync AI - ${roomName || 'JavaScript Workspace'}\nfunction main() {\n    console.log("Hello, CodeSync AI!");\n}\n\nmain();\n`;
    }
  }

  public async getOrCreateDoc(roomId: string, language: string): Promise<Y.Doc> {
    const existing = this.sessions.get(roomId);
    if (existing) {
      existing.clientsCount += 1;
      return existing.doc;
    }

    const doc = new Y.Doc();
    const yText = doc.getText('codemirror');

    // 1. Query database for existing room document
    const savedDoc = await prisma.roomDocument.findUnique({
      where: { roomId },
    });

    if (savedDoc) {
      if (savedDoc.state && savedDoc.state.length > 0) {
        Y.applyUpdate(doc, new Uint8Array(savedDoc.state));
      } else if (savedDoc.content) {
        yText.insert(0, savedDoc.content);
      }
    } else {
      // 2. Initialize default template if no saved document exists
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      const starterCode = this.getDefaultStarterCode(language, room?.name);
      yText.insert(0, starterCode);

      // Create initial DB record
      const update = Y.encodeStateAsUpdate(doc);
      await prisma.roomDocument.create({
        data: {
          roomId,
          content: starterCode,
          state: Buffer.from(update),
        },
      });
    }

    // 3. Register document update listener for debounced autosave
    doc.on('update', () => {
      this.scheduleSave(roomId);
    });

    this.sessions.set(roomId, {
      doc,
      clientsCount: 1,
    });

    return doc;
  }

  public getDoc(roomId: string): Y.Doc | undefined {
    return this.sessions.get(roomId)?.doc;
  }

  public applyUpdate(roomId: string, update: Uint8Array) {
    const session = this.sessions.get(roomId);
    if (session) {
      Y.applyUpdate(session.doc, update);
    }
  }

  public decrementClientCount(roomId: string) {
    const session = this.sessions.get(roomId);
    if (session) {
      session.clientsCount = Math.max(0, session.clientsCount - 1);
      if (session.clientsCount === 0) {
        // Save immediately when room becomes empty
        this.saveRoomDocument(roomId);
      }
    }
  }

  private scheduleSave(roomId: string) {
    const session = this.sessions.get(roomId);
    if (!session) return;

    if (session.saveTimeout) {
      clearTimeout(session.saveTimeout);
    }

    session.saveTimeout = setTimeout(() => {
      this.saveRoomDocument(roomId);
    }, 1500);
  }

  public async saveRoomDocument(roomId: string) {
    const session = this.sessions.get(roomId);
    if (!session) return;

    try {
      // Verify room exists in database before saving
      const roomExists = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true },
      });

      if (!roomExists) {
        if (session.saveTimeout) clearTimeout(session.saveTimeout);
        this.sessions.delete(roomId);
        return;
      }

      const update = Y.encodeStateAsUpdate(session.doc);
      const textContent = session.doc.getText('codemirror').toString();

      await prisma.roomDocument.upsert({
        where: { roomId },
        update: {
          content: textContent,
          state: Buffer.from(update),
          version: { increment: 1 },
        },
        create: {
          roomId,
          content: textContent,
          state: Buffer.from(update),
        },
      });
    } catch (err) {
      console.error(`Failed to save room document for room ${roomId}:`, err);
    }
  }
}

export const collaborationService = new CollaborationService();
