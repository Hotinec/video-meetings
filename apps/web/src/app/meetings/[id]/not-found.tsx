import Link from 'next/link';

export default function MeetingNotFound() {
  return (
    <main className="min-h-screen p-4 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-xl font-bold">Meeting not found</h1>
        <Link
          href="/"
          className="inline-flex items-center min-h-11 font-medium underline underline-offset-4"
          style={{ color: 'var(--accent)' }}
        >
          Back to all meetings
        </Link>
      </div>
    </main>
  );
}
