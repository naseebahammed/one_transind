import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { inTenant, normalizeEmail } from "@/lib/access";
import { currentRole } from "@/lib/current-role";
import { listedEmails } from "@/lib/users";

// The provider reads AUTH_MICROSOFT_ENTRA_ID_ID / _SECRET / _ISSUER from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/no-access" },
  callbacks: {
    // Same tenant and on the approved list, else Auth.js sends them to /no-access.
    async signIn({ profile }) {
      const tenantId = (profile as { tid?: string } | undefined)?.tid;
      const email = (profile as { preferred_username?: string } | undefined)?.preferred_username;
      return inTenant(tenantId, process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER) && !!(await currentRole(email, listedEmails));
    },
    jwt({ token, profile }) {
      const upn = (profile as { preferred_username?: string } | undefined)?.preferred_username;
      if (upn) token.email = normalizeEmail(upn);
      return token;
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
});
