import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

  const MAX_BYTES = 1024;
  const CONTENT = Buffer.from('hello meeting file');
  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64),
  ]);
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

  const send = (content: Buffer, filename: string, contentType: string) =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', content, { filename, contentType });

  const expectNothingLeftOnDisk = async (filesBefore: number) => {
    expect(readdirSync(join(uploadDir, 'tmp'))).toEqual([]);
    expect(await prisma.meetingFile.count()).toBe(filesBefore);
  };

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
    process.env.MAX_UPLOAD_BYTES = String(MAX_BYTES);

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
    delete process.env.MAX_UPLOAD_BYTES;
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

  describe('POST /meetings/:id/files - validation', () => {
    it('201 - accepts a real PDF', async () => {
      const res = await send(PDF, 'minutes.pdf', 'application/pdf').expect(201);
      expect(res.body.mimeType).toBe('application/pdf');
    });

    it('400 - rejects a disallowed type', async () => {
      const before = await prisma.meetingFile.count();
      const res = await send(
        Buffer.from('MZ binary'),
        'setup.exe',
        'application/octet-stream',
      ).expect(400);
      expect(res.body.message).toMatch(/not allowed/i);
      await expectNothingLeftOnDisk(before);
    });

    it('400 - rejects a MIME type that does not match the extension', async () => {
      const before = await prisma.meetingFile.count();
      await send(PDF, 'minutes.pdf', 'image/png').expect(400);
      await expectNothingLeftOnDisk(before);
    });

    it('400 - rejects a spoofed file: PNG content named .pdf with a PDF MIME type', async () => {
      const before = await prisma.meetingFile.count();
      const res = await send(PNG, 'fake.pdf', 'application/pdf').expect(400);
      expect(res.body.message).toMatch(/content does not match/i);
      await expectNothingLeftOnDisk(before);
    });

    it('400 - rejects binary content named .txt', async () => {
      const before = await prisma.meetingFile.count();
      await send(PNG, 'fake.txt', 'text/plain').expect(400);
      await expectNothingLeftOnDisk(before);
    });

    it('400 - rejects a file over the size limit and leaves nothing on disk', async () => {
      const before = await prisma.meetingFile.count();
      const res = await send(Buffer.alloc(MAX_BYTES * 4, 'a'), 'big.txt', 'text/plain').expect(400);
      expect(res.body.message).toMatch(/too large/i);
      await expectNothingLeftOnDisk(before);
    });

    it('201 - keeps a non-ASCII filename intact', async () => {
      const res = await send(CONTENT, 'Протокол встречи.txt', 'text/plain').expect(201);
      expect(res.body.originalName).toBe('Протокол встречи.txt');
    });
  });

  describe('GET /meetings/:id/files/:fileId/download', () => {
    const download = (id: number, fileId: string, auth: string | null = token) => {
      const req = request(app.getHttpServer()).get(`/meetings/${id}/files/${fileId}/download`);
      return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
    };

    it('200 - returns the exact uploaded bytes with attachment headers', async () => {
      const bytes = Buffer.concat([PDF, Buffer.from([0, 255, 128, 7])]);
      const up = await send(bytes, 'report.pdf', 'application/pdf').expect(201);

      const res = await download(meetingId, up.body.id)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect((res.body as Buffer).equals(bytes)).toBe(true);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-length']).toBe(String(bytes.length));
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('200 - encodes a non-ASCII filename with an ASCII fallback', async () => {
      const up = await send(CONTENT, 'Протокол.txt', 'text/plain').expect(201);
      const res = await download(meetingId, up.body.id).expect(200);

      const header = res.headers['content-disposition'];
      expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('Протокол.txt')}`);
      expect(header).toMatch(/filename="[\x20-\x7e]+"/);
    });

    it('401 - rejects a request without a token', async () => {
      const up = await send(CONTENT, 'a.txt', 'text/plain').expect(201);
      await download(meetingId, up.body.id, null).expect(401);
    });

    it('404 - unknown file', async () => {
      await download(meetingId, '00000000-0000-0000-0000-000000000000').expect(404);
      await download(meetingId, 'not-a-uuid').expect(404);
    });

    it('404 - file belongs to another meeting', async () => {
      const other = await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Other meeting', date: '2026-11-02T10:00:00.000Z' });
      const up = await send(CONTENT, 'b.txt', 'text/plain').expect(201);

      await download(other.body.id, up.body.id).expect(404);
    });

    it('404 - record exists but the file is missing on disk', async () => {
      const up = await send(CONTENT, 'gone.txt', 'text/plain').expect(201);
      const row = await prisma.meetingFile.findUniqueOrThrow({ where: { id: up.body.id } });
      await rm(join(uploadDir, row.filePath));

      await download(meetingId, up.body.id).expect(404);
    });

    it('404 - refuses a stored path that escapes the upload root', async () => {
      const up = await send(CONTENT, 'trap.txt', 'text/plain').expect(201);
      await prisma.meetingFile.update({
        where: { id: up.body.id },
        data: { filePath: '../../../etc/hosts' },
      });

      await download(meetingId, up.body.id).expect(404);
    });
  });

  describe('DELETE /meetings/:id/files/:fileId', () => {
    const del = (id: number, fileId: string, auth: string | null = token) => {
      const req = request(app.getHttpServer()).delete(`/meetings/${id}/files/${fileId}`);
      return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
    };
    const listIds = async () => {
      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return res.body.map((f: { id: string }) => f.id);
    };
    const uploadRow = async (name = 'del.txt') => {
      const up = await send(CONTENT, name, 'text/plain').expect(201);
      const row = await prisma.meetingFile.findUniqueOrThrow({ where: { id: up.body.id } });
      return { id: up.body.id as string, onDisk: join(uploadDir, row.filePath) };
    };

    it('204 - host deletes the file from the list, the database and the disk', async () => {
      const { id, onDisk } = await uploadRow();
      expect(existsSync(onDisk)).toBe(true);

      const res = await del(meetingId, id).expect(204);
      expect(res.text).toBe('');

      expect(await listIds()).not.toContain(id);
      expect(await prisma.meetingFile.findUnique({ where: { id } })).toBeNull();
      expect(existsSync(onDisk)).toBe(false);
    });

    it('204 - still deletes the record when the file is already missing on disk', async () => {
      const { id, onDisk } = await uploadRow('orphan.txt');
      await rm(onDisk);

      await del(meetingId, id).expect(204);
      expect(await prisma.meetingFile.findUnique({ where: { id } })).toBeNull();
    });

    it('403 - a non-host cannot delete, and the file remains', async () => {
      const { id, onDisk } = await uploadRow('keep.txt');
      const other = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'files-other@example.com', password: 'password123' });

      await del(meetingId, id, other.body.token).expect(403);

      expect(await listIds()).toContain(id);
      expect(existsSync(onDisk)).toBe(true);
    });

    it('401 - rejects a request without a token', async () => {
      const { id } = await uploadRow('auth.txt');
      await del(meetingId, id, null).expect(401);
      expect(await listIds()).toContain(id);
    });

    it('404 - unknown file', async () => {
      await del(meetingId, '00000000-0000-0000-0000-000000000000').expect(404);
      await del(meetingId, 'not-a-uuid').expect(404);
    });

    it('404 - unknown meeting', async () => {
      await del(999999, '00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('404 - file belongs to another meeting, and it remains', async () => {
      const other = await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Third meeting', date: '2026-11-03T10:00:00.000Z' });
      const { id, onDisk } = await uploadRow('cross.txt');

      await del(other.body.id, id).expect(404);

      expect(await listIds()).toContain(id);
      expect(existsSync(onDisk)).toBe(true);
    });

    it('204 - never removes anything outside the upload root', async () => {
      const outside = join(uploadDir, '..', 'outside.txt');
      await writeFile(outside, 'keep me');
      const { id } = await uploadRow('trap.txt');
      await prisma.meetingFile.update({
        where: { id },
        data: { filePath: '../outside.txt' },
      });

      await del(meetingId, id).expect(204);

      expect(await prisma.meetingFile.findUnique({ where: { id } })).toBeNull();
      expect(existsSync(outside)).toBe(true);
    });

    it('204 - deletes the record even if removing the disk file fails', async () => {
      const { id, onDisk } = await uploadRow('stuck.txt');
      // A non-empty directory makes rm() throw, standing in for EPERM/EBUSY.
      const dir = join(uploadDir, 'meetings', 'stuck');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'inner.txt'), 'x');
      await prisma.meetingFile.update({ where: { id }, data: { filePath: 'meetings/stuck' } });
      const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await del(meetingId, id).expect(204);

      expect(errors).toHaveBeenCalled();
      errors.mockRestore();
      expect(await prisma.meetingFile.findUnique({ where: { id } })).toBeNull();
      expect(existsSync(join(dir, 'inner.txt'))).toBe(true);
      await rm(onDisk, { force: true });
    });
  });
});
