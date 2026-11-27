import { connection } from "next/server";
import { normalizeEmail } from "@/lib/access";
import { apiGuard, requireUser } from "@/lib/guard";
import { reportCursor, watchedCursor } from "@/lib/follow-rules";
import { acceptInvite, answerFollow, cancelInvite, declineInvite, followState, inviteFollowers, reportPresence, requestFollow, stopFollow } from "@/lib/following";

const NO_STORE = { "Cache-Control": "no-store" };

/** One endpoint for the follow bar: every call reports my page, optionally does one action, and returns the current follow state. */
export async function POST(req: Request) {
  return apiGuard(req, "user", "follow", async () => {
    await connection();
    const { email, modules } = await requireUser();
    const me = normalizeEmail(email);

    const raw = await req.text();
    let body: { action?: unknown; person?: unknown; people?: unknown; path?: unknown; cursor?: unknown; light?: unknown } = {};
    if (raw.length <= 4_096) {
      try { body = JSON.parse(raw); } catch { body = {}; }
    }

    reportCursor(me, body.cursor);
    // A "light" call only moves mouse pointers, so beyond the sign-in check it never touches the database.
    if (body.light === true) return Response.json({ cursor: watchedCursor(me) }, { headers: NO_STORE });
    await reportPresence(me, body.path);

    let error: string | undefined;
    const person = typeof body.person === "string" && body.person.length <= 254 ? body.person : "";
    const people = Array.isArray(body.people)
      ? body.people.filter((p): p is string => typeof p === "string" && p.length <= 254).slice(0, 20)
      : [];

    if (body.action === "invite") {
      error = (await inviteFollowers(me, people.length > 0 ? people : person ? [person] : [])).error;
    } else if (person) {
      if (body.action === "request") error = (await requestFollow(me, person)).error;
      else if (body.action === "accept") error = (await answerFollow(me, person, true)).error;
      else if (body.action === "decline") await answerFollow(me, person, false);
      else if (body.action === "stop") await stopFollow(me, person);
      else if (body.action === "accept-invite") error = (await acceptInvite(me, person)).error;
      else if (body.action === "decline-invite") declineInvite(me, person);
      else if (body.action === "cancel-invite") cancelInvite(me, person);
    }

    return Response.json({ ...(await followState(me, modules)), error }, { headers: NO_STORE });
  });
}
