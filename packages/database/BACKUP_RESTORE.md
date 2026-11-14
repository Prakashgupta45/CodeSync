# CodeSync AI — PostgreSQL Migration & Backup Runbook

## 1. Prisma Migrations (Production & CI)

All schema changes must go through versioned migrations under `packages/database/prisma/migrations/`.

- Check migration status:
  ```bash
  npm run db:migrate:status --workspace=packages/database
  ```
- Apply pending migrations non-destructively in production:
  ```bash
  npm run db:migrate:deploy --workspace=packages/database
  ```
- Never run `prisma migrate reset` or `prisma db push --force-reset` against production databases.

## 2. Backup

Run a point-in-time logical SQL dump (`pg_dump`):

```bash
node packages/database/scripts/backup-db.mjs [optional-output-path.sql]
```

By default backups are written to `<os-tmpdir>/codesync-pg-backups/` (override via `BACKUP_DIR`).

## 3. Isolated Restore Verification

Verify that any `.sql` backup file restores cleanly into a disposable verification database (`codesync_backup_verify`) without touching `codesync_db`:

```bash
node packages/database/scripts/verify-restore.mjs <path-to-backup.sql>
```

## 4. Production Recommendations

- Store backups off-host in encrypted object storage with retention policies.
- Enable TLS (`?sslmode=verify-full`) on `DATABASE_URL` in production.
- Bind development Docker PostgreSQL and Redis ports strictly to `127.0.0.1` (configured in `docker-compose.yml`).
