import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { AppRole } from '../demo-users';
import { loadDemoAuthUser } from '../demo-auth-store';

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
        const email = String(credentials?.email ?? '');
        const password = String(credentials?.password ?? '');
        // Snapshot de seed (.data/demo-auth.json) — evita PGlite en el hot path de Auth.js.
        const user = loadDemoAuthUser(email, password);
        if (!user) return null;
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
        token.organizationId = session.organizationId as string;
        if (session.organizationName) {
          token.organizationName = session.organizationName as string;
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
