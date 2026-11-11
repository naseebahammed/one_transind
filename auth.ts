import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { inTenant, normalizeEmail } from "@/lib/access";
import { currentRole } from "@/lib/current-role";
import { acquireConcurrency, checkMultiRateLimit, verifyAndConsumeBotChallenge } from "@/lib/rate-limit";
import { adminEmails, entraIssuer, hasAdminPasswordLogin, isDevLoginEnabled, verifyAdminPassword } from "@/lib/server-config";
import { isListedEmail } from "@/lib/users";

const MINUTE = 60_000;

// The provider reads AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET / _ISSUER from the environment.
// Pass a plain object (not a lazy callback): in next-auth v5 beta, NextAuth(fn) makes auth(handler) return a Promise instead of a function, breaking proxy.ts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID,
    // Temporary admin password login: on only while ADMIN_LOGIN_HASH is set. Remove that line from .env to switch it off.
    ...(hasAdminPasswordLogin() ? [Credentials({
      id: "admin-password",
      credentials: { email: {}, password: {}, formToken: {}, website: {} },
      authorize: async (input) => {
        if (!verifyAndConsumeBotChallenge({ token: String(input?.formToken ?? ""), honeypot: String(input?.website ?? "") })) {
          return null;
        }
        const email = normalizeEmail(String(input?.email ?? ""));
        const limitDecision = checkMultiRateLimit([
          { key: `auth:pwd:email:${email || "blank"}`, maxRequests: 5, windowMilliseconds: 15 * MINUTE },
          { key: "global:auth:pwd", maxRequests: 15, windowMilliseconds: 15 * MINUTE },
        ]);
        if (!limitDecision.allowed) return null;

        const release = acquireConcurrency([{ key: "conc:auth:scrypt", maxConcurrent: 2 }]);
        if (!release) return null;

        let validPassword = false;
        try {
          validPassword = verifyAdminPassword(String(input?.password ?? ""));
        } finally {
          release();
        }
        if (validPassword && adminEmails().includes(email)) return { email };
        await new Promise((done) => setTimeout(done, 1000));
        return null;
      },
    })] : []),
    // Test login: type an email, still checked against ADMIN_EMAILS / app.users. Not registered at all in production.
    ...(isDevLoginEnabled() ? [Credentials({
      credentials: { email: {}, formToken: {}, website: {} },
      authorize: async (input) => {
        if (!verifyAndConsumeBotChallenge({ token: String(input?.formToken ?? ""), honeypot: String(input?.website ?? "") })) {
          return null;
        }
        const email = normalizeEmail(String(input?.email ?? ""));
        const limitDecision = checkMultiRateLimit([
          { key: `auth:dev:email:${email || "blank"}`, maxRequests: 10, windowMilliseconds: 5 * MINUTE },
          { key: "global:auth:dev", maxRequests: 20, windowMilliseconds: 5 * MINUTE },
        ]);
        if (!limitDecision.allowed) return null;
        return (await currentRole(email, isListedEmail)) ? { email } : null;
      },
    })] : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/no-access" },
  callbacks: {
    // Same tenant and on the approved list, else Auth.js sends them to /no-access.
    async signIn({ account, profile }) {
      if (account?.type === "credentials") return true; // authorize() already verified admin-password or dev credentials
      if (account?.provider !== "microsoft-entra-id") return false;
      const tenantId = (profile as { tid?: string } | undefined)?.tid;
      const email = (profile as { preferred_username?: string } | undefined)?.preferred_username;
      return inTenant(tenantId, entraIssuer()) && !!(await currentRole(email, isListedEmail));
    },
    jwt({ token, profile, user }) {
      const upn = (profile as { preferred_username?: string } | undefined)?.preferred_username ?? user?.email;
      if (upn) token.email = normalizeEmail(upn);
      const profileName = (profile as { name?: string } | undefined)?.name ?? user?.name;
      if (profileName) token.name = profileName;
      return token;
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email;
      if (typeof token.name === "string") session.user.name = token.name;
      return session;
    },
  },
});
