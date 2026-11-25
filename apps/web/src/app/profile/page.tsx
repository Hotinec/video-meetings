import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { SectionCard } from '@/components/section-card';
import { UnauthorizedError } from '@/lib/meetings';
import { getToken } from '@/lib/session';
import { fetchProfile, type Profile } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const token = await getToken();
  if (!token) redirect('/login');

  let profile: Profile;
  try {
    profile = await fetchProfile(token);
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/api/auth/logout');
    throw err;
  }

  return (
    <main
      className="min-h-screen p-4"
      style={{
        background:
          'radial-gradient(ellipse at 60% 0%, color-mix(in oklch, var(--accent) 12%, transparent) 0%, transparent 60%), var(--background)',
      }}
    >
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-8 py-6">
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="text-sm underline-offset-4 hover:underline focus-visible:underline w-fit"
          >
            ← Back to meetings
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <Avatar username={profile.username} />
            <h1 className="text-xl font-bold">Profile</h1>
          </div>
        </header>

        <SectionCard title="Account" description="Your account details">
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-sm" style={{ color: 'var(--muted)' }}>
                Username
              </dt>
              <dd className="font-medium break-all">{profile.username}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm" style={{ color: 'var(--muted)' }}>
                Email
              </dt>
              <dd className="break-all">{profile.email}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </main>
  );
}
