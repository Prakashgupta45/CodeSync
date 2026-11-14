import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { prisma } from '@codesync/database';
import { ENV } from './config/env';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import interviewRoutes from './routes/interview.routes';
import adminRoutes from './routes/admin.routes';
import { errorHandler } from './middleware/error.middleware';
import { dockerRunnerService } from './services/docker-runner.service';
import { logger } from './utils/logger';

const app: Express = express();

if (ENV.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security Headers
app.use(helmet());

// Request correlation & redacted structured audit logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqIdHeader = req.headers['x-request-id'];
  const requestId =
    typeof reqIdHeader === 'string' && reqIdHeader.trim().length > 0
      ? reqIdHeader.trim().slice(0, 64)
      : randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 500 || req.path === '/health' || req.path === '/ready') {
      return;
    }
    logger.info('HTTP request completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  const configured = (ENV.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (configured.includes(normalizedOrigin)) {
    return true;
  }
  if (ENV.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
      return true;
    }
  }
  return false;
};

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Interview-Token'],
  })
);

// Body Parsers & Cookie Parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Liveness Probe (fast health + dependency summary)
app.get('/health', async (_req: Request, res: Response) => {
  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const dockerAvailable = await dockerRunnerService.verifyDockerAvailable();
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: dbHealthy ? 'ok' : 'degraded',
    database: dbHealthy ? 'up' : 'down',
    docker: dockerAvailable ? 'up' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// Strict Dependency Readiness Probe (PostgreSQL + Docker)
app.get('/ready', async (_req: Request, res: Response) => {
  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const dockerAvailable = await dockerRunnerService.verifyDockerAvailable();
  const ready = dbHealthy && dockerAvailable;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database: dbHealthy ? 'up' : 'down',
    docker: dockerAvailable ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

// API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/admin', adminRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
