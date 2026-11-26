'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, Label, Spinner } from '@heroui/react';
import { AVATAR_ACCEPT, validateAvatar } from '@/lib/avatar-rules';

const DANGER_TEXT = 'color-mix(in oklch, var(--danger), black 45%)';

export function AvatarForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
    };
  }, [file]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setSaved(false);
    const problem = next ? validateAvatar(next) : null;
    setError(problem);
    setFile(next && !problem ? next : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSaved(false);
    setError(null);
    setIsLoading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/users/me/avatar', { method: 'POST', body });
      if (res.status === 401 || res.status === 404) {
        window.location.assign('/api/auth/logout');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
        setError(
          typeof message === 'string' && message
            ? message
            : 'Could not save your avatar. Please try again.',
        );
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not save your avatar. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avatar">Avatar</Label>
        <input
          id="avatar"
          type="file"
          accept={AVATAR_ACCEPT}
          onChange={handleChange}
          className="text-sm min-h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'avatar-error' : undefined}
        />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          JPEG, PNG or WebP, up to 5 MB.
        </p>
      </div>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Preview of the selected avatar"
          className="w-24 h-24 rounded-full object-cover"
        />
      )}

      {error && (
        <p
          id="avatar-error"
          role="alert"
          className="text-sm px-3 py-2 rounded-lg"
          style={{ color: DANGER_TEXT, background: 'var(--danger-soft)' }}
        >
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm" style={{ color: 'var(--foreground)' }}>
          Avatar saved.
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        isDisabled={isLoading || !file}
        className="w-fit min-h-11"
      >
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
