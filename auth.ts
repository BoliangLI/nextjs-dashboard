import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('数据库连接字符串未配置，请设置 POSTGRES_URL 或 DATABASE_URL 环境变量');
}

// SSL 配置：支持 require/prefer/allow/disable
const sslMode = process.env.POSTGRES_SSL_MODE || 'prefer';
const sslConfig = sslMode === 'disable' ? false : sslMode;

const sql = postgres(connectionString, {
  ssl: sslConfig as any,
  max: 1, // seed 只需要一个连接
  idle_timeout: 20,
  connect_timeout: 10,
});

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Credentials({
    async authorize(credentials) {
      const parsedCredentials = z
        .object({ email: z.string().email(), password: z.string().min(6) })
        .safeParse(credentials);
      if (parsedCredentials.success) {
        const { email, password } = parsedCredentials.data;
        const user = await getUser(email);
        console.log('user',user);
        if (!user) return null;
        const passwordsMatch = await bcrypt.compare(password, user.password);
 
        if (passwordsMatch) {
          return user;
        }
      }

      console.log('Invalid credentials');
      return null;
    },
  })],
});