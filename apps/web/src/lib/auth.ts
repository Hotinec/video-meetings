export type AuthMode = 'login' | 'register';

async function submitCredentials(mode: AuthMode, email: string, password: string): Promise<void> {
  const res = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (mode === 'login' && res.status === 401) throw new Error('Invalid email or password');
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(message ?? (mode === 'login' ? 'Login failed' : 'Registration failed'));
  }
}

export const registerUser = (email: string, password: string) =>
  submitCredentials('register', email, password);

export const loginUser = (email: string, password: string) =>
  submitCredentials('login', email, password);

export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
