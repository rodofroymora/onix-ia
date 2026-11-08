import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { organizations } from '@onix/db';
import type { AppRole } from '../demo-users';
import { loadDemoAuthUser } from '../demo-auth-store';
import { clearFailures, isRateLimited, recordFailure } from '../rate-limit';
import { getDb } from '../db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: AppRole;
      organizationId: string;
      organizationName: string;
    };
  }

  interface User {
    role: AppRole;
    organizationId: string;
    organizationName: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole;
    organizationId?: string;
    organizationName?: string;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Demo',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;
        const key = `login:${email}`;
        if (isRateLimited(key)) return null;
        const user = await loadDemoAuthUser(email, password);
        if (!user) {
          recordFailure(key);
          return null;
        }
        clearFailures(key);
        return user;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.sub = user.id;
      }
      if (trigger === 'update' && session?.organizationId) {
        // Solo consultores pueden cambiar de org; el nombre sale de BD, no del cliente.
        if (token.role !== 'consultant') {
          return token;
        }
        const requestedId = String(session.organizationId);
        try {
          const { db } = getDb();
          const [org] = await db
            .select({ id: organizations.id, name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, requestedId))
            .limit(1);
          if (!org) return token;
          token.organizationId = org.id;
          token.organizationName = org.name;
        } catch {
          return token;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = (token.role as AppRole) ?? 'client_reader';
        session.user.organizationId = token.organizationId ?? '';
        session.user.organizationName = token.organizationName ?? '';
        session.user.email = session.user.email ?? '';
        session.user.name = session.user.name ?? '';
      }
      return session;
    },
  },
  trustHost: true,
};
