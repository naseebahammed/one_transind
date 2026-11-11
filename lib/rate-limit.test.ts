import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireConcurrency,
  checkBotProtection,
  checkMultiRateLimit,
  consumeRateLimit,
  extractClientIp,
  issueBotChallenge,
  normalizeIpAddress,
  resetRateLimitState,
  verifyAndConsumeBotChallenge,
} from "./rate-limit.ts";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

function makeHeaders(entries: Record<string, string>): Pick<Headers, "get"> {
  const lower = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

test("sliding-window rate limit blocks bursts across boundaries and recovers after window", () => {
  resetRateLimitState();
  const t0 = 1_700_000_000_000;
  assert.equal(consumeRateLimit("user:a", 3, 60_000, t0).allowed, true);
  assert.equal(consumeRateLimit("user:a", 3, 60_000, t0 + 50_000).allowed, true);
  const third = consumeRateLimit("user:a", 3, 60_000, t0 + 59_000);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  // 500ms later (across a 1-minute mark if fixed-window): sliding window still blocks!
  const fourth = consumeRateLimit("user:a", 3, 60_000, t0 + 59_500);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.retryAfterSeconds, 1);

  // Once t0 expires at t0 + 60_001, exactly 1 slot opens
  assert.equal(consumeRateLimit("user:a", 3, 60_000, t0 + 60_001).allowed, true);
  assert.equal(consumeRateLimit("user:a", 3, 60_000, t0 + 60_002).allowed, false);
});

test("checkMultiRateLimit does not let one rate-limited user exhaust the global bucket for others", () => {
  resetRateLimitState();
  const now = 1_700_000_000_000;
  const rulesFor = (user: string) => [
    { key: `user:${user}`, maxRequests: 2, windowMilliseconds: 60_000 },
    { key: "global:ask", maxRequests: 4, windowMilliseconds: 60_000 },
  ];

  assert.equal(checkMultiRateLimit(rulesFor("alice"), now).allowed, true);
  assert.equal(checkMultiRateLimit(rulesFor("alice"), now + 10).allowed, true);

  // Alice spams 20 extra requests while rate-limited — global quota must NOT be burned
  for (let i = 0; i < 20; i++) {
    assert.equal(checkMultiRateLimit(rulesFor("alice"), now + 20 + i).allowed, false);
  }

  // Bob can still use the remaining 2 global slots
  assert.equal(checkMultiRateLimit(rulesFor("bob"), now + 100).allowed, true);
  assert.equal(checkMultiRateLimit(rulesFor("bob"), now + 110).allowed, true);
  assert.equal(checkMultiRateLimit(rulesFor("charlie"), now + 120).allowed, false);
});

test("acquireConcurrency enforces per-user and global in-flight caps and releases cleanly", () => {
  resetRateLimitState();
  const slot1 = acquireConcurrency([
    { key: "ask:alice", maxConcurrent: 1 },
    { key: "global:ask", maxConcurrent: 2 },
  ]);
  assert.ok(slot1);

  // Second concurrent call by Alice is blocked
  assert.equal(
    acquireConcurrency([
      { key: "ask:alice", maxConcurrent: 1 },
      { key: "global:ask", maxConcurrent: 2 },
    ]),
    null,
  );

  // Bob gets the 2nd global slot
  const slot2 = acquireConcurrency([
    { key: "ask:bob", maxConcurrent: 1 },
    { key: "global:ask", maxConcurrent: 2 },
  ]);
  assert.ok(slot2);

  // Charlie is blocked by global cap = 2
  assert.equal(
    acquireConcurrency([
      { key: "ask:charlie", maxConcurrent: 1 },
      { key: "global:ask", maxConcurrent: 2 },
    ]),
    null,
  );

  slot1();
  slot1(); // idempotent double-release must not underflow
  const slot3 = acquireConcurrency([
    { key: "ask:charlie", maxConcurrent: 1 },
    { key: "global:ask", maxConcurrent: 2 },
  ]);
  assert.ok(slot3);
  slot2();
  slot3();
});

test("extractClientIp ignores spoofed X-Forwarded-For unless trustProxy is enabled and reads rightmost hop", () => {
  const spoofed = makeHeaders({ "x-forwarded-for": "198.51.100.77, 203.0.113.9:51423", "x-real-ip": "198.51.100.88" });
  assert.equal(extractClientIp(spoofed, false), "direct");
  // When behind a trusted proxy (including Windows IIS ip:port), takes rightmost proxy-appended IP and strips port
  assert.equal(extractClientIp(spoofed, true), "ipv4:203.0.113.9");
});

test("normalizeIpAddress groups IPv6 addresses by /64 subnet to block suffix rotation", () => {
  assert.equal(normalizeIpAddress("2001:db8:abcd:12::1"), "ipv6:2001:0db8:abcd:0012/64");
  assert.equal(normalizeIpAddress("[2001:db8:abcd:12:9999:8888:7777:6666]:443"), "ipv6:2001:0db8:abcd:0012/64");
  assert.equal(normalizeIpAddress("::ffff:192.0.2.15"), "ipv4:192.0.2.15");
  assert.equal(normalizeIpAddress("::1"), "loopback");
  assert.equal(normalizeIpAddress("127.0.0.1:3000"), "loopback");
});

test("checkBotProtection blocks CLI tools, scanners, cross-site fetches, and missing/forged POST origins", () => {
  assert.ok(checkBotProtection(makeHeaders({ "user-agent": "curl/8.7.1" })));
  assert.ok(checkBotProtection(makeHeaders({ "user-agent": "python-requests/2.31.0" })));
  assert.ok(checkBotProtection(makeHeaders({ "user-agent": "" })));

  // Legitimate same-origin POST passes
  assert.equal(
    checkBotProtection(
      makeHeaders({
        "user-agent": BROWSER_UA,
        host: "one.transindgroup.com",
        origin: "https://one.transindgroup.com",
        "sec-fetch-site": "same-origin",
      }),
      { method: "POST", requireSameOrigin: true },
    ),
    null,
  );

  // Missing Origin/Referer on POST fails
  assert.ok(
    checkBotProtection(
      makeHeaders({ "user-agent": BROWSER_UA, host: "one.transindgroup.com" }),
      { method: "POST", requireSameOrigin: true },
    ),
  );

  // Cross-origin POST fails
  assert.ok(
    checkBotProtection(
      makeHeaders({
        "user-agent": BROWSER_UA,
        host: "one.transindgroup.com",
        origin: "https://evil.example",
      }),
      { method: "POST", requireSameOrigin: true },
    ),
  );

  // Cross-site top-level GET navigation is permitted ONLY when allowCrossSiteNavigation=true (Microsoft OAuth callback)
  const oauthCallbackHeaders = makeHeaders({
    "user-agent": BROWSER_UA,
    "sec-fetch-site": "cross-site",
    "sec-fetch-mode": "navigate",
  });
  assert.equal(checkBotProtection(oauthCallbackHeaders, { method: "GET", allowCrossSiteNavigation: true }), null);
  assert.ok(checkBotProtection(oauthCallbackHeaders, { method: "GET", allowCrossSiteNavigation: false }));
});

test("bot challenge enforces honeypot, signature, minimum human dwell time, expiry, and single-use replay prevention", () => {
  resetRateLimitState();
  const secret = "unit-test-signing-secret-32-bytes";
  const issuedAt = 1_700_000_000_000;
  const token = issueBotChallenge(issuedAt, secret);

  // Sub-second submission (< 800ms) rejected as automated bot
  assert.equal(verifyAndConsumeBotChallenge({ token, nowMilliseconds: issuedAt + 100, secret }), false);

  // Filled honeypot rejected without consuming valid token logic
  assert.equal(
    verifyAndConsumeBotChallenge({ token, honeypot: "https://spam.bot", nowMilliseconds: issuedAt + 2_000, secret }),
    false,
  );

  // Tampered token rejected
  assert.equal(
    verifyAndConsumeBotChallenge({ token: token.slice(0, -2) + "ff", nowMilliseconds: issuedAt + 2_000, secret }),
    false,
  );

  // Expired token (> 15 min) rejected
  assert.equal(
    verifyAndConsumeBotChallenge({ token, nowMilliseconds: issuedAt + 16 * 60 * 1000, secret }),
    false,
  );

  // Valid human submission after 2 seconds succeeds ONCE, then any replay fails
  assert.equal(verifyAndConsumeBotChallenge({ token, nowMilliseconds: issuedAt + 2_000, secret }), true);
  assert.equal(verifyAndConsumeBotChallenge({ token, nowMilliseconds: issuedAt + 2_500, secret }), false);
});

