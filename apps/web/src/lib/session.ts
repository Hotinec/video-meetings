import 'server-only';
import { cookies } from 'next/headers';

export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const COOKIE_NAME = 'token';
const MAX_AGE = 60 * 60 * 24 * 7; // matches the API's 7d JWT expiry

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value;
}

export async function setToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearToken(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** Reads the email claim for display only; the API verifies the signature on every request. */
export function emailFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

/** Reads the user id (`sub`) for display decisions only (e.g. showing a delete button); the API enforces ownership. */
export function userIdFromToken(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return typeof payload.sub === 'number' ? payload.sub : null;
  } catch {
    return null;
  }
}
