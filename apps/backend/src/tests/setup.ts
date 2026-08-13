import { prisma } from '@codesync/database';

beforeAll(async () => {
  // Ensure process.env.NODE_ENV is set to test
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await prisma.$disconnect();
});
