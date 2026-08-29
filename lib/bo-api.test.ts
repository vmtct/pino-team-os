import test from "node:test";
import assert from "node:assert/strict";
import { boApi, BoApiError } from "./bo-api";

test("configureStaffPin posts the selected Access user and six-digit PIN", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "/api/staff-pin/configure");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { userId: "access-user-id", pin: "246810" });
    return Response.json({ data: { userId: "access-user-id", loginIdentifier: "staff@example.com", version: 3 } });
  };
  try {
    const result = await boApi.configureStaffPin("access-user-id", "246810");
    assert.equal(result.version, 3);
    assert.equal(result.loginIdentifier, "staff@example.com");
  } finally { globalThis.fetch = original; }
});

test("configureStaffPin surfaces a non-JSON backend failure without a parser error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Not Found", { status: 404, headers: { "x-request-id": "req-1" } });
  try {
    await assert.rejects(
      () => boApi.configureStaffPin("access-user-id", "246810"),
      (error: unknown) => error instanceof BoApiError && error.status === 404 && error.message === "Not Found" && error.requestId === "req-1",
    );
  } finally { globalThis.fetch = original; }
});
