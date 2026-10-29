import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Meetings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let createdMeetingId: number;

  const MEETING_DATE = '2026-11-01T10:00:00.000Z';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user-a@example.com', password: 'password123' });
    tokenA = resA.body.token;

    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user-b@example.com', password: 'password123' });
    tokenB = resB.body.token;
  });

  afterAll(async () => {
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ─── POST /meetings ───────────────────────────────────────────────────────────

  describe('POST /meetings', () => {
    it('201 - creates a meeting and returns its data', async () => {
      const res = await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Team Standup', date: MEETING_DATE })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Team Standup');
      expect(res.body.date).toBeDefined();
      expect(res.body.hostId).toBeDefined();
      expect(res.body.createdAt).toBeDefined();

      createdMeetingId = res.body.id;
    });

    it('401 - missing authorization token', () => {
      return request(app.getHttpServer())
        .post('/meetings')
        .send({ title: 'Team Standup', date: MEETING_DATE })
        .expect(401);
    });

    it('401 - invalid authorization token', () => {
      return request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ title: 'Team Standup', date: MEETING_DATE })
        .expect(401);
    });

    it('400 - missing title', () => {
      return request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: MEETING_DATE })
        .expect(400);
    });

    it('400 - empty title', () => {
      return request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: '', date: MEETING_DATE })
        .expect(400);
    });

    it('400 - missing date', () => {
      return request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Team Standup' })
        .expect(400);
    });
  });

  // ─── GET /meetings ────────────────────────────────────────────────────────────

  describe('GET /meetings', () => {
    beforeAll(async () => {
      // user B creates their own meeting — must not appear in user A's list
      await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: "User B's Private Meeting", date: MEETING_DATE });
    });

    it('200 - returns only the authenticated user own meetings', () => {
      return request(app.getHttpServer())
        .get('/meetings')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0].id).toBeDefined();
          expect(res.body[0].title).toBeDefined();
          const titles = res.body.map((m: { title: string }) => m.title);
          expect(titles).not.toContain("User B's Private Meeting");
        });
    });

    it('401 - missing authorization token', () => {
      return request(app.getHttpServer()).get('/meetings').expect(401);
    });
  });

  // ─── GET /meetings/:id ────────────────────────────────────────────────────────

  describe('GET /meetings/:id', () => {
    it('200 - returns a meeting by id', () => {
      return request(app.getHttpServer())
        .get(`/meetings/${createdMeetingId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdMeetingId);
          expect(res.body.title).toBe('Team Standup');
        });
    });

    it('401 - missing authorization token', () => {
      return request(app.getHttpServer()).get(`/meetings/${createdMeetingId}`).expect(401);
    });

    it('404 - non-existent id', () => {
      return request(app.getHttpServer())
        .get('/meetings/999999')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });
});
