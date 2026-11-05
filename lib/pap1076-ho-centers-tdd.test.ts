import test from "node:test";
import assert from "node:assert/strict";
import { centerDefinition, centerProvider, centerQuery, centerSchema } from "../app/ho/centers/schema";
import { createHoTddAdapter } from "./workspace-adapters";
import { TddRegistry, composeTabs } from "./workspace-schema";
import { BoApiError } from "./bo-api-error";
const id = "019d2000-0002-7000-8000-000000000001";
const center = { id, key: "QA", displayName: "Synthetic Center", timeZone: "Asia/Ho_Chi_Minh", status: "ACTIVE" };
const signal = () => new AbortController().signal;
function transport() {
  const state = { permissions: ["team.bo.access", "bo.operations.view"], status: 200, rows: [center], calls: [] as string[] };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); state.calls.push(url.pathname);
    assert.equal(init?.method ?? "GET", "GET");
    const context = { surface: "BO", entitled: true, userId: "fixture-founder", permissionKeys: state.permissions };
    return Response.json({ data: url.pathname === "/api/bo/context" ? context : state.rows }, { status: url.pathname === "/api/bo/context" ? 200 : state.status });
  };
  return { state, fetcher };
}
const options = (fetcher: typeof fetch) => ({ registry: new TddRegistry(), definition: centerDefinition, provider: centerProvider, origin: "https://ho.staging.pinohouse.art", fetcher });
test("PAP1076 uses canonical tabs, read-only Center fields and no fabricated history", () => {
  assert.deepEqual(composeTabs(centerSchema).map(t => [t.id,t.label]), [["overview","Tổng quan"],["history","Lịch sử"]]);
  assert.equal(centerSchema.drawer.density,"one-column");
  assert.ok(centerSchema.fields.every(f => f.readOnly && !f.capabilities.inlineEdit));
  assert.equal(centerSchema.detail.history.kind,"unavailable");
});
test("PAP1076 reads actual Center projection through HO session and reports missing record", async () => {
  const { state, fetcher } = transport(); const adapter = await createHoTddAdapter(options(fetcher),signal());
  try {
    const list = await adapter.list(centerQuery,signal());
    assert.deepEqual(list.rows,[{ id, name:center.displayName, centerKey:"QA", timeZone:center.timeZone,status:"ACTIVE" }]);
    assert.equal((await adapter.detail(id,signal()))?.row.id,id);
    assert.equal(await adapter.detail("019d2000-0002-7000-8000-000000000002",signal()),null);
    assert.equal(adapter.mutation,undefined); assert.equal(adapter.capabilities.edit,false);
    assert.ok(state.calls.every(p => ["/api/bo/context","/api/bo/centers"].includes(p)));
  } finally { adapter.dispose(); }
});
test("PAP1076 refuses missing grants, revoked principal and BO origin", async () => {
  const { state, fetcher } = transport();
  state.permissions=["team.bo.access"];
  await assert.rejects(createHoTddAdapter(options(fetcher),signal()),(e: unknown)=>e instanceof BoApiError&&e.status===403);
  state.permissions.push("bo.operations.view"); const adapter=await createHoTddAdapter(options(fetcher),signal());
  state.permissions=["team.bo.access"];
  await assert.rejects(adapter.list(centerQuery,signal()),(e: unknown)=>e instanceof BoApiError&&e.status===403);adapter.dispose();
  await assert.rejects(createHoTddAdapter({...options(fetcher),origin:"https://bo.staging.pinohouse.art"},signal()),(e: unknown)=>e instanceof BoApiError&&e.status===404);
});
test("PAP1076 retains 403, malformed-directory and cross-surface denials", async () => {
  const { state, fetcher } = transport();const adapter=await createHoTddAdapter(options(fetcher),signal());
  state.status=403;
  await assert.rejects(adapter.list(centerQuery,signal()),(e: unknown)=>e instanceof BoApiError&&e.status===403);
  state.status=200; state.rows=[{...center,timeZone:"invalid/timezone"}];
  await assert.rejects(adapter.list(centerQuery,signal()),/Múi giờ/);adapter.dispose();
  await assert.rejects(centerProvider.list(centerQuery,{surface:"BO",centerId:id},fetcher,signal()),(e: unknown)=>e instanceof BoApiError&&e.status===403);
});
