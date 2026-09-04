import test from "node:test";
import assert from "node:assert/strict";
import { boWebCmsApi } from "./bo-web-cms-api";

test("typed Web CMS client uses canonical bounded read contracts", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => { calls.push({ url: String(input), init }); return Response.json({ data: [] }); };
  try {
    await boWebCmsApi.slots("TOPPI", "home hero");
    await boWebCmsApi.history("0198d050-56c1-7ac5-b9ab-b0e45d912345");
  } finally { globalThis.fetch = original; }
  assert.equal(calls[0]?.url, "/api/bo/web-cms/slots?site=TOPPI&page=home+hero");
  assert.equal(calls[1]?.url, "/api/bo/web-cms/slots/0198d050-56c1-7ac5-b9ab-b0e45d912345/history");
  assert.equal(calls.every(call => call.init === undefined || call.init.method === undefined), true);
});

test("typed Web CMS client preserves expected revision and command payload", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => { calls.push({ url: String(input), init }); return Response.json({ data: { revision: 8 } }); };
  const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  try {
    await boWebCmsApi.saveDraft(id, 7, { type: "TEXT", values: { vi: "Xin chào", en: "Hello" } });
    await boWebCmsApi.publish(id, 8);
    await boWebCmsApi.rollback(id, 9, "0198d050-56c1-7ac5-b9ab-b0e45d912399");
  } finally { globalThis.fetch = original; }
  assert.deepEqual(calls.map(call => call.url), [`/api/bo/web-cms/slots/${id}/draft`, `/api/bo/web-cms/slots/${id}/publish`, `/api/bo/web-cms/slots/${id}/rollback`]);
  assert.deepEqual(calls.map(call => JSON.parse(String(call.init?.body))), [
    { expectedRevision: 7, value: { type: "TEXT", values: { vi: "Xin chào", en: "Hello" } } },
    { expectedRevision: 8 },
    { expectedRevision: 9, targetRevisionId: "0198d050-56c1-7ac5-b9ab-b0e45d912399" },
  ]);
  assert.equal(calls.every(call => call.init?.method === "POST" && new Headers(call.init.headers).has("idempotency-key")), true);
});
