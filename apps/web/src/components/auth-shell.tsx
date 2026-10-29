import { VideoIcon } from '@/components/icons';

export function AuthShell({ children, eyebrow }: { children: React.ReactNode; eyebrow: string }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at 60% 0%, color-mix(in oklch, var(--accent) 12%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, color-mix(in oklch, var(--accent) 8%, transparent) 0%, transparent 50%), var(--background)',
      }}
    >
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl text-[var(--accent-foreground)]"
            style={{ background: 'var(--accent)' }}
          >
            <VideoIcon />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
              {eyebrow}
            </p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Video Meetings
            </h1>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
