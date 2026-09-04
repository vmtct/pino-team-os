import assert from "node:assert/strict";
import test from "node:test";
import { handleCenterNetworkIngress } from "./center-network-ingress";
import type { WorkforceNetworkPresenceCoreBinding } from "./center-network-core";

function request(host = "pino-team-os-staging.example.workers.dev", ip = "203.0.113.10", token = "agent-token") {
  return new Request(`https://${host}/api/workforce-center-network/heartbeat`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "cf-connecting-ip": ip,
      "content-type": "application/json",
    },
    body: JSON.stringify({ centerId: "00000000-0000-7000-8000-000000000001" }),
  });
}

test("Center network ingress is staging workers.dev only", async () => {
  const binding: WorkforceNetworkPresenceCoreBinding = { heartbeat: async () => { throw new Error("must not call"); } };
  assert.equal((await handleCenterNetworkIngress(request("tos.pinohouse.art"), { WORKFORCE_CENTER_NETWORK_STAGING_INGRESS: "enabled", PINO_WORKFORCE_NETWORK_CORE: binding })).status, 404);
  assert.equal((await handleCenterNetworkIngress(request(), { PINO_WORKFORCE_NETWORK_CORE: binding })).status, 404);
});
test("Center network ingress forwards only server-observed IP and bearer through private binding", async () => {
  let seen: unknown;
  const binding: WorkforceNetworkPresenceCoreBinding = {
    async heartbeat(input) {
      seen = input;
      return { centerId: input.centerId, observedAt: "2026-09-04T09:00:00.000Z", status: "ACTIVE" };
    },
  };
  const response = await handleCenterNetworkIngress(request(), {
    WORKFORCE_CENTER_NETWORK_STAGING_INGRESS: "enabled",
    PINO_WORKFORCE_NETWORK_CORE: binding,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, {
    centerId: "00000000-0000-7000-8000-000000000001",
    serverObservedIp: "203.0.113.10",
    agentToken: "agent-token",
  });
  assert.doesNotMatch(await response.text(), /203\.0\.113\.10|agent-token/);
});

test("Center network ingress fails closed without observed IP or bearer", async () => {
  const binding: WorkforceNetworkPresenceCoreBinding = { heartbeat: async () => { throw new Error("must not call"); } };
  assert.equal((await handleCenterNetworkIngress(request(undefined, "", "agent-token"), { WORKFORCE_CENTER_NETWORK_STAGING_INGRESS: "enabled", PINO_WORKFORCE_NETWORK_CORE: binding })).status, 403);
  assert.equal((await handleCenterNetworkIngress(request(undefined, "203.0.113.10", ""), { WORKFORCE_CENTER_NETWORK_STAGING_INGRESS: "enabled", PINO_WORKFORCE_NETWORK_CORE: binding })).status, 403);
});
