import test from "node:test";
import assert from "node:assert/strict";
import { authenticatePinoriaTvRequest, PinoriaTvAuthError } from "./pinoria-tv-auth";

const deviceToken = "pinoria-tv-device-token-2026";

test("Pinoria TV production accepts only its device bearer token", async () => {
  await assert.doesNotReject(authenticatePinoriaTvRequest(
    new Request("https://tos.pinohouse.art/api/pinoria-tv/snapshot", { headers: { authorization: `Bearer ${deviceToken}` } }),
    { PINORIA_TV_DEVICE_TOKEN: deviceToken },
  ));
  await assert.rejects(
    authenticatePinoriaTvRequest(new Request("https://tos.pinohouse.art/api/pinoria-tv/snapshot", { headers: { authorization: "Bearer wrong" } }), { PINORIA_TV_DEVICE_TOKEN: deviceToken }),
    (error: unknown) => error instanceof PinoriaTvAuthError && error.status === 401,
  );
});

test("Pinoria TV production fails closed when device secret is unavailable", async () => {
  await assert.rejects(
    authenticatePinoriaTvRequest(new Request("https://tos.pinohouse.art/api/pinoria-tv/snapshot"), {}),
    (error: unknown) => error instanceof PinoriaTvAuthError && error.status === 503,
  );
});

test("Pinoria TV staging bypass is bounded to workers.dev", async () => {
  await assert.doesNotReject(authenticatePinoriaTvRequest(
    new Request("https://pino-team-os-staging.workers.dev/api/pinoria-tv/snapshot"),
    { PINORIA_TV_STAGING_BYPASS: "enabled" },
  ));
  await assert.rejects(
    authenticatePinoriaTvRequest(new Request("https://tos.pinohouse.art/api/pinoria-tv/snapshot"), { PINORIA_TV_STAGING_BYPASS: "enabled" }),
    PinoriaTvAuthError,
  );
});
