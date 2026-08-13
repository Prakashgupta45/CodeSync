import request from 'supertest';
import app from '../app';
import { prisma } from '@codesync/database';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../utils/cookie';

describe('Authentication API & Security Suite', () => {
  const testUser = {
    email: 'auth_test_user@example.com',
    password: 'Password123!',
    name: 'Test Developer',
  };

  beforeEach(async () => {
    // Clean up test user & tokens before each test
    await prisma.refreshToken.deleteMany({
      where: { user: { email: testUser.email } },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user and set HTTP-only cookies', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Security: Never return password hash!

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes(ACCESS_TOKEN_COOKIE))).toBe(true);
      expect(cookies.some((c: string) => c.includes(REFRESH_TOKEN_COOKIE))).toBe(true);
    });

    it('should reject registration if email already exists (Duplicate Check)', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);

      const res = await request(app).post('/api/v1/auth/register').send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration if password does not meet complexity requirements', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'weakpass@example.com',
        password: '123', // Too short, no uppercase/lowercase/numbers
        name: 'Weak Password User',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should authenticate user with valid credentials and return HTTP-only cookies', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes(ACCESS_TOKEN_COOKIE))).toBe(true);
      expect(cookies.some((c: string) => c.includes(REFRESH_TOKEN_COOKIE))).toBe(true);
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me (Protected Route)', () => {
    it('should allow access when valid access token cookie is provided', async () => {
      const registerRes = await request(app).post('/api/v1/auth/register').send(testUser);
      const cookies = registerRes.headers['set-cookie'];

      const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('should deny access when no auth cookie or header is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Refresh Token Rotation & Reuse Detection Security Suite', () => {
    it('should successfully rotate refresh token and issue new tokens', async () => {
      const loginRes = await request(app).post('/api/v1/auth/register').send(testUser);
      const cookies = loginRes.headers['set-cookie'];

      const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);

      const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
      expect(newCookies).toBeDefined();
      expect(newCookies.some((c: string) => c.includes(ACCESS_TOKEN_COOKIE))).toBe(true);
      expect(newCookies.some((c: string) => c.includes(REFRESH_TOKEN_COOKIE))).toBe(true);
    });

    it('REUSE DETECTION: presenting a previously used/rotated refresh token revokes all user tokens', async () => {
      // 1. Initial registration & obtain first refresh token cookie
      const loginRes = await request(app).post('/api/v1/auth/register').send(testUser);
      const firstCookies = loginRes.headers['set-cookie'];

      // 2. Perform legit refresh (rotates token 1 -> token 2)
      const refreshRes1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookies);
      expect(refreshRes1.status).toBe(200);
      const secondCookies = refreshRes1.headers['set-cookie'];

      // 3. Attacker tries to reuse token 1 (firstCookies)
      const reuseAttackRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookies);

      expect(reuseAttackRes.status).toBe(401);
      expect(reuseAttackRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // 4. Verify all refresh tokens for this user are now revoked in DB
      const user = await prisma.user.findUnique({ where: { email: testUser.email } });
      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: user!.id, isRevoked: false },
      });
      expect(activeTokens.length).toBe(0);

      // 5. Verify even token 2 (secondCookies) is now rejected because of reuse detection lockout
      const subsequentRefreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', secondCookies);
      expect(subsequentRefreshRes.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should revoke user refresh tokens and clear cookies', async () => {
      const loginRes = await request(app).post('/api/v1/auth/register').send(testUser);
      const cookies = loginRes.headers['set-cookie'];

      const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookies);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify user is no longer authorized
      const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', logoutRes.headers['set-cookie']);
      expect(meRes.status).toBe(401);
    });
  });
});
