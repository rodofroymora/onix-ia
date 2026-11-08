import { organizations } from '@onix/db';
import { AppNav } from '@/components/shell/AppNav';
import { CommandPaletteStub } from '@/components/shell/CommandPaletteStub';
import { OrgSwitcher } from '@/components/shell/OrgSwitcher';
import { PendingTrayStub } from '@/components/shell/PendingTrayStub';
import { Providers } from '@/components/shell/Providers';
import { RutaIaStrip } from '@/components/shell/RutaIaStrip';
import { SignOutButton } from '@/components/shell/SignOutButton';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { db } = getDb();
  const orgs =
    session.user.role === 'consultant'
      ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
      : [{ id: session.user.organizationId, name: session.user.organizationName }];

  return (
    <Providers>
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-border bg-surface/70 md:flex md:flex-col">
          <div className="border-b border-border px-4 py-5">
            <p className="font-display text-lg tracking-tight text-ink">Ónix</p>
            <p className="text-xs text-ink-subtle">Govern</p>
          </div>
          <AppNav role={session.user.role} />
          <div className="mt-auto space-y-2 border-t border-border p-3">
            <p className="truncate text-xs text-ink-muted">{session.user.name}</p>
            <p className="truncate text-[11px] text-ink-subtle">{session.user.email}</p>
            <SignOutButton />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-canvas-elevated/90 px-4 py-3 backdrop-blur">
            <div className="md:hidden">
              <p className="font-display text-base text-ink">Ónix Govern</p>
            </div>
            <div className="min-w-0 flex-1">
              <RutaIaStrip />
            </div>
            <OrgSwitcher orgs={orgs} />
            <CommandPaletteStub />
            <PendingTrayStub />
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
