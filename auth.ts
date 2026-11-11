import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { inTenant, normalizeEmail } from "@/lib/access";
import { currentRole } from "@/lib/current-role";
import { adminEmails, entraIssuer, hasAdminPasswordLogin, isDevLoginEnabled, verifyAdminPassword } from "@/lib/server-config";
import { listedEmails } from "@/lib/users";

// The provider reads AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET / _ISSUER from the environment.
// Pass a plain object (not a lazy callback): in next-auth v5 beta, NextAuth(fn) makes auth(handler) return a Promise instead of a function, breaking proxy.ts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID,
    // Temporary admin password login: on only while ADMIN_LOGIN_HASH is set. Remove that line from .env to switch it off.
    ...(hasAdminPasswordLogin() ? [Credentials({
      id: "admin-password",
      credentials: { email: {}, password: {} },
      authorize: async (input) => {
        const email = normalizeEmail(String(input?.email ?? ""));
        const validPassword = verifyAdminPassword(String(input?.password ?? ""));
        if (validPassword && adminEmails().includes(email)) return { email };
        await new Promise((done) => setTimeout(done, 1000)); // shortcut: a fixed 1s delay slows guessing but is not a lockout; add one if this stays past the temporary period
        return null;
      },
    })] : []),
    // Test login: type an email, still checked against ADMIN_EMAILS / app.users. Not registered at all in production.
    ...(isDevLoginEnabled() ? [Credentials({
      credentials: { email: {} },
      authorize: async (input) => {
        const email = normalizeEmail(String(input?.email ?? ""));
        return (await currentRole(email, listedEmails)) ? { email } : null;
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
      return inTenant(tenantId, entraIssuer()) && !!(await currentRole(email, listedEmails));
    },
    jwt({ token, profile, user }) {
      const upn = (profile as { preferred_username?: string } | undefined)?.preferred_username ?? user?.email;
      if (upn) token.email = normalizeEmail(upn);
      return token;
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
});
