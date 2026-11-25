import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations');
const USERNAME_MIGRATION = '20261124120000_add_user_username_avatar';
const SCRATCH_DB = 'video_meetings_migration_test';

function adminUrl(dbName: string): string {
  const url = new URL(process.env.DATABASE_URL ?? readEnvUrl());
  url.pathname = `/${dbName}`;
  url.search = '';
  return url.toString();
}

function readEnvUrl(): string {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  const match = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
  if (!match) throw new Error('DATABASE_URL not found');
  return match[1];
}

describe('User username migration with existing users (e2e)', () => {
  let admin: Client;
  let db: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);

    db = new Client({ connectionString: adminUrl(SCRATCH_DB) });
    await db.connect();

    const migrations = readdirSync(MIGRATIONS_DIR)
      .filter((d) => /^\d+_/.test(d))
      .sort();
    for (const name of migrations) {
      if (name === USERNAME_MIGRATION) break;
      await db.query(readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'));
    }

    // Users that exist before the migration; several would collide on a naive username.
    const emails = [
      'alice@example.com',
      'Alice@other.com',
      'alice@third.org',
      'bob.smith@example.com',
      'bob_smith@example.com',
      'a@example.com',
      `${'x'.repeat(40)}@example.com`,
      `${'x'.repeat(40)}@other.com`,
    ];
    for (const email of emails) {
      await db.query(
        'INSERT INTO "User" ("email", "password", "updatedAt") VALUES ($1, $2, now())',
        [email, 'hash'],
      );
    }

    await db.query(readFileSync(join(MIGRATIONS_DIR, USERNAME_MIGRATION, 'migration.sql'), 'utf8'));
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin?.end();
  });

  async function usernames(): Promise<Record<string, string>> {
    const { rows } = await db.query<{ email: string; username: string }>(
      'SELECT "email", "username"::text AS username FROM "User" ORDER BY "id"',
    );
    return Object.fromEntries(rows.map((r) => [r.email, r.username]));
  }

  it('gives every existing user a username', async () => {
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM "User" WHERE "username" IS NULL',
    );
    expect(rows[0].n).toBe(0);
  });

  it('keeps usernames unique, case-insensitively', async () => {
    const names = Object.values(await usernames()).map((n) => n.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('derives usernames from the email and suffixes collisions in id order', async () => {
    const names = await usernames();
    expect(names['alice@example.com']).toBe('alice');
    expect(names['Alice@other.com']).toBe('alice2');
    expect(names['alice@third.org']).toBe('alice3');
    expect(names['bob.smith@example.com']).toBe('bob_smith');
    expect(names['bob_smith@example.com']).toBe('bob_smith2');
  });

  it('pads short names to 3 characters and truncates long ones to 30', async () => {
    const names = await usernames();
    expect(names['a@example.com']).toBe('a__');
    expect(names[`${'x'.repeat(40)}@example.com`]).toBe('x'.repeat(30));
    expect(names[`${'x'.repeat(40)}@other.com`]).toBe(`${'x'.repeat(29)}2`);
  });

  it('enforces the unique index afterwards', async () => {
    await expect(
      db.query(
        'INSERT INTO "User" ("email", "username", "password", "updatedAt") VALUES ($1, $2, $3, now())',
        ['dup@example.com', 'ALICE', 'hash'],
      ),
    ).rejects.toThrow(/User_username_key/);
  });
});
