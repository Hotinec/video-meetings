import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

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
