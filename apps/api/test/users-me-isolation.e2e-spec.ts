import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('/users/me endpoints cannot modify another user (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let attackerToken: string;
  let attackerId: number;
  let victimId: number;

  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);
  const victim = () => prisma.user.findUniqueOrThrow({ where: { id: victimId } });
  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${attackerToken}` });

  beforeAll(async () => {
    process.env.UPLOAD_DIR = join(await mkdtemp(join(tmpdir(), 'vm-isolation-')), 'uploads');
    delete process.env.MAX_UPLOAD_BYTES;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await setupApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    const a = await http()
      .post('/auth/register')
      .send({ email: 'attacker@example.com', password: 'attacker-pass' });
    attackerToken = a.body.token;
    await http()
      .post('/auth/register')
      .send({ email: 'victim@example.com', password: 'victim-pass' });
    attackerId = (await prisma.user.findUniqueOrThrow({ where: { email: 'attacker@example.com' } }))
      .id;
    victimId = (await prisma.user.findUniqueOrThrow({ where: { email: 'victim@example.com' } })).id;
  });

  afterAll(async () => {
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('PATCH /users/me ignores an id/email in the body and changes only the caller', async () => {
    const before = await victim();
    const res = await http()
      .patch('/users/me')
      .set(auth())
      .send({ username: 'hijack', id: victimId, userId: victimId, email: 'victim@example.com' });

    expect([200, 400]).toContain(res.status);
    expect(await victim()).toEqual(before);
    if (res.status === 200) expect(res.body.id).toBe(attackerId);
  });

  it('POST /users/me/password changes only the caller, even with a victim id in the body', async () => {
    const before = await victim();
    await http().post('/users/me/password').set(auth()).send({
      oldPassword: 'attacker-pass',
      newPassword: 'new-attacker-pass',
      id: victimId,
      userId: victimId,
      email: 'victim@example.com',
    });

    expect((await victim()).password).toBe(before.password);
    await http()
      .post('/auth/login')
      .send({ email: 'victim@example.com', password: 'victim-pass' })
      .expect(201);
  });

  it("POST /users/me/password rejects the victim's old password", async () => {
    const before = await victim();
    await http()
      .post('/users/me/password')
      .set(auth())
      .send({ oldPassword: 'victim-pass', newPassword: 'new-attacker-pass' })
      .expect(401);
    expect((await victim()).password).toBe(before.password);
  });

  it('POST /users/me/avatar changes only the caller, even with a victim id field', async () => {
    const before = await victim();
    const res = await http()
      .post('/users/me/avatar')
      .set(auth())
      .field('userId', String(victimId))
      .field('id', String(victimId))
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.id).toBe(attackerId);
    expect(await victim()).toEqual(before);
  });

  it('has no route that modifies a user by id', async () => {
    const before = await victim();
    await http().patch(`/users/${victimId}`).set(auth()).send({ username: 'hijack' }).expect(404);
    await http()
      .post(`/users/${victimId}/password`)
      .set(auth())
      .send({ oldPassword: 'victim-pass', newPassword: 'new-attacker-pass' })
      .expect(404);
    await http()
      .post(`/users/${victimId}/avatar`)
      .set(auth())
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(404);
    expect(await victim()).toEqual(before);
  });
});
