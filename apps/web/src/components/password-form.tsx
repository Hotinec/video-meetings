'use client';

import { useState } from 'react';
import { Button, Form, Input, Label, Spinner } from '@heroui/react';

const DANGER_TEXT = 'color-mix(in oklch, var(--danger), black 45%)';
const GENERIC_ERROR = 'Could not change your password. Please try again.';

const FIELDS = [
  { id: 'old-password', label: 'Current password', key: 'old', autoComplete: 'current-password' },
  { id: 'new-password', label: 'New password', key: 'next', autoComplete: 'new-password' },
  {
    id: 'confirm-password',
    label: 'Confirm new password',
    key: 'confirm',
    autoComplete: 'new-password',
  },
] as const;

const EMPTY = { old: '', next: '', confirm: '' };

export function PasswordForm() {
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    if (values.next !== values.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: values.old, newPassword: values.next }),
      });
      const body = res.ok ? null : await res.json().catch(() => null);
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      // A wrong old password is also a 401 (with its own message); only a bare
      // "Unauthorized" or a missing user means the session is gone.
      if ((res.status === 401 && message === 'Unauthorized') || res.status === 404) {
        window.location.assign('/api/auth/logout');
        return;
      }
      if (!res.ok) {
        setError(typeof message === 'string' && message ? message : GENERIC_ERROR);
        return;
      }
      setValues(EMPTY);
      setSaved(true);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {FIELDS.map(({ id, label, key, autoComplete }) => (
        <div key={id} className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{label}</Label>
          <Input
            id={id}
            type="password"
            variant="primary"
            fullWidth
            required
            className="min-h-11"
            autoComplete={autoComplete}
            value={values[key]}
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              setSaved(false);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'password-error' : undefined}
          />
        </div>
      ))}

      {error && (
        <p
          id="password-error"
          role="alert"
          className="text-sm px-3 py-2 rounded-lg"
          style={{ color: DANGER_TEXT, background: 'var(--danger-soft)' }}
        >
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm" style={{ color: 'var(--foreground)' }}>
          Password changed.
        </p>
      )}

      <Button type="submit" variant="primary" isDisabled={isLoading} className="w-fit min-h-11">
        {isLoading ? (
          <>
            <Spinner size="sm" color="current" />
            Changing…
          </>
        ) : (
          'Change password'
        )}
      </Button>
    </Form>
  );
}
