import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { CalendarIcon } from '@/components/icons';
import { LogoutButton } from '@/components/logout-button';
import { SectionCard } from '@/components/section-card';
import { fetchMeetings, UnauthorizedError, type Meeting } from '@/lib/meetings';
import { getToken } from '@/lib/session';
import { fetchProfile, type Profile } from '@/lib/users';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

function MeetingList({ meetings }: { meetings: Meeting[] }) {
  return (
    <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
      {meetings.map((m) => (
        <li
          key={m.id}
          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 py-3 first:pt-0 last:pb-0"
        >
          <Link
            href={`/meetings/${m.id}`}
            className="font-medium break-words min-w-0 underline-offset-4 hover:underline focus-visible:underline"
          >
            {m.title}
          </Link>
          <span
            className="flex items-center gap-1.5 text-sm shrink-0"
            style={{ color: 'var(--muted)' }}
          >
            <CalendarIcon />
            <time dateTime={m.date}>{dateFormat.format(new Date(m.date))}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  const token = await getToken();
  if (!token) redirect('/login');

  let meetings: Meeting[];
  let profile: Profile;
  try {
    [meetings, profile] = await Promise.all([fetchMeetings(token), fetchProfile(token)]);
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/api/auth/logout');
    throw err;
  }

  const recent = meetings.slice(0, 3);

  return (
    <main
      className="min-h-screen p-4"
      style={{
        background:
          'radial-gradient(ellipse at 60% 0%, color-mix(in oklch, var(--accent) 12%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, color-mix(in oklch, var(--accent) 8%, transparent) 0%, transparent 50%), var(--background)',
      }}
    >
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-8 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-xl font-bold">Video Meetings</h1>
            <Link
              href="/profile"
              className="flex items-center gap-3 min-w-0 min-h-11 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Avatar username={profile.username} />
              <span
                className="text-sm break-all"
                style={{ color: 'color-mix(in oklch, var(--muted), black 25%)' }}
              >
                Signed in as <span style={{ color: 'var(--foreground)' }}>{profile.username}</span>
              </span>
            </Link>
          </div>
          <LogoutButton />
        </header>

        <SectionCard
          title="Latest meetings"
          description="Your three most recently created meetings"
        >
          {recent.length ? (
            <MeetingList meetings={recent} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No meetings yet.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="All meetings"
          description={`${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'} created`}
        >
          {meetings.length ? (
            <MeetingList meetings={meetings} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              You haven&apos;t created any meetings yet.
            </p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
