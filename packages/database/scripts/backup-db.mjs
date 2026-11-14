#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const containerName = process.env.PG_CONTAINER_NAME || 'codesync-postgres';
const pgUser = process.env.PGUSER || 'postgres';
const pgDb = process.env.PGDATABASE || 'codesync_db';
const outDir =
  process.env.BACKUP_DIR || path.join(os.tmpdir(), 'codesync-pg-backups');

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(outDir, `${pgDb}-${stamp}.sql`);

console.log(`Creating non-destructive backup of "${pgDb}" from container "${containerName}"...`);
const sqlDump = execFileSync(
  'docker',
  ['exec', containerName, 'pg_dump', '-U', pgUser, '-d', pgDb, '--no-owner', '--no-privileges'],
  { maxBuffer: 64 * 1024 * 1024 }
);

fs.writeFileSync(outFile, sqlDump);
const sizeBytes = fs.statSync(outFile).size;
console.log(`Backup written: ${outFile} (${sizeBytes} bytes)`);
