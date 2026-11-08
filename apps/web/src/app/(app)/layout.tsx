import { organizations } from '@onix/db';
import { AppNav } from '@/components/shell/AppNav';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { OrgSwitcher } from '@/components/shell/OrgSwitcher';
import { PendingTray } from '@/components/shell/PendingTray';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Providers } from '@/components/shell/Providers';
import { RutaIaStrip } from '@/components/shell/RutaIaStrip';
import { SignOutButton } from '@/components/shell/SignOutButton';
import { getDb } from '@/lib/db';
import { loadShellData } from '@/lib/server/shell';
import { requireSession } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { db } = getDb();
  const orgs =
    session.user.role === 'consultant'
      ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
      : [{ id: session.user.organizationId, name: session.user.organizationName }];
  const shell = await loadShellData(session.user.organizationId);

  return (
    <Providers>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-canvas-elevated md:flex">
          <div className="flex items-center gap-2.5 px-5 pb-2 pt-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink font-display text-[13px] font-semibold text-canvas">
              Ó
            </span>
            <div className="leading-tight">
              <p className="text-[14px] font-semibold tracking-tight text-ink">Ónix Govern</p>
              <p className="truncate text-[11px] text-ink-subtle">{session.user.organizationName}</p>
            </div>
          </div>
          <AppNav role={session.user.role} />
          <div className="mt-auto border-t border-border px-4 py-3">
            <p className="truncate text-[12px] font-medium text-ink">{session.user.name}</p>
            <p className="truncate text-[11px] text-ink-subtle">{session.user.email}</p>
            <div className="mt-2">
              <SignOutButton />
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-canvas/80 px-4 py-2.5 backdrop-blur-xl sm:px-8">
            <p className="text-[14px] font-semibold text-ink md:hidden">Ónix</p>
            <div className="min-w-0 flex-1">
              <RutaIaStrip done={shell.done} />
            </div>
            {orgs.length > 1 ? <OrgSwitcher orgs={orgs} /> : null}
            <CommandPalette items={shell.palette} />
            <ThemeToggle />
            <PendingTray items={shell.pending} />
          </header>
          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
