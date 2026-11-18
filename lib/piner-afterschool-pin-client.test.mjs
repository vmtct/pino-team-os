import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// PAP-2184: test client transport without sending any login or credential.
test("PAP-2184: fixed same-origin JSON endpoints opt into non-opaque Origin transport", async () => {
  const source = readFileSync(new URL("./piner-afterschool-pin-client.ts", import.meta.url), "utf8");
  const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const client = await import("data:text/javascript;base64," + Buffer.from(emitted).toString("base64"));
  const saved = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ data: { authState: "PIN_CHANGE_REQUIRED", expiresAt: "2026-11-21T00:00:00.000Z", csrfToken: "A".repeat(22) } }), { status: 200 });
  };
  try {
    await client.loginAfterschool("0900000000", "000000");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/piner/afterschool/pin/login");
    const { init } = calls[0];
    assert.equal(init.mode, "cors");
    assert.equal(init.referrerPolicy, "strict-origin");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.get("content-type"), "application/json");
    assert.equal(init.headers.get("origin"), null);
  } finally {
    globalThis.fetch = saved;
  }
});
