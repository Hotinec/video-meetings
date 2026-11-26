import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FileStorage, TempFile } from './file-storage';
import { getUploadDir } from './upload.config';

@Injectable()
export class LocalFileStorage implements FileStorage, OnModuleInit {
  async onModuleInit(): Promise<void> {
    await mkdir(join(getUploadDir(), 'tmp'), { recursive: true });
  }

  async saveTemp(stream: Readable): Promise<TempFile> {
    const tempDir = join(getUploadDir(), 'tmp');
    await mkdir(tempDir, { recursive: true });
    const path = join(tempDir, randomUUID());
    const out = createWriteStream(path);
    try {
      await pipeline(stream, out);
    } catch (err) {
      await this.remove(path);
      throw err;
    }
    return { path, size: out.bytesWritten };
  }

  async commit(tempPath: string, meetingId: number, fileId: string): Promise<string> {
    const relativePath = join('meetings', String(meetingId), fileId);
    const finalPath = join(getUploadDir(), relativePath);
    await mkdir(dirname(finalPath), { recursive: true });
    await rename(tempPath, finalPath);
    return relativePath;
  }

  async commitAvatar(
    tempPath: string,
    userId: number,
    fileId: string,
    ext: string,
  ): Promise<string> {
    const relativePath = join('avatars', String(userId), `${fileId}.${ext}`);
    const finalPath = join(getUploadDir(), relativePath);
    await mkdir(dirname(finalPath), { recursive: true });
    await rename(tempPath, finalPath);
    return relativePath;
  }

  async remove(path: string): Promise<void> {
    await rm(isAbsolute(path) ? path : join(getUploadDir(), path), { force: true });
  }
}
