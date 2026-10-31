import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";
import { handleHoShiftTemplatesRead, parseHoShiftTemplates, type HoShiftTemplatesEnv } from "./ho-shift-templates-read-facade";
const centerId = "018e6b98-fcc3-7ef2-a1e1-63fbadc82130";
const otherCenter = "018e6b98-fcc3-7ef2-a1e1-63fbadc82131";
const templateId = "018e6b98-fcc3-7ef2-a1e1-63fbadc82132";
const url = "https://ho.staging.pinohouse.art/api/ho/workforce/shift-templates";
const row = { id: templateId, centerId, code: "EVENING", displayLabel: "Ca tối", startLocalTime: "17:30",
  endLocalTime: "21:00", status: "INACTIVE", createdAt: "2026-10-31T02:00:00.000Z",
  updatedAt: "2026-10-31T03:00:00.000Z" };
test("PAP-1198 HO parser retains inactive historical ShiftTemplates and rejects cross-Center/invalid response", () => {
  assert.deepEqual(parseHoShiftTemplates({ data: [row] }, centerId), [row]);
  assert.deepEqual(parseHoShiftTemplates({ data: [] }, centerId), []);
  for (const invalid of [null, { data: {} }, { data: [{ ...row, centerId: otherCenter }] },
    { data: [{ ...row, status: "ARCHIVED" }] }, { data: [{ ...row, startLocalTime: "23:00" }] },
    { data: [row, row] }, { data: [{ ...row, updatedAt: "invalid" }] }]) {
    assert.equal(parseHoShiftTemplates(invalid, centerId), null);
  }
});
test("PAP-1198 HO template BFF allows GET catalog and authorized POST creation only on Staging HO", () => {
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art", "/api/ho/workforce/shift-templates", "GET"), { action: "next" });
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art", "/api/ho/workforce/shift-templates", "POST"), { action: "next" });
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art", "/api/ho/workforce/shift-templates", "PATCH"), { action: "not_found" });
  for (const host of ["bo.staging.pinohouse.art", "ho.pinohouse.art", "tos.staging.pinohouse.art"])
    assert.deepEqual(decideHostBoundary(host, "/api/ho/workforce/shift-templates", "GET"), { action: "not_found" });
});
test("PAP-1198 HO shift catalog rejects method, host, environment, malformed and missing Center before Core", async () => {
  let called = 0;
  const env = { APP_ENV: "staging", PINO_WORKFORCE_CORE: {
    executePlanningWithStaffPassword: async () => { called++; throw Error("Core should not be called"); },
  } } as unknown as HoShiftTemplatesEnv;
  const request = (suffix: string, method = "GET", host = "ho.staging.pinohouse.art") =>
    new Request(url + suffix, { method, headers: { host } });
  assert.equal((await handleHoShiftTemplatesRead(request("?centerId=" + centerId, "POST"), env)).status, 405);
  assert.equal((await handleHoShiftTemplatesRead(request("?centerId=" + centerId, "GET", "bo.staging.pinohouse.art"), env)).status, 404);
  assert.equal((await handleHoShiftTemplatesRead(request("?centerId=" + centerId), { ...env, APP_ENV: "production" })).status, 404);
  for (const query of ["", "?centerId=bad", "?centerId=" + centerId + "&centerId=" + otherCenter, "?centerId=" + centerId + "&scope=GLOBAL"]) {
    assert.equal((await handleHoShiftTemplatesRead(request(query), env)).status, 400);
  }
  const denied = await handleHoShiftTemplatesRead(request("?centerId=" + centerId), env);
  assert.ok([401, 403, 503].includes(denied.status));
  assert.equal(called, 0);
});
