import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import { authConfig } from './auth.config';
import { users as placeholderUsers } from '@/app/lib/placeholder-data';
import { sqlClient } from '@/app/lib/db';

async function getUser(email: string): Promise<User | undefined> {
  try {
    if (sqlClient) {
      const user = await sqlClient`SELECT * FROM users WHERE email=${email}`;
      if (user && user.length > 0) return user[0];
    }
  } catch (error) {
    // Database might be connecting or offline, fallback to placeholder
  }

  const found = placeholderUsers.find((u) => u.email === email);
  if (found) {
    return {
      id: found.id,
      name: found.name,
      email: found.email,
      password: await bcrypt.hash(found.password, 10),
    };
  }
  return undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret: process.env.AUTH_SECRET || 'antigravity-secret-key-1234567890123456',
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;

          const user = await getUser(email);
          if (!user) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
