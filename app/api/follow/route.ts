import { connection } from "next/server";
import { normalizeEmail } from "@/lib/access";
import { apiGuard, requireUser } from "@/lib/guard";
import { answerFollow, followState, reportCursor, reportPresence, requestFollow, stopFollow } from "@/lib/following";

const NO_STORE = { "Cache-Control": "no-store" };

/** One endpoint for the follow bar: every call reports my page, optionally does one action, and returns the current follow state. */
export async function POST(req: Request) {
  return apiGuard(req, "user", "follow", async () => {
    await connection();
    const { email } = await requireUser();
    const me = normalizeEmail(email);

    const raw = await req.text();
    let body: { action?: unknown; person?: unknown; path?: unknown; cursor?: unknown } = {};
    if (raw.length <= 2_048) {
      try { body = JSON.parse(raw); } catch { body = {}; }
    }

    await reportPresence(me, body.path);
    reportCursor(me, body.cursor);

    let error: string | undefined;
    const person = typeof body.person === "string" && body.person.length <= 254 ? body.person : "";
    if (person) {
      if (body.action === "request") error = (await requestFollow(me, person)).error;
      else if (body.action === "accept") error = (await answerFollow(me, person, true)).error;
      else if (body.action === "decline") await answerFollow(me, person, false);
      else if (body.action === "stop") await stopFollow(me, person);
    }

    return Response.json({ ...(await followState(me)), error }, { headers: NO_STORE });
  });
}
