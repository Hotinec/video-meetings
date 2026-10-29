import { redirect } from 'next/navigation';
import { CalendarIcon, VideoIcon } from '@/components/icons';
import { LogoutButton } from '@/components/logout-button';
import { SectionCard } from '@/components/section-card';
import { fetchMeetings, UnauthorizedError, type Meeting } from '@/lib/meetings';
import { emailFromToken, getToken } from '@/lib/session';

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
          <span className="font-medium break-words min-w-0">{m.title}</span>
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
  try {
    meetings = await fetchMeetings(token);
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/api/auth/logout');
    throw err;
  }

  const email = emailFromToken(token);
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
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 text-[var(--accent-foreground)]"
              style={{ background: 'var(--accent)' }}
            >
              <VideoIcon />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold">Video Meetings</h1>
              <p
                className="text-sm break-all"
                style={{ color: 'color-mix(in oklch, var(--muted), black 25%)' }}
              >
                Signed in as <span style={{ color: 'var(--foreground)' }}>{email}</span>
              </p>
            </div>
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
