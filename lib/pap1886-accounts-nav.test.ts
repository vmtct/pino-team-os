import test from "node:test";
import assert from "node:assert/strict";
import { canOpenAfterschoolAccounts } from "../app/bo/afterschool-accounts/accounts-nav-access";

const centerId = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";

test("PAP-1886 Accounts navigation requires a successful matching Center receipt", async () => {
  const signal = new AbortController().signal;
  const response: typeof fetch = async (url, init) => {
    assert.equal(url, "/api/bo/identity/afterschool-users?centerId=" + centerId + "&limit=1");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.signal, signal);
    return Response.json({ data: { scopeCenterId: centerId, items: [] } });
  };
  assert.equal(await canOpenAfterschoolAccounts(centerId, signal, response), true);
  assert.equal(await canOpenAfterschoolAccounts(centerId, signal, async () => new Response(null, { status: 403 })), false);
  assert.equal(await canOpenAfterschoolAccounts(centerId, signal, async () => Response.json({ data: { scopeCenterId: "wrong" } })), false);
  assert.equal(await canOpenAfterschoolAccounts("invalid", signal, async () => { assert.fail("Unexpected request"); }), false);
});

test("PAP-1886 a stale response cannot unlock Accounts navigation after a Center change", async () => {
  const controller = new AbortController();
  const response: typeof fetch = async () => {
    controller.abort();
    return Response.json({ data: { scopeCenterId: centerId } });
  };
  assert.equal(await canOpenAfterschoolAccounts(centerId, controller.signal, response), false);
});
