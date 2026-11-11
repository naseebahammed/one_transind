import { cacheLife, cacheTag } from "next/cache";
import { q } from "@/lib/db";
import { buildReports, REPORTS_CACHE_TAG } from "@/lib/reports";

/** Cross-request cached company reports, expired immediately via updateTag(REPORTS_CACHE_TAG) when figures, accounts or companies change. */
export async function loadCachedReports() {
  "use cache";
  cacheTag(REPORTS_CACHE_TAG);
  cacheLife("hours");
  return buildReports(q);
}
