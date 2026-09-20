import { test, expect } from "@playwright/test";

const STAGING_ORIGIN = "https://pino-team-os-staging.minhtri-van42.workers.dev";
const EMAIL = process.env.PINO_STAGING_STAFF_EMAIL ?? "";
const PASSWORD = process.env.PINO_STAGING_STAFF_PASSWORD ?? "";
const CENTER_KEY = "staging-workforce-exception-probe";

test.use({ baseURL: STAGING_ORIGIN });
test.describe.configure({ mode: "serial" });

test("unscheduled request -> manager approval -> canonical normal-check-in handoff", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "staging staff credentials are required");

  const login = await page.request.post("/api/staff-auth/login", { data: { email: EMAIL, password: PASSWORD } });
  expect(login.status()).toBe(200);

  const contextResponse = await page.request.get("/api/workforce/context");
  expect(contextResponse.status()).toBe(200);
  const context = await contextResponse.json() as { data: { centers: Array<{ id: string; key: string }> } };
  const center = context.data.centers.find(item => item.key === CENTER_KEY);
  expect(center).toBeTruthy();

  const beforeResponse = await page.request.get(`/api/workforce/check-in-exceptions/status?centerId=${encodeURIComponent(center!.id)}`);
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json() as { data: { kind: string } };
  expect(before.data.kind).toBe("NO_ELIGIBLE_ASSIGNMENT");

  const requestKey = `staging-wfm-exc-request-${Date.now()}`;
  const requestResponse = await page.request.post("/api/workforce/check-in-exceptions", {
    headers: { "idempotency-key": requestKey },
    data: { centerId: center!.id, reason: "Golden Journey staging verification" },
  });
  expect(requestResponse.status()).toBe(201);
  const requested = await requestResponse.json() as { data: { id: string; version: number; status: string } };
  expect(requested.data.status).toBe("REQUESTED");

  const queueResponse = await page.request.get(`/api/bo/workforce/planning/check-in-exceptions?centerId=${encodeURIComponent(center!.id)}&status=REQUESTED`);
  expect(queueResponse.status()).toBe(200);
  const queue = await queueResponse.json() as { data: Array<{ id: string; version: number }> };
  const queued = queue.data.find(item => item.id === requested.data.id);
  expect(queued).toBeTruthy();

  const approveResponse = await page.request.post(`/api/bo/workforce/planning/check-in-exceptions/${requested.data.id}/approve`, {
    headers: { "idempotency-key": `staging-wfm-exc-approve-${Date.now()}` },
    data: { expectedVersion: queued!.version },
  });
  expect(approveResponse.status()).toBe(200);
  const approved = await approveResponse.json() as { data: { status: string; generatedAssignmentId: string | null } };
  expect(approved.data.status).toBe("APPROVED");
  expect(approved.data.generatedAssignmentId).toMatch(/^[0-9a-f-]{36}$/);

  const afterResponse = await page.request.get(`/api/workforce/check-in-exceptions/status?centerId=${encodeURIComponent(center!.id)}`);
  expect(afterResponse.status()).toBe(200);
  const after = await afterResponse.json() as { data: { kind: string; assignment?: { id: string } } };
  expect(after.data.kind).toBe("ELIGIBLE_ASSIGNMENT");
  expect(after.data.assignment?.id).toBe(approved.data.generatedAssignmentId);
});
