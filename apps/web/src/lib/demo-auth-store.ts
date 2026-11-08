import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppRole } from './demo-users';
import { findDemoUser } from './demo-users';

interface DemoAuthSnapshot {
  organizationId: string;
  organizationName: string;
  users: { id: string; email: string; name: string }[];
}

function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, '.data', 'demo-auth.json'))) return dir;
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function loadDemoAuthUser(email: string, password: string): {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  organizationId: string;
  organizationName: string;
} | null {
  const demo = findDemoUser(email, password);
  if (!demo) return null;

  const snapshotPath = path.join(findRepoRoot(), '.data', 'demo-auth.json');
  if (!existsSync(snapshotPath)) return null;

  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as DemoAuthSnapshot;
  const user = snapshot.users.find((u) => u.email === demo.email);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: demo.role,
    organizationId: snapshot.organizationId,
    organizationName: snapshot.organizationName,
  };
}
