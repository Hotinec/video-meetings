import { vi } from 'vitest';

type Reply = { status: number; body: unknown };

/** Minimal XMLHttpRequest stand-in: tests drive progress and the response by hand, or auto-reply. */
export class FakeXHR {
  static instances: FakeXHR[] = [];
  static autoReply: (() => Reply) | null = null;

  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 0;
  responseText = '';
  method = '';
  url = '';
  body: unknown = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: unknown) {
    this.body = body;
    FakeXHR.instances.push(this);
    const reply = FakeXHR.autoReply?.();
    if (reply) queueMicrotask(() => this.respond(reply.status, reply.body));
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }
}

export function installFakeXHR(autoReply: (() => Reply) | null = null) {
  FakeXHR.instances = [];
  FakeXHR.autoReply = autoReply;
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
}
