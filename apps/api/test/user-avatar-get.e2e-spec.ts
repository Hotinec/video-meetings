import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /users/:id/avatar (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let token: string;
  let userId: number;

  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);

  beforeAll(async () => {
    uploadDir = join(await mkdtemp(join(tmpdir(), 'vm-avatar-get-')), 'uploads');
    process.env.UPLOAD_DIR = uploadDir;

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
      .send({ email: 'avatar-get@example.com', password: 'password123' });
    token = auth.body.token;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: 'avatar-get@example.com' } }))
      .id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
    await rm(join(uploadDir, '..'), { recursive: true, force: true });
  });

  const get = (id: number | string, auth: string | null = token) => {
    const req = request(app.getHttpServer()).get('/users/' + id + '/avatar');
    return auth ? req.set('Authorization', 'Bearer ' + auth) : req;
  };

  it('returns 404 when the user has no avatar', async () => {
    await get(userId).expect(404);
  });

  it('returns 404 for an unknown user', async () => {
    await get(userId + 100000).expect(404);
  });

  it('returns 404 (not 500) for an id beyond the int range', async () => {
    await get('99999999999').expect(404);
  });

  it('returns 401 without a token', async () => {
    await get(userId, null).expect(401);
  });

  it('streams the image with the right Content-Type and avatarUrl points to it', async () => {
    const up = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set('Authorization', 'Bearer ' + token)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    expect(up.body.avatarUrl).toBe('/users/' + userId + '/avatar');

    const res = await get(userId).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(res.body).equals(PNG)).toBe(true);
  });
});
