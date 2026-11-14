import http from 'http';
import { Server } from 'socket.io';
import { prisma } from '@codesync/database';
import app, { isAllowedOrigin } from './app';
import { ENV } from './config/env';
import { setupCollaborationSockets } from './socket/collaboration.socket';
import { collaborationService } from './services/collaboration.service';
import { logger } from './utils/logger';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

setupCollaborationSockets(io);

server.listen(ENV.PORT, () => {
  console.log(`🚀 [CodeSync Backend] Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`);
  console.log(`⚡ [Socket.IO] Real-Time Collaboration engine initialized`);
  logger.info('LLM provider configuration status', {
    geminiConfigured: ENV.GEMINI_CONFIGURED,
    geminiModel: ENV.GEMINI_MODEL,
    llmTimeoutMs: ENV.LLM_TIMEOUT_MS,
  });
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info('Shutdown signal received', { signal });

  try {
    await collaborationService.flushAllDocuments();
  } catch (err) {
    logger.error('Failed to flush Yjs room documents during shutdown', { err });
  }

  try {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
  } catch {
    // ignore socket close race
  }

  try {
    await new Promise<void>((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
    });
  } catch {
    // ignore http close race
  }

  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error('Failed to disconnect Prisma during shutdown', { err });
  }
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

export { server, io };
