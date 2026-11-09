import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { devLoginEnabled, inTenant, normalizeEmail } from "@/lib/access";
import { currentRole } from "@/lib/current-role";
import { listedEmails } from "@/lib/users";

// The provider reads AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET / _ISSUER from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID,
    // Test login: type an email, still checked against ADMIN_EMAILS / app.users. Not registered at all in production.
    ...(devLoginEnabled(process.env) ? [Credentials({
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
      if (account?.provider === "credentials") return true; // only exists when the dev gate is open; authorize() already checked the list
      const tenantId = (profile as { tid?: string } | undefined)?.tid;
      const email = (profile as { preferred_username?: string } | undefined)?.preferred_username;
      return inTenant(tenantId, process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER) && !!(await currentRole(email, listedEmails));
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
