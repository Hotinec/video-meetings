import { resolve } from 'node:path';

const DEFAULT_UPLOAD_DIR = './uploads';
const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Absolute path of the upload root. Read at call time so tests can override the env. */
export function getUploadDir(): string {
  return resolve(process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR);
}

export function getMaxUploadBytes(): number {
  const value = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_UPLOAD_BYTES;
}
