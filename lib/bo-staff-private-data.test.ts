import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BO_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoStaffPrivateDocumentRequest, type BoStaffPrivateEnv } from "./bo-staff-private-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const staffId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const documentId = "0198d050-56c1-7ac5-b9ab-b0e45d954321";
const centerId = "01912345-6789-7abc-8def-0123456789ab";
const token = "private-view-session";
const env = (binding: BoAccessCoreBinding): BoReadEnv & BoStaffPrivateEnv => ({ PINO_BO_CORE: binding });

test("private Staff metadata read forwards only the explicit Center context", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, value) { assert.equal(value, token); forwarded.push(request); return { status: 200, body: { data: { staffMemberId: staffId, governmentId: null, bank: null, documents: [], source: "STAFF_RECORD" } }, requestId: "private-read" }; } };
  const path = `workforce/staff-records/${staffId}/private`;
  const request = new Request(`https://bo.pinohouse.art/api/bo/${path}?centerId=${centerId}&userId=forged&email=forged`, { headers: { cookie: `pino_staff_password_session=${token}` } });
  const response = await handleBoOperationalReadRequest(request, env(binding), path);
  assert.equal(response.status, 200);
  assert.deepEqual(forwarded, [{ method: "GET", path, body: { centerId } }]);
});

test("private Staff document facade returns inline no-store bytes and never storage metadata", async () => {
  const forwarded: BoAccessRequest[] = [];
  const path = `workforce/staff-records/${staffId}/private/documents/${documentId}`;
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, value) {
    assert.equal(value, token); forwarded.push(request);
    return { status: 200, body: { data: { id: documentId, side: "front", mimeType: "image/png", byteSize: 3, createdAt: "2026-09-28T00:00:00.000Z", bytes: new Uint8Array([4,5,6]).buffer } }, requestId: "private-doc" };
  } };
  const request = new Request(`https://bo.pinohouse.art/api/bo/${path}?centerId=${centerId}&objectKey=forged`, { headers: { cookie: `pino_staff_password_session=${token}` } });
  const response = await handleBoStaffPrivateDocumentRequest(request, env(binding), path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), [4,5,6]);
  assert.deepEqual(forwarded, [{ method: "GET", path, body: { centerId } }]);
});

test("private Staff document facade preserves Core authorization denial", async () => {
  const path = `workforce/staff-records/${staffId}/private/documents/${documentId}`;
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword() { return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "denied" }; } };
  const response = await handleBoStaffPrivateDocumentRequest(new Request(`https://bo.pinohouse.art/api/bo/${path}`, { headers: { cookie: `pino_staff_password_session=${token}` } }), env(binding), path);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "denied");
  assert.deepEqual(await response.json(), { error: { code: "ACCESS_PERMISSION_DENIED" } });
});

test("BO host boundary allows only exact private Staff paths", () => {
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, `/api/bo/workforce/staff-records/${staffId}/private`), { action: "next" });
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, `/api/bo/workforce/staff-records/${staffId}/private/documents/${documentId}`), { action: "next" });
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, `/api/bo/workforce/staff-records/${staffId}/private/export`), { action: "not_found" });
});

test("Staff detail requires an explicit reveal and never prefetches private data", async () => {
  const source = await readFile("app/bo/staff/StaffManagementView.tsx", "utf8");
  assert.equal((source.match(/boApi\.staffPrivate\(/g) ?? []).length, 1);
  assert.match(source, /async function revealPrivateData\(\)/);
  assert.match(source, /Hiện thông tin riêng tư/);
  assert.match(source, /Ẩn thông tin/);
  const selectedEffect = source.slice(source.indexOf("selectedIdRef.current = selectedId"), source.indexOf("const selected =", source.indexOf("selectedIdRef.current = selectedId")));
  assert.doesNotMatch(selectedEffect, /staffPrivate\(/);
});
