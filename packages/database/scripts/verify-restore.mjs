#!/usr/bin/env node
import { execFileSync } from 'child_process';
import fs from 'fs';

const containerName = process.env.PG_CONTAINER_NAME || 'codesync-postgres';
const pgUser = process.env.PGUSER || 'postgres';
const tempDb = 'codesync_backup_verify';
const backupFile = process.argv[2];

if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('Usage: node verify-restore.mjs <path-to-backup.sql>');
  process.exit(1);
}

const sqlContent = fs.readFileSync(backupFile);

const runPsql = (dbName, sql) =>
  execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', pgUser, '-d', dbName],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

try {
  console.log(`Creating isolated verification database "${tempDb}"...`);
  runPsql('postgres', `DROP DATABASE IF EXISTS ${tempDb};`);
  runPsql('postgres', `CREATE DATABASE ${tempDb};`);

  console.log(`Restoring backup (${sqlContent.length} bytes) into "${tempDb}"...`);
  execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', pgUser, '-d', tempDb],
    { input: sqlContent, maxBuffer: 64 * 1024 * 1024 }
  );

  const counts = runPsql(
    tempDb,
    `SELECT
      (SELECT COUNT(*) FROM "_prisma_migrations") AS migrations_count,
      (SELECT COUNT(*) FROM "users") AS users_count,
      (SELECT COUNT(*) FROM "rooms") AS rooms_count;`
  );
  console.log('Restore verification counts:\n' + counts.trim());
} finally {
  console.log(`Cleaning up temporary database "${tempDb}"...`);
  runPsql('postgres', `DROP DATABASE IF EXISTS ${tempDb};`);
}
