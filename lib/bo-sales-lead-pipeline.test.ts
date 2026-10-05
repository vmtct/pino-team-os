import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import { BO_HOSTNAME, decideHostBoundary } from "./host-boundary";

const token = "local-password-session";
const intentId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const centerId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";
const env = (binding: BoAccessCoreBinding): BoReadEnv & BoWriteEnv => ({ PINO_BO_CORE: binding });

test("PLT-SALES F0 forwards bounded Lead queue/detail reads to canonical Core", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request) { forwarded.push(request); return { status: 200, body: { data: [] }, requestId: "sales-read" }; } };
  const request = new Request(`https://bo.pinohouse.art/api/bo/acquisition/intents?status=CONTACTED&limit=25&centerId=${centerId}&userId=forged`, { headers: { cookie: `pino_staff_password_session=${token}` } });
  assert.equal((await handleBoOperationalReadRequest(request, env(binding), "acquisition/intents")).status, 200);
  const centers = new Request("https://bo.pinohouse.art/api/bo/acquisition/centers", { headers: { cookie: `pino_staff_password_session=${token}` } });
  assert.equal((await handleBoOperationalReadRequest(centers, env(binding), "acquisition/centers")).status, 200);
  const detail = new Request(`https://bo.pinohouse.art/api/bo/acquisition/intents/${intentId}`, { headers: { cookie: `pino_staff_password_session=${token}` } });
  assert.equal((await handleBoOperationalReadRequest(detail, env(binding), `acquisition/intents/${intentId}`)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: "acquisition/intents", body: { status: "CONTACTED", limit: 25, centerId } },
    { method: "GET", path: "acquisition/centers" },
    { method: "GET", path: `acquisition/intents/${intentId}` },
  ]);
});
test("PLT-SALES F0 lifecycle commands require and preserve idempotency", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request) { forwarded.push(request); return { status: 200, body: { data: { ok: true } }, requestId: "sales-write" }; } };
  const path = `acquisition/intents/${intentId}/contacted`;
  const withoutKey = new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { cookie: `pino_staff_password_session=${token}`, "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 2 }) });
  assert.equal((await handleBoWriteRequest(withoutKey, env(binding), path)).status, 400);
  assert.equal(forwarded.length, 0);
  const withKey = new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { cookie: `pino_staff_password_session=${token}`, "content-type": "application/json", "idempotency-key": "lead-command-1" }, body: JSON.stringify({ expectedVersion: 2 }) });
  assert.equal((await handleBoWriteRequest(withKey, env(binding), path)).status, 200);
  assert.deepEqual(forwarded, [{ method: "POST", path, body: { expectedVersion: 2 }, idempotencyKey: "lead-command-1" }]);
});

test("PLT-LEAD F1 manual create requires idempotency and forwards only the canonical command", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request) { forwarded.push(request); return { status: 201, body: { data: { leadId: "lead", intentId, status: "SUBMITTED", nextStep: "MANUAL_CONTACT" } }, requestId: "sales-create" }; } };
  const path = "acquisition/intents";
  const body = { centerId, phone: "0901234567", sourceBrand: "PINO_HOUSE", intentKind: "GENERAL_INQUIRY", childAge: 8 };
  const withoutKey = new Request("https://bo.pinohouse.art/api/bo/acquisition/intents", { method: "POST", headers: { cookie: `pino_staff_password_session=${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await handleBoWriteRequest(withoutKey, env(binding), path)).status, 400);
  assert.equal(forwarded.length, 0);

  const withKey = new Request("https://bo.pinohouse.art/api/bo/acquisition/intents", { method: "POST", headers: { cookie: `pino_staff_password_session=${token}`, "content-type": "application/json", "idempotency-key": "lead-create-1" }, body: JSON.stringify(body) });
  assert.equal((await handleBoWriteRequest(withKey, env(binding), path)).status, 201);
  assert.deepEqual(forwarded, [{ method: "POST", path, body, idempotencyKey: "lead-create-1" }]);
});

test("PLT-SALES F0 keeps Lead surface BO-only and host-bounded", () => {
  for (const path of ["/bo/sales/leads", "/api/bo/acquisition/centers", "/api/bo/acquisition/intents", `/api/bo/acquisition/intents/${intentId}`, `/api/bo/acquisition/intents/${intentId}/verify-contact`, `/api/bo/acquisition/intents/${intentId}/close`]) {
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, path), { action: "next" }, path);
  }
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, "/api/bo/acquisition/leads"), { action: "not_found" });
});
test("PLT-SALES F0 presentation composes Core contracts without local CRM authority", async () => {
  const [navigation, view, api] = await Promise.all([
    readFile("app/bo/navigation.ts", "utf8"),
    readFile("app/bo/sales/leads/SalesLeadPipelineView.tsx", "utf8"),
    readFile("lib/bo-api.ts", "utf8"),
  ]);
  assert.match(navigation, /href: "\/bo\/sales\/leads", label: "Leads"/);
  for (const method of ["acquisitionCenters", "acquisitionIntents", "acquisitionIntent", "createAcquisitionIntent", "markAcquisitionContacted", "verifyAcquisitionContact", "closeAcquisitionIntent"]) assert.match(api, new RegExp(`${method}:`));
  assert.match(view, /acquisition\.lead\.manage/);
  assert.match(view, /Tạo Lead/);
  assert.match(view, /Center Lead/);
  assert.match(view, /centerId/);
  assert.match(view, /Nguồn nhập: Staff/);
  assert.match(view, /setStatus\("ALL"\)/);
  assert.match(view, /Thử lại tạo Lead/);
  assert.match(view, /pendingAttempt\?\.key === key/);
  assert.match(view, /Thử lại cùng yêu cầu/);
  assert.doesNotMatch(view, /fetch\(|localStorage|indexedDB|leadScore|pipelineValue/i);
});
