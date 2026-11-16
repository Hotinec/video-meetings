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

/**
 * The PRD's end-to-end scenario in one story: upload -> display -> download -> deletion,
 * including who may do what. Detailed edge cases live in meeting-files.e2e-spec.ts.
 */
describe('Meeting file lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let hostToken: string;
  let guestToken: string;
  let meetingId: number;

  const MAX_BYTES = 1024;

  // A real PDF signature plus binary bytes, to prove the download is byte-exact.
  const PDF = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
    Buffer.from([0, 255, 128, 7, 42]),
  ]);

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const filesUrl = () => `/meetings/${meetingId}/files`;

  const register = async (email: string): Promise<string> =>
    (await api().post('/auth/register').send({ email, password: 'password123' })).body.token;

  beforeAll(async () => {
    uploadDir = join(await mkdtemp(join(tmpdir(), 'vm-flow-')), 'uploads');
    process.env.UPLOAD_DIR = uploadDir;
    process.env.MAX_UPLOAD_BYTES = String(MAX_BYTES); // read when the app starts

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

    hostToken = await register('flow-host@example.com');
    guestToken = await register('flow-guest@example.com');
    const meeting = await api()
      .post('/meetings')
      .set(as(hostToken))
      .send({ title: 'Lifecycle meeting', date: '2026-11-01T10:00:00.000Z' });
    meetingId = meeting.body.id;
  });

  afterAll(async () => {
    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
    delete process.env.UPLOAD_DIR;
    delete process.env.MAX_UPLOAD_BYTES;
    await rm(join(uploadDir, '..'), { recursive: true, force: true });
  });

  it('upload -> display -> download -> delete, with the host as the only one who can delete', async () => {
    // Upload: the host attaches a PDF to the meeting.
    const upload = await api()
      .post(filesUrl())
      .set(as(hostToken))
      .attach('file', PDF, { filename: 'minutes.pdf', contentType: 'application/pdf' })
      .expect(201);
    const fileId: string = upload.body.id;
    expect(upload.body).toMatchObject({
      meetingId,
      originalName: 'minutes.pdf',
      mimeType: 'application/pdf',
      size: PDF.length,
    });

    const row = await prisma.meetingFile.findUniqueOrThrow({ where: { id: fileId } });
    const onDisk = join(uploadDir, row.filePath);
    expect(existsSync(onDisk)).toBe(true);

    // Display: the file is in the list, for the host and for another participant.
    for (const token of [hostToken, guestToken]) {
      const list = await api().get(filesUrl()).set(as(token)).expect(200);
      expect(list.body.map((f: { id: string }) => f.id)).toEqual([fileId]);
      expect(list.body[0].filePath).toBeUndefined();
    }

    // Download: any participant gets the exact bytes as an attachment.
    for (const token of [hostToken, guestToken]) {
      const res = await api()
        .get(`${filesUrl()}/${fileId}/download`)
        .set(as(token))
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect((res.body as Buffer).equals(PDF)).toBe(true);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="minutes.pdf"; filename*=UTF-8''minutes.pdf`,
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }

    // Delete: a non-host is refused and nothing changes...
    await api().delete(`${filesUrl()}/${fileId}`).set(as(guestToken)).expect(403);
    expect(existsSync(onDisk)).toBe(true);
    expect(await prisma.meetingFile.count({ where: { id: fileId } })).toBe(1);

    // ...the host deletes it, and it is gone from the list, the database and the disk.
    await api().delete(`${filesUrl()}/${fileId}`).set(as(hostToken)).expect(204);
    const after = await api().get(filesUrl()).set(as(hostToken)).expect(200);
    expect(after.body).toEqual([]);
    expect(await prisma.meetingFile.count({ where: { id: fileId } })).toBe(0);
    expect(existsSync(onDisk)).toBe(false);

    // And it can no longer be downloaded or deleted again.
    await api().get(`${filesUrl()}/${fileId}/download`).set(as(hostToken)).expect(404);
    await api().delete(`${filesUrl()}/${fileId}`).set(as(hostToken)).expect(404);

    // Nothing is left behind in the temp directory.
    expect(readdirSync(join(uploadDir, 'tmp'))).toEqual([]);
  });

  it('shows a clear 400 for an invalid type and for a file over the limit, storing nothing', async () => {
    const before = await prisma.meetingFile.count();

    const badType = await api()
      .post(filesUrl())
      .set(as(hostToken))
      .attach('file', Buffer.from('MZ binary'), {
        filename: 'setup.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
    expect(badType.body.message).toMatch(/not allowed/i);

    const tooBig = await api()
      .post(filesUrl())
      .set(as(hostToken))
      .attach('file', Buffer.alloc(MAX_BYTES * 4, 'a'), {
        filename: 'big.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(tooBig.body.message).toMatch(/too large/i);

    expect(await prisma.meetingFile.count()).toBe(before);
    expect(readdirSync(join(uploadDir, 'tmp'))).toEqual([]);
  });
});
