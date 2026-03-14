import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "jsmith@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1. Validate input
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // 2. Find the user in the database
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) },
        });

        // 3. If no user or no password (meaning they signed up with OAuth earlier), reject
        if (!user || !user.password) {
          return null;
        }

        // 4. Check if the password matches
        const isPasswordValid = await bcrypt.compare(
          String(credentials.password),
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        // 5. Return the user object if successful
        return user;
      },
    }),
  ],
});

export const { GET, POST } = handlers;
