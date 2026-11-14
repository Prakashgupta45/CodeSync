import request from 'supertest';
import app from '../app';
import { validateEnv } from '../config/env';
import { redactSensitive } from '../utils/logger';
import { AppError, errorHandler } from '../middleware/error.middleware';

describe('Phase 13 — Security Hardening Verification', () => {
  describe('Environment validation (validateEnv)', () => {
    const validProdEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a9d8f7e6c5b4a39281706f5e4d3c2b1a_prod_access_key_991',
      JWT_REFRESH_SECRET: 'f1e2d3c4b5a69788796a5b4c3d2e1f00_prod_refresh_key_882',
      DATABASE_URL: 'postgresql://codesync_prod:StrongPass123!@db.internal:5432/codesync',
    };

    it('accepts strong distinct production secrets and non-default DATABASE_URL', () => {
      const parsed = validateEnv(validProdEnv);
      expect(parsed.NODE_ENV).toBe('production');
      expect(parsed.COOKIE_SECURE).toBe(true);
      expect(parsed.INTERVIEW_SIGNING_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it('throws in production when JWT_ACCESS_SECRET is missing or placeholder', () => {
      expect(() =>
        validateEnv({ ...validProdEnv, JWT_ACCESS_SECRET: undefined })
      ).toThrow(/JWT_ACCESS_SECRET/);
      expect(() =>
        validateEnv({
          ...validProdEnv,
          JWT_ACCESS_SECRET: 'dev_access_secret_change_in_production_123456789',
        })
      ).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('throws in production when JWT_REFRESH_SECRET matches JWT_ACCESS_SECRET', () => {
      expect(() =>
        validateEnv({
          ...validProdEnv,
          JWT_REFRESH_SECRET: validProdEnv.JWT_ACCESS_SECRET,
        })
      ).toThrow(/distinct/);
    });

    it('throws in production when DATABASE_URL uses default localhost credentials', () => {
      expect(() =>
        validateEnv({
          ...validProdEnv,
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/codesync_db',
        })
      ).toThrow(/DATABASE_URL/);
    });
  });

  describe('Logger sensitive-data redaction', () => {
    it('redacts sensitive keys and embedded Bearer/JWT tokens', () => {
      const sanitized = redactSensitive({
        password: 'MySecretPassword!',
        refreshToken: 'abc',
        authorization: 'Bearer header.payload.signature',
        nested: {
          cookie: 'access_token=xyz',
          note: 'Received Bearer someToken123 and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig',
        },
      }) as Record<string, any>;

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.cookie).toBe('[REDACTED]');
      expect(sanitized.nested.note).toContain('Bearer [REDACTED]');
      expect(sanitized.nested.note).toContain('[REDACTED_JWT]');
      expect(sanitized.nested.note).not.toContain('someToken123');
    });
  });

  describe('Production error masking', () => {
    it('masks internal error details when NODE_ENV is production', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const json = jest.fn();
        const status = jest.fn(() => ({ json }));
        const res = { status } as any;
        const req = { method: 'GET', originalUrl: '/test', requestId: 'req-1' } as any;

        errorHandler(new Error('SELECT * FROM users leaked SQL'), req, res, jest.fn());
        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected internal error occurred',
          },
        });

        json.mockClear();
        status.mockClear();
        errorHandler(new AppError('Validation failed', 400, 'BAD_REQUEST', { field: 'x' }), req, res, jest.fn());
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Validation failed',
            details: { field: 'x' },
          },
        });
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('Health, readiness, and request correlation', () => {
    it('GET /health returns request-id and database status', async () => {
      const res = await request(app).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.body.database).toBe('up');
    });

    it('GET /ready returns readiness status', async () => {
      const res = await request(app).get('/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
    });

    it('rejects removed unscoped /api/v1/execution and /api/v1/ai mounts with 404', async () => {
      const execRes = await request(app).post('/api/v1/execution/execute').send({});
      const aiRes = await request(app).post('/api/v1/ai/prompt').send({});
      expect(execRes.status).toBe(404);
      expect(aiRes.status).toBe(404);
    });
  });
});
