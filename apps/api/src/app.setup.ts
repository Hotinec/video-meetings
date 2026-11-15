import multipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getMaxUploadBytes } from './files/upload.config';

/** Shared app configuration, used by main.ts and the e2e bootstraps. */
export async function setupApp(app: NestFastifyApplication): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: getMaxUploadBytes(), files: 1 },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}
