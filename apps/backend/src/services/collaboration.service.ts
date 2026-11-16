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
    const lang = (language || '').toLowerCase().trim();

    switch (lang) {
      case 'c':
        return `// CodeSync AI - ${roomName || 'C Workspace'}
#include <stdio.h>

int main() {
    printf("Hello, CodeSync AI!\\n");
    return 0;
}
`;
      case 'cpp':
      case 'c++':
        return `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    // Write your solution here
};
`;
      case 'java':
        return `// CodeSync AI - ${roomName || 'Java Workspace'}
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CodeSync AI!");
    }
}
`;
      case 'python':
      case 'py':
        return `# CodeSync AI - ${roomName || 'Python Workspace'}

def main():
    print("Hello, CodeSync AI!")

if __name__ == "__main__":
    main()
`;
      case 'typescript':
      case 'ts':
        return `// CodeSync AI - ${roomName || 'TypeScript Workspace'}
function greeting(name: string): string {
    return \`Hello, \${name}!\`;
}

console.log(greeting("CodeSync AI"));
`;
      case 'go':
      case 'golang':
        return `// CodeSync AI - ${roomName || 'Go Workspace'}
package main

import "fmt"

func main() {
    fmt.Println("Hello, CodeSync AI!")
}
`;
      case 'rust':
      case 'rs':
        return `// CodeSync AI - ${roomName || 'Rust Workspace'}
fn main() {
    println!("Hello, CodeSync AI!");
}
`;
      case 'csharp':
      case 'c#':
      case 'cs':
        return `// CodeSync AI - ${roomName || 'C# Workspace'}
using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, CodeSync AI!");
    }
}
`;
      case 'javascript':
      case 'js':
      default:
        return `// CodeSync AI - ${roomName || 'JavaScript Workspace'}
function main() {
    console.log("Hello, CodeSync AI!");
}

main();
`;
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
      const isInterviewRoom = roomId.startsWith('room-interview-');
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      const starterCode = isInterviewRoom ? '' : this.getDefaultStarterCode(language, room?.name);
      if (starterCode) {
        yText.insert(0, starterCode);
      }

      // Only attempt DB persistence if room actually exists in database
      if (room) {
        try {
          const update = Y.encodeStateAsUpdate(doc);
          await prisma.roomDocument.upsert({
            where: { roomId },
            create: {
              roomId,
              content: starterCode,
              state: Buffer.from(update),
            },
            update: {},
          });
        } catch (_) {}
      }
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
    } catch (err: any) {
      if (err?.code === 'P2003' || err?.message?.includes('Foreign key constraint')) {
        // Room was deleted concurrently during test teardown
        return;
      }
      console.error(`Failed to save room document for room ${roomId}:`, err);
    }
  }

  public async flushAllDocuments(): Promise<void> {
    const promises: Promise<any>[] = [];
    for (const [roomId] of this.sessions.entries()) {
      promises.push(this.saveRoomDocument(roomId));
    }
    await Promise.all(promises);
  }
}

export const collaborationService = new CollaborationService();
