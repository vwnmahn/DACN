# Authentication Session Migration Plan

Status: prepared for review only. Migration and rollback have not been executed.

## Read-only verification (2026-10-12)

- MySQL 9.6.0; `lower_case_table_names=1`.
- Physical tables are `account` and `refresh_tokens`, using InnoDB and
  `utf8mb4_0900_ai_ci`.
- `account.id` is `BIGINT` primary key/auto increment.
- `refresh_tokens.account_id` is `BIGINT NOT NULL`, indexed and references
  `account.id`; its existing FK uses `NO ACTION` for update/delete.
- `token_hash` is `VARCHAR(64) NOT NULL` and unique; `expires_at` is
  `DATETIME(6) NOT NULL`; `revoked` is `BIT(1) NOT NULL`.
- `auth_sessions` and `refresh_tokens.session_id` do not exist yet.
- Aggregate data: 4 accounts; 2 refresh tokens (1 active, 1 revoked); no expired
  tokens, NULL required fields, orphan account references or duplicate hashes.
- MySQL `UUID()` returned a lowercase 36-character RFC-4122 textual UUID and
  matched the expected format. It is valid in the proposed per-row backfill.

No token/hash value or credential was printed or included in this document.

## Session expiration and rotation

New sessions use both a sliding and absolute limit:

- `expires_at = now + refresh-token TTL` at login.
- `absolute_expires_at = now + configured maximum session lifetime` at login.
- Successful rotation keeps the same session ID and sets
  `expires_at = min(now + refresh-token TTL, absolute_expires_at)`.
- The replacement Refresh Token gets exactly the resulting session expiry.
- Rotation fails when either expiry has passed; `last_activity_at` changes only
  after successful rotation.

Legacy active credentials receive `absolute_expires_at = expires_at`, so the
migration never extends them. Legacy expired/revoked credentials become revoked
sessions with an explicit reason.

## Legacy Access Tokens

Session-aware JWTs must contain `sid`, `jti` and `tokenType=ACCESS`. Existing
JWTs without `sid` must return the standard invalid-token HTTP 401 response and
require login again. A compatibility window is unsafe because it bypasses
durable session revocation.

## Maintenance window and deployment order

This migration requires a short Auth write outage. Old code cannot insert after
`session_id` becomes NOT NULL, while a concurrent login during backfill could
create an unassigned token.

1. Drain traffic and stop every Backend instance, or block all Auth writes.
2. Confirm no application connection is writing authentication tables.
3. Run and record the read-only preflight checks.
4. Create a full backup and SHA-256 hash.
5. Restore it into an approved disposable MySQL server/database and verify table
   counts, metadata, FKs and Hibernate validation.
6. Run `V20261012_6__authentication_sessions.sql` exactly once.
7. Require every reconciliation count in the script to be zero.
8. Deploy session-aware code; never restart old code against the migrated schema.
9. Smoke-test login, refresh rotation, one-session logout and logout-all.
10. Reopen traffic and monitor authentication errors.

## Backup and restore plan

Keep credentials in a restricted MySQL option file, not command history:

```powershell
mysqldump --defaults-extra-file=<secure-client.cnf> `
  --single-transaction --routines --triggers --events --hex-blob `
  --set-gtid-purged=OFF --databases dacn `
  --result-file=<backup-dir>\dacn_pre_auth_sessions.sql

Get-FileHash -Algorithm SHA256 <backup-dir>\dacn_pre_auth_sessions.sql
```

Restore only to an approved disposable server. Because `--databases dacn`
embeds the database name, an isolated server is safest. Validate row counts,
`SHOW CREATE TABLE`, FK/index metadata and application `ddl-auto=validate`.
No backup restore was executed during this review because it would create schema
and data, exceeding the read-only authorization.

## Pre-migration checks

```sql
SELECT COUNT(*) FROM refresh_tokens;
SELECT revoked, COUNT(*) FROM refresh_tokens GROUP BY revoked;
SELECT COUNT(*) FROM refresh_tokens WHERE expires_at <= CURRENT_TIMESTAMP(6);
SELECT COUNT(*) FROM refresh_tokens
 WHERE account_id IS NULL OR token_hash IS NULL
    OR expires_at IS NULL OR revoked IS NULL;
SELECT COUNT(*) FROM refresh_tokens rt
 LEFT JOIN account a ON a.id = rt.account_id WHERE a.id IS NULL;
SELECT COUNT(*) FROM (
 SELECT token_hash FROM refresh_tokens GROUP BY token_hash HAVING COUNT(*) > 1
) duplicates;
```

## Post-migration checks

```sql
SELECT COUNT(*) FROM refresh_tokens WHERE session_id IS NULL;
SELECT COUNT(*) FROM refresh_tokens rt
 LEFT JOIN auth_sessions s ON s.id = rt.session_id WHERE s.id IS NULL;
SELECT COUNT(*) FROM auth_sessions s
 LEFT JOIN account a ON a.id = s.account_id WHERE a.id IS NULL;
SELECT COUNT(*) FROM auth_sessions
 WHERE revoked_at IS NULL
   AND (expires_at <= CURRENT_TIMESTAMP(6)
        OR absolute_expires_at <= CURRENT_TIMESTAMP(6));
SELECT revoke_reason, COUNT(*) FROM auth_sessions GROUP BY revoke_reason;
SHOW CREATE TABLE auth_sessions;
SHOW CREATE TABLE refresh_tokens;
```

## Rollback risks

- Rollback deletes per-session Access Token revocation and audit reasons.
- A JWT revoked only through a session may work again until natural expiration
  after old code is restored.
- Old application code must not start before `session_id NOT NULL` is removed.
- Partial migration failure requires state-specific reconciliation; do not run
  the rollback blindly unless the final FK, index and column all exist.
- Session revocation code should also mark associated Refresh Tokens revoked.
  This preserves RT revocation after rollback, but cannot preserve AT revocation.
