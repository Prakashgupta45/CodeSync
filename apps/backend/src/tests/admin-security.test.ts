import request from 'supertest';
import app from '../app';
import { prisma } from '@codesync/database';

describe('Admin Panel Backend Security & Authorization Test Suite', () => {
  const adminUser = {
    email: 'test_admin_auth@codesync.ai',
    password: 'AdminPassword123!',
    name: 'Platform Admin',
  };

  const normalUser = {
    email: 'test_normal_user@codesync.ai',
    password: 'UserPassword123!',
    name: 'Normal User',
  };

  let adminCookies: string[];
  let normalUserCookies: string[];
  let testRoomId: string;
  let testInterviewId: string;

  beforeAll(async () => {
    // Clean up any existing test records
    await prisma.auditLog.deleteMany({
      where: { actorEmail: { in: [adminUser.email, normalUser.email] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [adminUser.email, normalUser.email] } },
    });

    // 1. Register Admin User
    await request(app).post('/api/v1/auth/register').send(adminUser);
    // Elevate to ADMIN in database
    await prisma.user.update({
      where: { email: adminUser.email },
      data: { role: 'ADMIN', status: 'ACTIVE' },
    });

    // 2. Register Normal User (role: USER)
    await request(app).post('/api/v1/auth/register').send(normalUser);

    // 3. Log in as Admin to obtain HttpOnly auth cookies
    const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: adminUser.email,
      password: adminUser.password,
    });
    adminCookies = adminLoginRes.headers['set-cookie'] as any;

    // 4. Log in as Normal User to obtain auth cookies
    const userLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: normalUser.email,
      password: normalUser.password,
    });
    normalUserCookies = userLoginRes.headers['set-cookie'] as any;

    // 5. Create test room and interview for administration testing
    const adminRecord = await prisma.user.findUnique({ where: { email: adminUser.email } });
    const userRecord = await prisma.user.findUnique({ where: { email: normalUser.email } });

    testRoomId = `admin-test-room-${Date.now()}`;
    await prisma.room.create({
      data: {
        id: testRoomId,
        name: 'Admin Test Room',
        language: 'typescript',
        status: 'ACTIVE',
        ownerId: adminRecord!.id,
      },
    });

    testInterviewId = `admin-test-interview-${Date.now()}`;
    await prisma.interview.create({
      data: {
        id: testInterviewId,
        roomId: testRoomId,
        ownerId: adminRecord!.id,
        candidateName: 'Jane Candidate',
        candidateEmail: 'jane@example.com',
        title: 'Senior Frontend Assessment',
        jobRole: 'Frontend Engineer',
        status: 'READY',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.interview.deleteMany({ where: { id: testInterviewId } });
    await prisma.room.deleteMany({ where: { id: testRoomId } });
    await prisma.auditLog.deleteMany({
      where: { actorEmail: { in: [adminUser.email, normalUser.email] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [adminUser.email, normalUser.email] } },
    });
  });

  // --------------------------------------------------------------------------
  // 1. Strict Server-Side Authorization Enforcement
  // --------------------------------------------------------------------------
  describe('1. Server-Side ADMIN Authorization Enforcement', () => {
    it('denies unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('denies authenticated non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Cookie', normalUserCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message).toMatch(/Administrator privileges required/i);
    });

    it('denies non-admin users from accessing user management with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Cookie', normalUserCookies);

      expect(res.status).toBe(403);
    });

    it('denies non-admin users from accessing audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Cookie', normalUserCookies);

      expect(res.status).toBe(403);
    });

    it('allows authenticated ADMIN users to access overview stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('interviews');
      expect(res.body.data).toHaveProperty('rooms');
      expect(res.body.data).toHaveProperty('ai');
    });

    it('allows authenticated ADMIN users to access system health diagnostics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system-health')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('database');
      expect(res.body.data).toHaveProperty('docker');
      expect(res.body.data).toHaveProperty('system');
      expect(res.body.data.database.status).toBe('ok');
    });

    it('allows authenticated ADMIN users to access AI usage and execution telemetry', async () => {
      const aiRes = await request(app)
        .get('/api/v1/admin/ai-usage')
        .set('Cookie', adminCookies);
      expect(aiRes.status).toBe(200);
      expect(aiRes.body.data).toHaveProperty('totalRequests');

      const execRes = await request(app)
        .get('/api/v1/admin/executions')
        .set('Cookie', adminCookies);
      expect(execRes.status).toBe(200);
      expect(execRes.body.data).toHaveProperty('supportedLanguages');
      expect(execRes.body.data.supportedLanguages.length).toBe(9);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Interview Management & Safe Deletion
  // --------------------------------------------------------------------------
  describe('2. Interview Management & Safe Deletion Flow', () => {
    it('allows ADMIN to list all interviews platform-wide with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/interviews')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.interviews)).toBe(true);
      expect(res.body.data.pagination).toHaveProperty('total');
    });

    it('denies normal HR users from deleting interviews via admin endpoint (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/interviews/${testInterviewId}`)
        .set('Cookie', normalUserCookies);

      expect(res.status).toBe(403);
    });

    it('safely soft-deletes an interview, records audit log, and preserves relational integrity', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/interviews/${testInterviewId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(true);
      expect(res.body.data.deletedBy).toBeDefined();

      // Verify AuditLog was recorded
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'INTERVIEW_DELETED',
          targetId: testInterviewId,
        },
      });
      expect(log).not.toBeNull();
      expect(log!.actorEmail).toBe(adminUser.email);
    });

    it('allows ADMIN to recover a soft-deleted interview', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/interviews/${testInterviewId}/recover`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(false);

      // Verify AuditLog was recorded
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'INTERVIEW_RECOVERED',
          targetId: testInterviewId,
        },
      });
      expect(log).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. User Management Safety Guardrails
  // --------------------------------------------------------------------------
  describe('3. User Management Safety Guardrails', () => {
    it('prevents an administrator from suspending their own account', async () => {
      const adminRecord = await prisma.user.findUnique({ where: { email: adminUser.email } });
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminRecord!.id}/status`)
        .set('Cookie', adminCookies)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('CANNOT_SUSPEND_SELF');
    });

    it('prevents an administrator from demoting their own account', async () => {
      const adminRecord = await prisma.user.findUnique({ where: { email: adminUser.email } });
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminRecord!.id}/role`)
        .set('Cookie', adminCookies)
        .send({ role: 'USER' });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('CANNOT_DEMOTE_SELF');
    });

    it('allows suspending and reactivating a normal user account', async () => {
      const userRecord = await prisma.user.findUnique({ where: { email: normalUser.email } });

      // Suspend
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${userRecord!.id}/status`)
        .set('Cookie', adminCookies)
        .send({ status: 'SUSPENDED' });

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.status).toBe('SUSPENDED');

      // Verify suspended user cannot log in
      const failLogin = await request(app).post('/api/v1/auth/login').send({
        email: normalUser.email,
        password: normalUser.password,
      });
      expect(failLogin.status).toBe(403);
      expect(failLogin.body.error?.code).toBe('ACCOUNT_SUSPENDED');

      // Reactivate
      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/users/${userRecord!.id}/status`)
        .set('Cookie', adminCookies)
        .send({ status: 'ACTIVE' });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.status).toBe('ACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Coding Room Management
  // --------------------------------------------------------------------------
  describe('4. Coding Room Management', () => {
    it('allows ADMIN to list coding rooms and administratively terminate a room', async () => {
      const listRes = await request(app)
        .get('/api/v1/admin/rooms')
        .set('Cookie', adminCookies);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data.rooms)).toBe(true);

      const terminateRes = await request(app)
        .delete(`/api/v1/admin/rooms/${testRoomId}`)
        .set('Cookie', adminCookies);

      expect(terminateRes.status).toBe(200);
      expect(terminateRes.body.data.status).toBe('CLOSED');

      // Verify AuditLog was recorded
      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'ROOM_TERMINATED',
          targetId: testRoomId,
        },
      });
      expect(log).not.toBeNull();
    });
  });
});
