import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, isOperationalReadPath, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const staffId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const token = "local-password-session";
const env = (binding: BoAccessCoreBinding): BoReadEnv => ({ PINO_BO_CORE: binding });

test("Staff Pinoria read forwards only exact Staff resource path through BO credential", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request, value) {
      assert.equal(value, token);
      forwarded.push(request);
      return { status: 200, body: { data: { staffMemberId: staffId } }, requestId: "pinoria-read" };
    },
  };
  const path = `workforce/staff-records/${staffId}/pinoria`;
  const request = new Request(`https://bo.pinohouse.art/api/bo/${path}?pinoriaSelfId=forged&staffMemberId=forged`, {
    headers: { cookie: `pino_staff_password_session=${token}` },
  });
  const response = await handleBoOperationalReadRequest(request, env(binding), path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "pinoria-read");
  assert.deepEqual(forwarded, [{ method: "GET", path }]);
});

test("Staff Pinoria read allowlist rejects malformed ids and path expansion", () => {
  assert.equal(isOperationalReadPath(`workforce/staff-records/${staffId}/pinoria`), true);
  assert.equal(isOperationalReadPath("workforce/staff-records/not-a-canonical-id/pinoria"), false);
  assert.equal(isOperationalReadPath(`workforce/staff-records/${staffId}/pinoria/anything`), false);
});
