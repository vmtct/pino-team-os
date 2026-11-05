import test from "node:test";
import assert from "node:assert/strict";
import { boApi, BoApiError } from "./bo-api";

test("BO reads convert non-JSON middleware responses into bounded BoApiError", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Not Found", { status: 404, headers: { "x-request-id": "plain-404" } });
  try {
    await assert.rejects(() => boApi.calendarScope(), (error: unknown) => {
      assert.ok(error instanceof BoApiError);
      assert.equal(error.status, 404);
      assert.equal(error.requestId, "plain-404");
      assert.equal(error.structuredResponse, false);
      assert.equal(error.message, "Back Office returned an invalid response.");
      assert.doesNotMatch(error.message, /Unexpected token|JSON/);
      return true;
    });
  } finally { globalThis.fetch = original; }
});
