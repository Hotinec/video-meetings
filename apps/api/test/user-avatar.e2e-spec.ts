import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('POST /users/me/avatar (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let token: string;
  let userId: number;

  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
  const WEBP = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBPVP8 '),
    Buffer.alloc(64),
  ]);
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

  const send = (
    content: Buffer,
    filename: string,
    contentType: string,
    auth: string | null = token,
  ) => {
    const req = request(app.getHttpServer())
      .post('/users/me/avatar')
      .attach('file', content, { filename, contentType });
    return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
  };

  const expectNoTempFiles = () => expect(readdirSync(join(uploadDir, 'tmp'))).toEqual([]);

  beforeAll(async () => {
    uploadDir = join(await mkdtemp(join(tmpdir(), 'vm-avatars-')), 'uploads');
    process.env.UPLOAD_DIR = uploadDir;
    delete process.env.MAX_UPLOAD_BYTES;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await setupApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const auth = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'avatar-user@example.com', password: 'password123' });
    token = auth.body.token;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: 'avatar-user@example.com' } }))
      .id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
    await rm(join(uploadDir, '..'), { recursive: true, force: true });
  });

  it.each([
    ['png', PNG, 'image/png'],
    ['jpg', JPEG, 'image/jpeg'],
    ['webp', WEBP, 'image/webp'],
  ])('accepts a valid %s and returns the profile with avatarUrl', async (ext, content, type) => {
    const res = await send(content, `me.${ext}`, type).expect(201);

    expect(res.body).toEqual({
      id: userId,
      email: 'avatar-user@example.com',
      username: expect.any(String),
      avatarUrl: `/users/${userId}/avatar`,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.avatarPath).toBeTruthy();
    expect(existsSync(join(uploadDir, user.avatarPath!))).toBe(true);
    expectNoTempFiles();
  });

  it('deletes the previous avatar file when replaced', async () => {
    await send(PNG, 'a.png', 'image/png').expect(201);
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).avatarPath!;
    expect(existsSync(join(uploadDir, before))).toBe(true);

    await send(JPEG, 'b.jpg', 'image/jpeg').expect(201);
    const after = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).avatarPath!;

    expect(after).not.toBe(before);
    expect(existsSync(join(uploadDir, before))).toBe(false);
    expect(existsSync(join(uploadDir, after))).toBe(true);
    expect(readdirSync(join(uploadDir, 'avatars', String(userId)))).toHaveLength(1);
  });

  it('keeps the old avatar and leaves no orphan when the DB update fails', async () => {
    await send(PNG, 'a.png', 'image/png').expect(201);
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).avatarPath!;

    const spy = jest.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('db down'));
    await send(JPEG, 'b.jpg', 'image/jpeg').expect(500);
    spy.mockRestore();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.avatarPath).toBe(before);
    expect(existsSync(join(uploadDir, before))).toBe(true);
    expect(readdirSync(join(uploadDir, 'avatars', String(userId)))).toHaveLength(1);
    expectNoTempFiles();
  });

  it('rejects a disallowed declared type with 400', async () => {
    await send(PDF, 'doc.pdf', 'application/pdf').expect(400);
    expectNoTempFiles();
  });

  it('rejects a PDF disguised as a PNG (content check) with 400', async () => {
    await send(PDF, 'fake.png', 'image/png').expect(400);
    expectNoTempFiles();
  });

  it('rejects a file over 5 MB with 400', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    await send(big, 'big.png', 'image/png').expect(400);
    expectNoTempFiles();
  });

  it('rejects a request without a file with 400', async () => {
    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .field('x', 'y')
      .expect(400);
  });

  it('returns 401 without a token', async () => {
    await send(PNG, 'me.png', 'image/png', null).expect(401);
  });
});
