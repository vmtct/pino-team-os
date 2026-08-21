import { test, expect, type APIResponse } from "@playwright/test";

const CANONICAL_TOS_ORIGIN = "https://tos.pinohouse.art";
const RETIRED_TEAM_ORIGIN = "https://team.pinohouse.art";
const LEGACY_WORKERS_DEV_ORIGIN = "https://pino-team-os.minhtri-van42.workers.dev";
const configuredOrigin = new URL(process.env.E2E_BASE_URL ?? CANONICAL_TOS_ORIGIN).origin;

function expectCloudflareAccessChallenge(response: APIResponse) {
  expect([302, 303, 307, 401, 403]).toContain(response.status());
  expect(response.status()).not.toBe(200);

  const location = response.headers()["location"];
  const challenge = response.headers()["www-authenticate"] ?? "";
  if (response.status() >= 300 && response.status() < 400) {
    expect(location).toBeTruthy();
    const login = new URL(location!);
    expect(login.protocol).toBe("https:");
    expect(login.hostname).toMatch(/\.cloudflareaccess\.com$/);
    expect(login.pathname).toContain("/cdn-cgi/access/login/tos.pinohouse.art");
  } else {
    expect(challenge).toContain("Cloudflare-Access");
  }
}

test.describe("PINO Team OS canonical production perimeter", () => {
  test("the configured target is the canonical TOS origin", () => {
    expect(configuredOrigin).toBe(CANONICAL_TOS_ORIGIN);
  });

  for (const pathname of ["/", "/api/workforce/context"]) {
    test(`${pathname} requires Cloudflare Access`, async ({ request }) => {
      const response = await request.get(pathname, { maxRedirects: 0 });
      expectCloudflareAccessChallenge(response);
    });
  }

  test("the retired team hostname is absent and never redirects", async ({ request }) => {
    try {
      const response = await request.get(RETIRED_TEAM_ORIGIN, {
        failOnStatusCode: false,
        maxRedirects: 0,
        timeout: 10_000,
      });
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.headers()["location"]).toBeUndefined();
    } catch (error) {
      expect(String(error)).toMatch(/ENOTFOUND|ERR_NAME_NOT_RESOLVED|getaddrinfo|Could not resolve/i);
    }
  });

  test("the public workers.dev hostname is not an application bypass", async ({ request }) => {
    const response = await request.get(LEGACY_WORKERS_DEV_ORIGIN, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  // BO intentionally has no automated production assertion until its domain and Access app are live.
  // Authenticated TOS self-context checks likewise remain an explicit authorized rollout smoke.
});
