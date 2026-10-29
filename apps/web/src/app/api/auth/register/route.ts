import { proxyAuth } from '@/lib/auth-proxy';

export const POST = (request: Request) => proxyAuth('register', request);
