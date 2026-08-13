# CodeSync AI

AI-Powered Real-Time Pair Programming and Coding Interview Platform.

## Architecture

This repository is organized as a monorepo containing:
- `apps/frontend`: Next.js App Router UI with Tailwind CSS & shadcn components
- `apps/backend`: Express.js + TypeScript authentication & business API
- `packages/database`: Prisma ORM schema & client for PostgreSQL
- `packages/shared`: Shared TypeScript types, API contracts, and Zod schemas

## Phase 1 Setup

1. Start database and cache services:
   ```bash
   docker compose up -d
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run database migrations:
   ```bash
   npm --workspace=packages/database run db:migrate
   ```

4. Run tests:
   ```bash
   npm run test
   ```
