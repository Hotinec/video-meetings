import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await setupApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  // ─── Registration ────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('201 - successful registration returns a JWT token', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'alice@example.com', password: 'password123' })
        .expect(201)
        .expect((res) => {
          expect(typeof res.body.token).toBe('string');
          expect(res.body.token.length).toBeGreaterThan(0);
        });
    });

    it('409 - duplicate email is rejected', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'alice@example.com', password: 'password123' })
        .expect(409);
    });

    it('400 - missing email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('400 - missing password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'bob@example.com' })
        .expect(400);
    });

    it('400 - invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });
  });

  // ─── Username at signup ──────────────────────────────────────────────────────

  describe('username at signup', () => {
    const register = (email: string) =>
      request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

    const usernameOf = async (email: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { email } })).username;

    it('derives the username from the email local part', async () => {
      expect(await usernameOf('alice@example.com')).toBe('alice');
    });

    it('starts with no avatar', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
      expect(user.avatarPath).toBeNull();
    });

    it('adds a numeric suffix when the username is taken (case-insensitive)', async () => {
      await register('Alice@other.com');
      expect(await usernameOf('Alice@other.com')).toBe('alice2');

      await register('alice@third.com');
      expect(await usernameOf('alice@third.com')).toBe('alice3');
    });

    it('replaces characters outside letters, digits, _ and - with _', async () => {
      await register('john.doe+tag@example.com');
      expect(await usernameOf('john.doe+tag@example.com')).toBe('john_doe_tag');
    });

    it('pads a local part shorter than 3 characters', async () => {
      await register('jo@example.com');
      const username = await usernameOf('jo@example.com');
      expect(username).toMatch(/^[a-z0-9_-]{3,30}$/);
      expect(username).toContain('jo');
    });

    it('truncates a long local part to 30 characters, suffix included', async () => {
      const local = 'a'.repeat(40);
      await register(`${local}@example.com`);
      await register(`${local}@other.com`);
      expect(await usernameOf(`${local}@example.com`)).toBe('a'.repeat(30));
      expect(await usernameOf(`${local}@other.com`)).toBe(`${'a'.repeat(29)}2`);
    });

    it('the database rejects a username that differs only by case', async () => {
      await expect(
        prisma.user.create({
          data: { email: 'case@example.com', password: 'x', username: 'ALICE' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('201 - successful login returns a JWT token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'password123' })
        .expect(201)
        .expect((res) => {
          expect(typeof res.body.token).toBe('string');
          expect(res.body.token.length).toBeGreaterThan(0);
        });
    });

    it('401 - wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('401 - non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'password123' })
        .expect(401);
    });

    it('400 - missing email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('400 - missing password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com' })
        .expect(400);
    });

    it('400 - invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });
  });
});
