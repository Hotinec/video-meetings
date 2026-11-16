import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarIcon } from '@/components/icons';
import { FilesPanel } from '@/components/files-panel';
import { SectionCard } from '@/components/section-card';
import {
  fetchMeeting,
  MeetingNotFoundError,
  UnauthorizedError,
  type Meeting,
} from '@/lib/meetings';
import { getToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const token = await getToken();
  if (!token) redirect('/login');

  let meeting: Meeting;
  try {
    meeting = await fetchMeeting(token, Number(id));
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/api/auth/logout');
    if (err instanceof MeetingNotFoundError) notFound();
    throw err;
  }

  return (
    <main
      className="min-h-screen p-4"
      style={{
        background:
          'radial-gradient(ellipse at 60% 0%, color-mix(in oklch, var(--accent) 12%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, color-mix(in oklch, var(--accent) 8%, transparent) 0%, transparent 50%), var(--background)',
      }}
    >
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-8 py-6">
        <header className="flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex items-center min-h-11 text-sm font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            ← All meetings
          </Link>
          <h1 className="text-2xl font-bold break-words">{meeting.title}</h1>
          <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--muted)' }}>
            <CalendarIcon />
            <time dateTime={meeting.date}>{dateFormat.format(new Date(meeting.date))}</time>
          </p>
        </header>

        <SectionCard title="Files" description="Documents and recordings shared in this meeting">
          <FilesPanel meetingId={meeting.id} />
        </SectionCard>
      </div>
    </main>
  );
}
