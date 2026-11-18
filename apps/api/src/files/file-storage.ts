import { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface TempFile {
  path: string;
  size: number;
}

export interface FileStorage {
  /** Streams the upload into a temporary location. */
  saveTemp(stream: Readable): Promise<TempFile>;
  /** Moves a temp file into its final place and returns the path relative to the upload root. */
  commit(tempPath: string, meetingId: number, fileId: string): Promise<string>;
  /** Removes a path (relative to the upload root, or an absolute temp path). Missing is fine. */
  remove(path: string): Promise<void>;
}
