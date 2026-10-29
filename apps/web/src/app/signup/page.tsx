'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Form, InputGroup, Label, Spinner } from '@heroui/react';
import { AuthShell } from '@/components/auth-shell';
import { EnvelopeIcon, EyeIcon, EyeOffIcon, LockIcon } from '@/components/icons';
import { registerUser } from '@/lib/auth';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await registerUser(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Welcome to">
      {/* Card */}
      <Card variant="default">
        <Card.Header>
          <Card.Title className="text-xl font-semibold" render={(props) => <h2 {...props} />}>
            Create your account
          </Card.Title>
          <Card.Description>Start hosting and joining video meetings in seconds</Card.Description>
        </Card.Header>

        <Card.Content>
          <Form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" isRequired>
                Email address
              </Label>
              <InputGroup variant="primary" fullWidth className="min-h-11">
                <InputGroup.Prefix>
                  <span style={{ color: 'var(--muted)' }}>
                    <EnvelopeIcon />
                  </span>
                </InputGroup.Prefix>
                <InputGroup.Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'form-error' : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </InputGroup>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" isRequired>
                Password
              </Label>
              <InputGroup variant="primary" fullWidth className="min-h-11">
                <InputGroup.Prefix>
                  <span style={{ color: 'var(--muted)' }}>
                    <LockIcon />
                  </span>
                </InputGroup.Prefix>
                <InputGroup.Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'form-error' : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <InputGroup.Suffix>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="-mr-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    style={{ color: 'var(--muted)' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </InputGroup.Suffix>
              </InputGroup>
            </div>

            {/* Error */}
            {error && (
              <p
                id="form-error"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="text-sm px-3 py-2 rounded-lg outline-none"
                style={{
                  color: 'color-mix(in oklch, var(--danger), black 45%)',
                  background: 'var(--danger-soft)',
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <Button type="submit" variant="primary" size="lg" fullWidth isDisabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner size="sm" color="current" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </Form>
        </Card.Content>

        <Card.Footer>
          <p className="text-sm text-center w-full" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link
              href="/login"
              style={{ color: 'var(--accent)' }}
              className="inline-flex min-h-11 items-center px-1 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </Card.Footer>
      </Card>

      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        By creating an account, you agree to our Terms of Service and Privacy Policy.
      </p>
    </AuthShell>
  );
}
