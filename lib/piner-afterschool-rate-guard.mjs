// PAP-1887 — Afterschool Secure PIN Session (Epic PAP-1832 PNR-IDENTITY).
// Durable Object rate limiter; no action to bypass, reset or reveal counters.
const ACTIONS = new Set(["login", "change", "session", "logout"]);
const WINDOW_MS = 15 * 60 * 1000;
// Conservative per-IP + per-action limit; Core adds account/PIN lockout.
const LIMITS = Object.freeze({ login: 10, change: 10, session: 180, logout: 15 });
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const unavailable = () => new Response(null, { status: 503, headers: NO_STORE });

export class PinerAfterschoolRateGuard {
  constructor(state) {
    this.state = state;
    this.clock = () => Date.now();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/check" || url.search) {
      return new Response(null, { status: 404, headers: NO_STORE });
    }
    let action;
    try {
      if ((Number(request.headers.get("content-length")) || 0) > 128) return unavailable();
      const raw = await request.text();
      if (raw.length > 128) return unavailable();
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)
        || Object.keys(data).length !== 1 || !ACTIONS.has(data.action)) {
        return new Response(null, { status: 400, headers: NO_STORE });
      }
      action = data.action;
    } catch {
      return new Response(null, { status: 400, headers: NO_STORE });
    }
    try {
      const now = this.clock();
      const key = "rate-window-v1";
      let allowed = false;
      await this.state.storage.transaction(async (tx) => {
        const old = await tx.get(key);
        const fresh = !old || !Number.isFinite(old.resetAt) || old.resetAt <= now;
        const current = fresh ? { attempts: 0, resetAt: now + WINDOW_MS } : old;
        if (current.attempts >= LIMITS[action]) return;
        await tx.put(key, { attempts: current.attempts + 1, resetAt: current.resetAt });
        allowed = true;
      });
      return new Response(null, { status: allowed ? 200 : 429, headers: NO_STORE });
    } catch {
      return unavailable();
    }
  }
}
