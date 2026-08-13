import request from 'supertest';
import app from '../app';
import { prisma } from '@codesync/database';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../utils/cookie';

describe('Coding Rooms Domain & Authorization Security Suite', () => {
  const userOwner = {
    email: 'room_owner@example.com',
    password: 'Password123!',
    name: 'Room Owner',
  };

  const userParticipant = {
    email: 'room_participant@example.com',
    password: 'Password123!',
    name: 'Room Participant',
  };

  const userNonMember = {
    email: 'non_member@example.com',
    password: 'Password123!',
    name: 'Non Member',
  };

  let ownerCookie: string[];
  let ownerUserId: string;

  let participantCookie: string[];
  let participantUserId: string;

  let nonMemberCookie: string[];
  let nonMemberUserId: string;

  beforeEach(async () => {
    // Clean database before each test suite execution
    await prisma.roomMember.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [userOwner.email, userParticipant.email, userNonMember.email],
        },
      },
    });

    // 1. Register Owner
    const regOwner = await request(app).post('/api/v1/auth/register').send(userOwner);
    ownerCookie = regOwner.headers['set-cookie'] as unknown as string[];
    ownerUserId = regOwner.body.data.user.id;

    // 2. Register Participant
    const regPart = await request(app).post('/api/v1/auth/register').send(userParticipant);
    participantCookie = regPart.headers['set-cookie'] as unknown as string[];
    participantUserId = regPart.body.data.user.id;

    // 3. Register Non-Member
    const regNon = await request(app).post('/api/v1/auth/register').send(userNonMember);
    nonMemberCookie = regNon.headers['set-cookie'] as unknown as string[];
    nonMemberUserId = regNon.body.data.user.id;
  });

  it('1. Authenticated user can create room', async () => {
    const res = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'System Design Room', language: 'javascript' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('System Design Room');
    expect(res.body.data.language).toBe('javascript');
    expect(res.body.data.ownerId).toBe(ownerUserId);
  });

  it('2. Unauthenticated user cannot create room', async () => {
    const res = await request(app)
      .post('/api/v1/rooms')
      .send({ name: 'Unauthorized Room', language: 'python' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('3. Creator automatically becomes OWNER', async () => {
    const res = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Owner Test Room', language: 'python' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('OWNER');

    const membersRes = await request(app)
      .get(`/api/v1/rooms/${res.body.data.id}/members`)
      .set('Cookie', ownerCookie);

    expect(membersRes.status).toBe(200);
    expect(membersRes.body.data[0].role).toBe('OWNER');
    expect(membersRes.body.data[0].userId).toBe(ownerUserId);
  });

  it('4. User can list their rooms', async () => {
    await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Room Alpha', language: 'cpp' });

    const listRes = await request(app).get('/api/v1/rooms').set('Cookie', ownerCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].name).toBe('Room Alpha');
  });

  it('5. User can join active room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Pairing Room', language: 'java' });

    const roomId = createRes.body.data.id;

    const joinRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Cookie', participantCookie);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
    expect(joinRes.body.data.memberCount).toBe(2);
    expect(joinRes.body.data.role).toBe('PARTICIPANT');
  });

  it('6. Duplicate join does not create duplicate membership', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Single Join Room', language: 'python' });

    const roomId = createRes.body.data.id;

    await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', participantCookie);
    const secondJoin = await request(app)
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Cookie', participantCookie);

    expect(secondJoin.status).toBe(200);

    const membersCount = await prisma.roomMember.count({
      where: { roomId, userId: participantUserId },
    });
    expect(membersCount).toBe(1);
  });

  it('7. Member can view room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Private Workspace', language: 'javascript' });

    const roomId = createRes.body.data.id;

    const res = await request(app).get(`/api/v1/rooms/${roomId}`).set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Private Workspace');
  });

  it('8. Non-member cannot view private room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Strict Room', language: 'cpp' });

    const roomId = createRes.body.data.id;

    const res = await request(app).get(`/api/v1/rooms/${roomId}`).set('Cookie', nonMemberCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('9. Participant can leave room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Leave Room Test', language: 'python' });

    const roomId = createRes.body.data.id;

    await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', participantCookie);

    const leaveRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/leave`)
      .set('Cookie', participantCookie);

    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.success).toBe(true);
  });

  it('10. Viewer can leave room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Viewer Room', language: 'javascript' });

    const roomId = createRes.body.data.id;

    await prisma.roomMember.create({
      data: { roomId, userId: participantUserId, role: 'VIEWER' },
    });

    const leaveRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/leave`)
      .set('Cookie', participantCookie);

    expect(leaveRes.status).toBe(200);
  });

  it('11. Owner cannot leave room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Owner Lock Room', language: 'java' });

    const roomId = createRes.body.data.id;

    const leaveRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/leave`)
      .set('Cookie', ownerCookie);

    expect(leaveRes.status).toBe(400);
    expect(leaveRes.body.error.code).toBe('OWNER_CANNOT_LEAVE');
  });

  it('12. Owner can delete room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'To Delete', language: 'python' });

    const roomId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/rooms/${roomId}`)
      .set('Cookie', ownerCookie);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  it('13. Participant cannot delete room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Protected Room', language: 'javascript' });

    const roomId = createRes.body.data.id;
    await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', participantCookie);

    const deleteRes = await request(app)
      .delete(`/api/v1/rooms/${roomId}`)
      .set('Cookie', participantCookie);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe('FORBIDDEN');
  });

  it('14. Viewer cannot delete room', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Viewer Protect', language: 'cpp' });

    const roomId = createRes.body.data.id;
    await prisma.roomMember.create({
      data: { roomId, userId: participantUserId, role: 'VIEWER' },
    });

    const deleteRes = await request(app)
      .delete(`/api/v1/rooms/${roomId}`)
      .set('Cookie', participantCookie);

    expect(deleteRes.status).toBe(403);
  });

  it('15. Closed room cannot be joined', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Closed Session', language: 'java' });

    const roomId = createRes.body.data.id;
    await prisma.room.update({ where: { id: roomId }, data: { status: 'CLOSED' } });

    const joinRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Cookie', participantCookie);

    expect(joinRes.status).toBe(400);
    expect(joinRes.body.error.code).toBe('ROOM_CLOSED');
  });

  it('16. Invalid room ID returns 404', async () => {
    const res = await request(app)
      .get('/api/v1/rooms/00000000-0000-0000-0000-000000000000')
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('17. Owner can view members', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Team Room', language: 'javascript' });

    const roomId = createRes.body.data.id;

    const membersRes = await request(app)
      .get(`/api/v1/rooms/${roomId}/members`)
      .set('Cookie', ownerCookie);

    expect(membersRes.status).toBe(200);
    expect(membersRes.body.data.length).toBe(1);
    expect(membersRes.body.data[0].user.passwordHash).toBeUndefined();
  });

  it('18. Participant cannot remove members', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Remove Member Test', language: 'python' });

    const roomId = createRes.body.data.id;
    await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', participantCookie);

    const removeRes = await request(app)
      .delete(`/api/v1/rooms/${roomId}/members/${ownerUserId}`)
      .set('Cookie', participantCookie);

    expect(removeRes.status).toBe(403);
  });

  it('19. Owner can remove participant', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Kick Test', language: 'cpp' });

    const roomId = createRes.body.data.id;
    await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', participantCookie);

    const removeRes = await request(app)
      .delete(`/api/v1/rooms/${roomId}/members/${participantUserId}`)
      .set('Cookie', ownerCookie);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.success).toBe(true);
  });

  it('20. Owner cannot remove themselves', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Self Kick Test', language: 'java' });

    const roomId = createRes.body.data.id;

    const removeRes = await request(app)
      .delete(`/api/v1/rooms/${roomId}/members/${ownerUserId}`)
      .set('Cookie', ownerCookie);

    expect(removeRes.status).toBe(400);
    expect(removeRes.body.error.code).toBe('CANNOT_REMOVE_SELF');
  });

  it('21. Deleted room cannot be accessed', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Ghost Room', language: 'python' });

    const roomId = createRes.body.data.id;

    await request(app).delete(`/api/v1/rooms/${roomId}`).set('Cookie', ownerCookie);

    const getRes = await request(app).get(`/api/v1/rooms/${roomId}`).set('Cookie', ownerCookie);

    expect(getRes.status).toBe(404);
  });

  it('22. Room deletion removes memberships correctly', async () => {
    const createRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', ownerCookie)
      .send({ name: 'Cascade Room', language: 'javascript' });

    const roomId = createRes.body.data.id;
    await request(app).post(`/api/v1/rooms/${roomId}/join`).set('Cookie', participantCookie);

    await request(app).delete(`/api/v1/rooms/${roomId}`).set('Cookie', ownerCookie);

    const memberCount = await prisma.roomMember.count({ where: { roomId } });
    expect(memberCount).toBe(0);
  });
});
