import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Meeting files (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let token: string;
  let meetingId: number;

  const CONTENT = Buffer.from('hello meeting file');

  const upload = (id: number | string, auth: string | null = token) => {
    const req = request(app.getHttpServer())
      .post(`/meetings/${id}/files`)
      .attach('file', CONTENT, { filename: 'notes.txt', contentType: 'text/plain' });
    return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
  };

  beforeAll(async () => {
    // Start from a path that does not exist, to prove the app creates it on startup.
    uploadDir = join(await mkdtemp(join(tmpdir(), 'vm-uploads-')), 'uploads');
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
      .send({ email: 'files-user@example.com', password: 'password123' });
    token = auth.body.token;

    const meeting = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Files meeting', date: '2026-11-01T10:00:00.000Z' });
    meetingId = meeting.body.id;
  });

  afterAll(async () => {
    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
    delete process.env.UPLOAD_DIR;
    await rm(join(uploadDir, '..'), { recursive: true, force: true });
  });

  it('creates the upload directory on startup', () => {
    expect(existsSync(join(uploadDir, 'tmp'))).toBe(true);
  });

  describe('POST /meetings/:id/files', () => {
    it('201 - stores the file on disk and returns its metadata', async () => {
      const res = await upload(meetingId).expect(201);

      expect(res.body).toMatchObject({
        meetingId,
        originalName: 'notes.txt',
        mimeType: 'text/plain',
        size: CONTENT.length,
      });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.uploadedAt).toBeDefined();
      expect(res.body.filePath).toBeUndefined();

      const row = await prisma.meetingFile.findUniqueOrThrow({ where: { id: res.body.id } });
      const onDisk = join(uploadDir, row.filePath);
      expect(existsSync(onDisk)).toBe(true);
      expect(readFileSync(onDisk).equals(CONTENT)).toBe(true);
    });

    it('401 - rejects a request without a token', async () => {
      await upload(meetingId, null).expect(401);
    });

    it('404 - unknown meeting, and nothing is left behind in tmp', async () => {
      await upload(999999).expect(404);

      expect(readdirSync(join(uploadDir, 'tmp'))).toEqual([]);
    });

    it('400 - no file in the request', async () => {
      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .field('note', 'no file here')
        .expect(400);
    });
  });

  describe('GET /meetings/:id/files', () => {
    it('200 - lists uploaded files, newest first', async () => {
      const second = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('second'), {
          filename: 'second.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].id).toBe(second.body.id);
      expect(res.body.map((f: { originalName: string }) => f.originalName)).toContain('notes.txt');
      expect(res.body[0].filePath).toBeUndefined();
    });

    it('401 - rejects a request without a token', async () => {
      await request(app.getHttpServer()).get(`/meetings/${meetingId}/files`).expect(401);
    });

    it('404 - unknown meeting', async () => {
      await request(app.getHttpServer())
        .get('/meetings/999999/files')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
