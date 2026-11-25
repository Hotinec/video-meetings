import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /users/me/password (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let token: string;
  const email = 'password@example.com';

  const change = (body: object, auth: string | null = token) => {
    const req = request(app.getHttpServer()).post('/users/me/password');
    if (auth) req.set('Authorization', `Bearer ${auth}`);
    return req.send(body);
  };
  const storedHash = async () =>
    (await prisma.user.findUniqueOrThrow({ where: { email } })).password;

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
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'old-password' });
    token = res.body.token;
  });

  afterAll(async () => {
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('204 - changes the password; only the new one logs in afterwards', async () => {
    const res = await change({ oldPassword: 'old-password', newPassword: 'new-password' }).expect(
      204,
    );
    expect(res.text).toBe('');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'old-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'new-password' })
      .expect(201);
  });

  it('204 - stores a bcrypt hash, not the plain password', async () => {
    await change({ oldPassword: 'old-password', newPassword: 'new-password' }).expect(204);
    const hash = await storedHash();
    expect(hash).not.toContain('new-password');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('401 - wrong old password leaves the hash unchanged', async () => {
    const before = await storedHash();
    await change({ oldPassword: 'wrong', newPassword: 'new-password' }).expect(401);
    expect(await storedHash()).toBe(before);
  });

  it('400 - new password equals the old one', async () => {
    const before = await storedHash();
    await change({ oldPassword: 'old-password', newPassword: 'old-password' }).expect(400);
    expect(await storedHash()).toBe(before);
  });

  it.each([
    ['empty new password', { oldPassword: 'old-password', newPassword: '' }],
    ['missing new password', { oldPassword: 'old-password' }],
    ['non-string new password', { oldPassword: 'old-password', newPassword: 123 }],
    ['missing old password', { newPassword: 'new-password' }],
  ])('400 - %s', async (_name, body) => {
    const before = await storedHash();
    await change(body).expect(400);
    expect(await storedHash()).toBe(before);
  });

  it('401 - without or with an invalid token', async () => {
    const body = { oldPassword: 'old-password', newPassword: 'new-password' };
    await change(body, null).expect(401);
    await change(body, 'garbage').expect(401);
  });

  it('404 - user deleted after the token was issued', async () => {
    await prisma.user.deleteMany();
    await change({ oldPassword: 'old-password', newPassword: 'new-password' }).expect(404);
  });
});
