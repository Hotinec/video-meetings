'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, Input, Label, Spinner } from '@heroui/react';

const USERNAME_RULE = /^[A-Za-z0-9_-]{3,30}$/;
const RULE_MESSAGE = 'Use 3–30 characters: letters, digits, _ or -.';
const DANGER_TEXT = 'color-mix(in oklch, var(--danger), black 45%)';

export function UsernameForm({ username }: { username: string }) {
  const router = useRouter();
  const [value, setValue] = useState(username);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const next = value.trim();
    if (!USERNAME_RULE.test(next)) {
      setError(RULE_MESSAGE);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        setError(
          typeof message === 'string' && message
            ? message
            : 'Could not save your username. Please try again.',
        );
        return;
      }
      const updated = await res.json().catch(() => null);
      setValue(typeof updated?.username === 'string' ? updated.username : next);
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not save your username. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          variant="primary"
          fullWidth
          className="min-h-11"
          autoComplete="username"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'username-error' : undefined}
        />
      </div>

      {error && (
        <p
          id="username-error"
          role="alert"
          className="text-sm px-3 py-2 rounded-lg"
          style={{ color: DANGER_TEXT, background: 'var(--danger-soft)' }}
        >
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm" style={{ color: 'var(--foreground)' }}>
          Username saved.
        </p>
      )}

      <Button type="submit" variant="primary" isDisabled={isLoading} className="w-fit min-h-11">
        {isLoading ? (
          <>
            <Spinner size="sm" color="current" />
            Saving…
          </>
        ) : (
          'Save'
        )}
      </Button>
    </Form>
  );
}
