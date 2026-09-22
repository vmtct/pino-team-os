import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

const STAGING_ORIGIN = "https://pino-team-os-staging.minhtri-van42.workers.dev";
const EMAIL = process.env.PINO_STAGING_STAFF_EMAIL ?? "";
const PASSWORD = process.env.PINO_STAGING_STAFF_PASSWORD ?? "";
const CENTER_KEY = "staging-workforce-staff-checkin-probe";
const RECEIPT_PATH = process.env.PINO_HAPPY_RECEIPT_PATH ?? "";

type WorkforceContext = {
  data: {
    centers: Array<{ id: string; key: string; displayName: string; timeZone: string }>;
  };
};

type CheckInState = {
  data:
    | { kind: "ELIGIBLE_ASSIGNMENT"; assignment: { id: string } }
    | { kind: "NO_ELIGIBLE_ASSIGNMENT" | "REQUESTED" | "APPROVED" | "DECLINED" | "CANCELLED" };
};

type TimekeepingState = {
  data: null | {
    id: string;
    centerId: string;
    assignmentId: string | null;
    status: "OPEN" | "CLOSED";
  };
};

type PresenceSnapshot = {
  data: {
    actors?: Array<{
      actorType?: string;
      sources?: Array<{ sourceType?: string; sourceId?: string }>;
    }>;
  };
};

test.use({ baseURL: STAGING_ORIGIN, viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test("staff login -> briefing -> UI check-in -> API timekeeping/presence verification", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "staging Staff credentials are required");

  await page.goto("/staff-login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Vào PINO Team" }).click();
  await page.waitForURL("**/dashboard");

  const api = page.context().request;
  const contextResponse = await api.get("/api/workforce/context");
  expect(contextResponse.status()).toBe(200);
  const context = await contextResponse.json() as WorkforceContext;
  const center = context.data.centers.find(item => item.key === CENTER_KEY);
  expect(center, "deterministic Staff Check-In Center must exist").toBeTruthy();

  const beforeResponse = await api.get(
    `/api/workforce/timekeeping/current?centerId=${encodeURIComponent(center!.id)}`,
  );
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json() as TimekeepingState;
  expect(before.data, "fixture must begin without an open TimekeepingSession").toBeNull();

  const assignmentResponse = await api.get(
    `/api/workforce/check-in-exceptions/status?centerId=${encodeURIComponent(center!.id)}`,
  );
  expect(assignmentResponse.status()).toBe(200);
  const assignmentState = await assignmentResponse.json() as CheckInState;
  expect(assignmentState.data.kind).toBe("ELIGIBLE_ASSIGNMENT");
  const assignmentId = assignmentState.data.kind === "ELIGIBLE_ASSIGNMENT"
    ? assignmentState.data.assignment.id
    : "";
  expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/);

  await page.goto("/check-in");
  await expect(page.getByText("CA HÔM NAY")).toBeVisible();

  const acknowledge = page.getByRole("button", { name: "Đã đọc & hiểu" });
  if (await acknowledge.isVisible().catch(() => false)) {
    await acknowledge.click();
    await expect(page.getByText("✓ Đã đọc")).toBeVisible();
  }

  await expect(page.getByText("Sẵn sàng vào ca")).toBeVisible();
  await page.getByRole("button", { name: "Check-in", exact: true }).click();
  await page.waitForURL("**/tasks");

  const currentResponse = await api.get(
    `/api/workforce/timekeeping/current?centerId=${encodeURIComponent(center!.id)}`,
  );
  expect(currentResponse.status()).toBe(200);
  const current = await currentResponse.json() as TimekeepingState;
  expect(current.data?.status).toBe("OPEN");
  expect(current.data?.centerId).toBe(center!.id);
  expect(current.data?.assignmentId).toBe(assignmentId);
  const sessionId = current.data?.id ?? "";
  expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

  const presenceResponse = await api.get(
    `/api/pinoria-tv/snapshot?centerId=${encodeURIComponent(center!.id)}`,
  );
  expect(presenceResponse.status()).toBe(200);
  const presence = await presenceResponse.json() as PresenceSnapshot;
  const matchingStaff = (presence.data.actors ?? []).filter(actor =>
    actor.actorType === "STAFF"
    && (actor.sources ?? []).some(source =>
      source.sourceType === "TIMEKEEPING_SESSION" && source.sourceId === sessionId),
  );
  expect(matchingStaff).toHaveLength(1);

  const receipt = {
    schema_version: 1,
    kind: "PINO_HAPPY_JOURNEY_RECEIPT",
    journey_id: "GJ-WFM-STAFF-CHECKIN-01",
    mode: "UI_DRIVEN_API_VERIFIED",
    result: "PASS",
    center_id: center!.id,
    assignment_id: assignmentId,
    timekeeping_session_id: sessionId,
    checks: {
      staff_login_ui: "PASS",
      briefing_gate_ui: "PASS",
      check_in_ui: "PASS",
      core_timekeeping_api: "PASS",
      team_pinoria_presence_api: "PASS",
    },
    generated_at: new Date().toISOString(),
  };
  const checkoutResponse = await api.post("/api/workforce/timekeeping/check-out", {
    headers: { "idempotency-key": `happy-cleanup-${sessionId}` },
    data: {},
  });
  expect(checkoutResponse.status()).toBe(201);

  const afterResponse = await api.get(
    `/api/workforce/timekeeping/current?centerId=${encodeURIComponent(center!.id)}`,
  );
  expect(afterResponse.status()).toBe(200);
  const after = await afterResponse.json() as TimekeepingState;
  expect(after.data).toBeNull();

  if (RECEIPT_PATH) writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2));
  console.log(`PINO_HAPPY_RECEIPT_JSON=${JSON.stringify(receipt)}`);
});
