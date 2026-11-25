import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await setupApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'profile@example.com', password: 'password123' });
    token = res.body.token;
  });

  afterAll(async () => {
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('GET /users/me', () => {
    it('200 - returns id, email, username and a null avatarUrl without an avatar', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'profile@example.com' } });
      expect(res.body).toEqual({
        id: user.id,
        email: 'profile@example.com',
        username: user.username,
        avatarUrl: null,
      });
      expect(res.body.username).toBeTruthy();
      expect(res.body.password).toBeUndefined();
    });

    it('200 - avatarUrl points to /users/:id/avatar when the user has an avatar', async () => {
      const user = await prisma.user.update({
        where: { email: 'profile@example.com' },
        data: { avatarPath: 'avatars/1' },
      });

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.avatarUrl).toBe(`/users/${user.id}/avatar`);
      expect(res.body.avatarPath).toBeUndefined();

      await prisma.user.update({ where: { id: user.id }, data: { avatarPath: null } });
    });

    it('401 - without a token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('401 - with an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });

    it('404 - when the token user no longer exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'ghost@example.com', password: 'password123' });
      await prisma.user.delete({ where: { email: 'ghost@example.com' } });

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(404);
    });
  });

  describe('PATCH /users/me', () => {
    const patch = (body: object, t: string | null = token) => {
      const req = request(app.getHttpServer()).patch('/users/me');
      if (t) req.set('Authorization', `Bearer ${t}`);
      return req.send(body);
    };

    it('200 - updates the username and returns the profile', async () => {
      const res = await patch({ username: 'new_name-1' }).expect(200);
      expect(res.body.username).toBe('new_name-1');
      expect(res.body.email).toBe('profile@example.com');
      const me = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(me.body.username).toBe('new_name-1');
    });

    it('200 - allows changing only the case of own username', async () => {
      const res = await patch({ username: 'New_Name-1' }).expect(200);
      expect(res.body.username).toBe('New_Name-1');
    });

    it.each(['ab', 'a'.repeat(31), 'bad name', 'bad@name', 'héllo', ''])(
      '400 - rejects invalid username %p',
      async (username) => {
        await patch({ username }).expect(400);
      },
    );

    it('400 - rejects a missing or non-string username', async () => {
      await patch({}).expect(400);
      await patch({ username: 123 }).expect(400);
    });

    it('409 - rejects a username taken by another user with different case', async () => {
      const other = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'other@example.com', password: 'password123' });
      await patch({ username: 'TAKEN_name' }, other.body.token).expect(200);

      await patch({ username: 'taken_NAME' }).expect(409);

      const me = await prisma.user.findUniqueOrThrow({ where: { email: 'profile@example.com' } });
      expect(me.username).toBe('New_Name-1');
      const unchanged = await prisma.user.findUniqueOrThrow({
        where: { email: 'other@example.com' },
      });
      expect(unchanged.username).toBe('TAKEN_name');
    });

    it('only affects the token user', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { email: 'other@example.com' } });
      await patch({ id: before.id, email: 'x@example.com', username: 'mine_only' }).expect(200);
      const after = await prisma.user.findUniqueOrThrow({ where: { email: 'other@example.com' } });
      expect(after.username).toBe(before.username);
      const mine = await prisma.user.findUniqueOrThrow({ where: { email: 'profile@example.com' } });
      expect(mine.username).toBe('mine_only');
    });

    it('401 - without a token', async () => {
      await patch({ username: 'whoever' }, null).expect(401);
    });
  });
});
