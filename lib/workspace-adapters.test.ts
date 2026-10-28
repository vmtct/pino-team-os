import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createBoTddAdapter, createHoTddAdapter, hoCentersProvider, boPlanningProvider, boSubjectHistory, type SurfaceDefinition, type SurfaceProvider } from "./workspace-adapters";
import { readData } from "./workspace-adapters/providers";
import { fromSharedConfig, toSharedConfig } from "./workspace-adapters/views";
import { TddRegistry, type TableQuery } from "./workspace-schema";
import { BoApiError } from "./bo-api-error";
import { handleBoContextRequest } from "./bo-context-handler";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoPublicViewRequest } from "./bo-public-view-handler";
import type { BoAccessRequest } from "./bo-core";
import { decideHostBoundary } from "./host-boundary";
import { SurfaceWorkspace, shouldRestoreTableAfterNavigation } from "../app/components/workspace-adapters/SurfaceWorkspace";
import { TddTable } from "../app/components/workspace-renderer/Table";
import { BoRegistrationWorkspace } from "../app/bo/components/registration/BoRegistrationWorkspace";
import { HoWorkspace } from "../app/ho/HoWorkspace";
import type { AdapterNavigation } from "./workspace-adapters/navigation";
import { browserTddNavigation } from "./workspace-adapters/navigation";
import { surfaceSession } from "./workspace-adapters/session";
import { latestRequest } from "../app/components/workspace-renderer/resource";

const center = "01900000-0000-7000-8000-000000000001", recordId = "01900000-0000-7000-8000-000000000002", other = "01900000-0000-7000-8000-000000000003";
const caps = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const fields = [
  { key: "name", label: "Name", type: "text", icon: "Aa", width: 225, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "id", label: "ID", type: "id", icon: "#", width: 200, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "count", label: "Count", type: "number", icon: "#", width: 130, permission: "fixture.read", readOnly: true, capabilities: caps },
  { key: "secret", label: "Private", type: "text", icon: "Aa", width: 150, permission: "fixture.secret", readOnly: true, capabilities: caps },
] as const;
type F = typeof fields;
const query: TableQuery<F> = { search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null, order: ["name", "id", "count"], visible: ["name", "id", "count"], page: 1, pageSize: 8 };
const signal = () => new AbortController().signal;
const row = { id: recordId, name: "Authorized fixture", count: 2, secret: "must not escape", centerId: center };
function definition(surface: "BO" | "HO", writable = false): SurfaceDefinition<F> {
  const sections = [{ id: "main", label: "Properties", fields: ["name", "id", "count"] as const }];
  return { version: 1, classification: "TDD_DEFAULT", key: surface === "HO" ? "centers" : "students", label: "Adapter fixture", group: "Tests", surface, fields,
    capabilities: { read: "fixture.read", ...(writable ? { edit: "fixture.edit" } : {}) }, table: {
      identity: { field: "name", pinned: "left", hideable: false, reorderable: false }, columns: query.order.map(field => ({ field, visible: true })), search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
      filters: { fields: ["count"], mode: "flat", logic: "AND" }, sort: { fields: ["count"], mode: "single", nulls: "last", tieBreak: "record-id" }, group: { fields: ["name"], mode: "single" },
      views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] }, pagination: { sizes: [8, 15, 30], defaultSize: 8, mode: "server" }, inlineEdit: { enabled: writable, fields: writable ? ["count"] : [] },
      interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
    }, drawer: { density: "one-column", sections, actions: [] }, detail: { overview: { sections }, history: { kind: "unavailable", reason: "Chưa có lịch sử khả dụng" }, businessTabs: [] } };
}
/** Test-only Core fixture behind the actual authenticated BFF functions. */
function server(surface: "BO" | "HO") {
  const state = { principal: "user-a", permissions: ["team.bo.access", "fixture.read", "fixture.edit", "bo.shared_view.manage", "fixture.history"], authenticated: true, founder: "user-a", wrongCenter: false, denied: false, missing: false, calls: [] as BoAccessRequest[], http: [] as { url: URL; init?: RequestInit }[], views: [] as {id:string;moduleKey:string;name:string;version:number;position:number;config:ReturnType<typeof toSharedConfig<F>>}[], viewStatus: 200 };
  const origin = surface === "BO" ? "https://bo.staging.pinohouse.art" : "https://ho.staging.pinohouse.art";
  const env: BoReadEnv = { APP_ENV: "staging", get HO_PILOT_FOUNDER_USER_IDS() { return state.founder; }, PINO_BO_CORE: { async executeWithStaffPassword(request, token) {
    assert.equal(token, "test-session"); state.calls.push(request);
    if (request.path === "context") return { status: 200, body: { data: { userId: state.principal, email: "fixture@example.test", displayName: null, staffMemberId: null, surface: "BO", entitled: true, permissionKeys: state.permissions } }, requestId: "test" };
    if (request.path === "centers") return { status: 200, body: { data: [{ id: center, key: "CENTER", displayName: "Center fixture", timeZone: "Asia/Ho_Chi_Minh", status: "ACTIVE" }] }, requestId: "test" };
    if (request.path.startsWith("views/")) {
      const receipt = (data: unknown, status = state.viewStatus) => ({ status, body: { data }, requestId: "views" });
      if (request.method === "GET") return receipt(state.views);
      if (!state.permissions.includes("bo.shared_view.manage")) return receipt(null, 403);
      if (state.viewStatus !== 200) return receipt(null);
      const body = request.body as {expectedVersion?:number;name?:string;config?:ReturnType<typeof toSharedConfig<F>>;positions?:{id:string;position:number;expectedVersion:number}[]};
      const selected = state.views.find(v => request.path.includes(v.id));
      if (body.positions) { state.views = body.positions.map(p => { const view = state.views.find(v => v.id === p.id)!; assert.equal(p.expectedVersion, view.version); return { ...view, position: p.position, version: view.version + 1 }; }); return receipt(state.views); }
      if (request.method === "POST") { const view = { id: other, moduleKey: "students", name: body.name!, config: body.config!, version: 1, position: state.views.length }; state.views.push(view); return receipt(view); }
      if (!selected) return receipt(null, 404);
      if (selected.version !== body.expectedVersion) return receipt(null, 409);
      if (request.method === "DELETE") { state.views = state.views.filter(v => v.id !== selected.id); return receipt({ id: selected.id, deleted: true }); }
      const updated = { ...selected, version: selected.version + 1, ...(body.name ? {name:body.name} : {}), ...(body.config ? {config:body.config} : {}) };
      state.views = state.views.map(v => v.id === selected.id ? updated : v); return receipt(updated);
    }
    if (request.path === "audit/subject") return { status: 200, body: { data: { events: [], nextCursor: null } }, requestId: "history" };
    if (state.denied || (request.resource?.centerId && request.resource.centerId !== center)) return { status: 403, body: { error: { code: "DENIED" } }, requestId: "denied" };
    if (state.missing && request.path.includes(recordId)) return { status: 404, body: { error: { code: "NOT_FOUND" } }, requestId: "missing" };
    return { status: 200, body: { data: { ...row, centerId: state.wrongCenter ? other : center } }, requestId: "read" };
  } } };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input), origin); state.http.push({ url, init });
    assert.equal(url.origin, origin); assert.equal(init?.credentials, "same-origin"); assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error");
    const method = init?.method ?? "GET";
    if (decideHostBoundary(url.hostname, url.pathname, method).action !== "next") return new Response(null, { status: 404 });
    const request = new Request(url, { ...init, headers: { host: url.hostname, ...(state.authenticated ? { cookie: "pino_staff_password_session=test-session" } : {}) } });
    const path = url.pathname.slice("/api/bo/".length);
    if (path === "context") return handleBoContextRequest(request, env);
    if (path.startsWith("views/")) return handleBoPublicViewRequest(request, env, path);
    return handleBoOperationalReadRequest(request, env, path);
  };
  return { state, origin, fetcher };
}
function provider(surface: "BO" | "HO"): SurfaceProvider<F> {
  const load = async (scope: Parameters<SurfaceProvider<F>["detail"]>[1], fetcher: typeof fetch, signal: AbortSignal) => {
    if (surface === "HO") { await readData(fetcher, "centers", signal); return { row: { ...row }, version: "1" }; }
    const value = await readData(fetcher, "student-visits/" + recordId + "?centerId=" + (scope.surface === "BO" ? scope.centerId : "invalid"), signal) as typeof row;
    return { row: value, centerId: value.centerId, version: "1" };
  };
  return { pagination: "server", list: async (_query, scope, fetcher, signal) => ({ records: [await load(scope, fetcher, signal)], total: 25 }), detail: async (_id, scope, fetcher, signal) => load(scope, fetcher, signal) };
}
async function setup(surface: "BO" | "HO", def = definition(surface), supplied = provider(surface)) {
  const api = server(surface), options = { ...api, registry: new TddRegistry(), definition: def, provider: supplied };
  const adapter = surface === "BO" ? await createBoTddAdapter({ ...options, centerId: center }, signal()) : await createHoTddAdapter(options, signal());
  return { ...api, adapter };
}
const fails = (status: number) => (error: unknown) => error instanceof BoApiError && error.status === status;

for (const surface of ["BO", "HO"] as const) {
  test(`${surface}: authenticated adapter registers one canonical typed data boundary`, async () => {
    const { adapter, state } = await setup(surface);
    assert.equal(adapter.context.surface, surface); assert.equal(adapter.userId, "user-a"); assert.equal(adapter.registry.get(surface, adapter.schema.key), adapter.schema);
    const data = await adapter.schema.data.list(query, adapter.context, signal());
    assert.equal(data.total, 25); assert.equal(data.rows[0].name, row.name); assert.equal(data.rows[0].secret, undefined); assert.equal((data.rows[0] as unknown as Record<string, unknown>).centerId, undefined);
    assert.equal(adapter.mutation, undefined);
    assert.deepEqual(adapter.capabilities,{read:true,edit:false,create:false,delete:false,reveal:false,audit:false});
    if (surface === "BO") assert.ok(state.calls.some(call => call.resource?.centerId === center));
    await assert.rejects(adapter.schema.data.list(query, { surface: surface === "BO" ? "HO" : "BO", centerId: other, authorize: () => true }, signal()), fails(403));
    const before = state.calls.length; await assert.rejects(adapter.schema.data.detail(recordId, { ...adapter.context }, signal()), fails(403)); assert.equal(state.calls.length, before);
  });
  test(`${surface}: typed filters, sort, grouping and page are passed unchanged to the provider`, async () => {
    const inner = provider(surface); let received: unknown;
    const { adapter } = await setup(surface, definition(surface), { ...inner, list: async (query, ...args) => { received = query; return inner.list(query, ...args); } });
    const typed: TableQuery<F> = { ...query, page: 2, pageSize: 15, search: "Trần", filters: { logic: "OR", rules: [{ field: "count", op: "between", value: 0, second: 5 }] }, sort: { field: "count", direction: "desc" }, group: { field: "name", direction: "asc", hidden: [], collapsed: [], hideEmpty: false } };
    assert.equal((await adapter.list(typed, signal())).total, 25); assert.deepEqual(received, typed);
  });
  test(`${surface}: missing, revoked and changed-principal sessions never commit records`, async () => {
    const current = await setup(surface); current.state.authenticated = false;
    await assert.rejects(current.adapter.list(query, signal()), fails(401)); assert.equal(current.adapter.context.authorize("fixture.read"), false);
    const changed = await setup(surface); changed.state.principal = "user-b";
    await assert.rejects(changed.adapter.detail(recordId, signal()), fails(surface === "HO" ? 403 : 401));
    const revoked = await setup(surface); revoked.state.permissions = ["team.bo.access"];
    await assert.rejects(revoked.adapter.list(query, signal()), fails(403));
    assert.equal(revoked.adapter.capabilities.read,false);
  });
  test(`${surface}: late permission revocation and abort suppress provider results`, async () => {
    let release!: () => void, started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const inner = provider(surface);
    const current = await setup(surface, definition(surface), { ...inner, detail: async (...args) => { started(); await waiting; return inner.detail(...args); } });
    const pending = current.adapter.detail(recordId, signal()); await entered;
    current.state.permissions = ["team.bo.access"]; release(); await assert.rejects(pending, fails(403));
    const controller = new AbortController(); controller.abort(); await assert.rejects(current.adapter.list(query, controller.signal), { name: "AbortError" });
  });
  test(`${surface}: both workspace adapters render through the canonical engine`, async () => {
    const { adapter } = await setup(surface);
    const navigation: AdapterNavigation<F> = { read: () => ({ kind: "detail", recordId, tab: "history", query }), change() {}, subscribe: () => () => {}, capture() {}, restore() {} };
    const props = { adapter, navigation, initialQuery: query };
    const out = renderToStaticMarkup(h(SurfaceWorkspace<F>, props)); assert.match(out, /data-tdd-shell="table"/); assert.match(out, /data-tdd-shell="detail"/); assert.match(out, /Tổng quan/); assert.match(out, /Lịch sử/); assert.doesNotMatch(out, /must not escape|Authorized fixture/);
    if (surface === "HO") { const hosted=renderToStaticMarkup(h(HoWorkspace<F>, { module: "centers", tddAdapter: props })); assert.match(hosted, /data-tdd-shell="table"/);assert.match(hosted,/id="menu-btn"/);assert.match(hosted,/id="detail-menu-btn"/); }
    else {
      const source = { modules: { students: { label: "Test", group: "Tests", fields: [] } }, load: async () => assert.fail("legacy source must not load"), scopeLabel: () => "" };
      const hosted=renderToStaticMarkup(h(BoRegistrationWorkspace<F>, { moduleKey: "students", source, currentUser: { displayName: null }, tddAdapter: props }));assert.match(hosted,/data-tdd-shell="detail"/);assert.match(hosted,/id="menu-btn"/);assert.match(hosted,/id="detail-menu-btn"/);assert.doesNotMatch(hosted,/id="add-record"/);
      assert.throws(() => renderToStaticMarkup(h(HoWorkspace<F>, { module: "centers", tddAdapter: props })), /adapter mismatch/);
    }
  });
}

test("BO rejects wrong/unverified Center and cross-surface origins before data reads", async () => {
  const api = server("BO"), options = { ...api, registry: new TddRegistry(), definition: definition("BO"), provider: provider("BO") };
  await assert.rejects(createBoTddAdapter({ ...options, centerId: other }, signal()), fails(403)); assert.equal(api.state.calls.some(v => v.path.startsWith("student-visits")), false);
  await assert.rejects(createHoTddAdapter(options, signal()), fails(404));
  const api2 = await setup("BO"); api2.state.wrongCenter = true; await assert.rejects(api2.adapter.detail(recordId, signal()), fails(403));
  const api3 = await setup("BO"); api3.state.denied = true; await assert.rejects(api3.adapter.detail(recordId, signal()), fails(403));
  const missing = await setup("BO"); missing.state.missing = true; await assert.rejects(missing.adapter.detail(recordId, signal()), fails(404));
});
test("HO Founder admission remains a server requirement even with every schema permission", async () => {
  const api = server("HO"); api.state.founder = "another-founder";
  await assert.rejects(createHoTddAdapter({ ...api, registry: new TddRegistry(), definition: definition("HO"), provider: provider("HO") }, signal()), fails(403));
  assert.equal(api.state.calls.some(v => v.path === "centers"), false);
  const writable = { ...provider("HO"), mutation: () => ({ update: async () => ({ status: "denied" as const }) }) };
  await assert.rejects(setup("HO", definition("HO", true), writable), fails(403));
});
test("Malformed identity/scope/count responses fail closed without an alternate provider", async () => {
  const bad = await setup("BO", definition("BO"), { ...provider("BO"), detail: async () => ({ row: { ...row, id: other }, centerId: center }) });
  await assert.rejects(bad.adapter.detail(recordId, signal()), fails(502));
  for (const total of [-1, 0, 1.5]) {
    const bad = await setup("BO", definition("BO"), { ...provider("BO"), list: async () => ({ records: [{ row, centerId: center }], total }) });
    await assert.rejects(bad.adapter.list(query, signal()), fails(502));
  }
  const missing = await setup("BO", definition("BO"), { ...provider("BO"), detail: async () => null }); assert.equal(await missing.adapter.detail(recordId, signal()), null);
});
test("Raw unauthorized fields are omitted and invalid typed values are rejected", async () => {
  const { adapter } = await setup("BO"); const result = await adapter.detail(recordId, signal()); assert.equal(result?.row.secret, undefined);
  const invalid = await setup("BO", definition("BO"), { ...provider("BO"), detail: async () => ({ row: { ...row, count: "not a number" } as unknown as typeof row, centerId: center }) });
  await assert.rejects(invalid.adapter.detail(recordId, signal()), fails(502));
});
test("Read-only providers cannot be upgraded by schema capabilities", async () => {
  await assert.rejects(setup("BO", definition("BO", true)), fails(403));
  const original = definition("BO"); await assert.rejects(setup("BO", { ...original, capabilities: { ...original.capabilities, create: "fixture.edit" } }), fails(403));
});
test("Concrete read providers reuse existing facades without registering live pilots", async () => {
  const api = server("HO"); const actual = hoCentersProvider((row): { id: string; name: string; count: number; secret: undefined } => ({ id: row.id, name: row.name, count: 0, secret: undefined }));
  const fetcher: typeof fetch = (input, init) => api.fetcher(input, { ...init, credentials: "same-origin", cache: "no-store", redirect: "error" });
  const records = await actual.list(query, { surface: "HO" }, fetcher, signal()); assert.equal(records.total, 1); assert.equal(records.records[0].row.name, "Center fixture");
  await assert.rejects(actual.detail(center, { surface: "BO", centerId: center }, api.fetcher, signal()), fails(403));
  const planning = boPlanningProvider<F>(other, snapshot => snapshot.assignments.map(item => ({ row: { ...row, id: item.id }, centerId: item.centerId })));
  await assert.rejects(planning.detail(recordId, { surface: "HO" }, api.fetcher, signal()), fails(403));
  assert.equal(readFileSync("app/ho/centers/HoCenters.tsx", "utf8").includes("createHoTddAdapter"), false);
});

async function inBrowser<T>(origin: string, run: () => Promise<T>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: new URL(origin) } });
  try { return await run(); } finally { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); }
}
function viewsDefinition(surface: "BO" | "HO"): SurfaceDefinition<F> {
  const base = definition(surface);
  return { ...base, capabilities: { ...base.capabilities, manageSharedViews: "bo.shared_view.manage" }, table: { ...base.table, views: { ...base.table.views, builtIn:[{id:"active-default",label:"Active default",state:query}], saved: { kind: "authorized-service", source: { adapter: "shared-views", permission: "fixture.read" }, scopes: ["shared"], conflict: "version" } } } };
}
test("Real Shared Views transport preserves versions and supports authorized CRUD without personal ownership synthesis", async () => inBrowser("https://bo.staging.pinohouse.art", async () => {
  const { adapter, state } = await setup("BO", viewsDefinition("BO"));
  const config = toSharedConfig(adapter.schema, query);
  state.views = [{ id: recordId, name: "Original", moduleKey: "students", position: 0, version: 4, config }];
  const value = await adapter.views(signal()); assert.ok(value.transport); assert.equal(value.transport.views[0].version, "4");
  const out=renderToStaticMarkup(h(TddTable<F>,{registry:adapter.registry,schema:adapter.schema,context:adapter.context,rows:(await adapter.list(query,signal())).rows,query,status:"ready",total:25,onQueryChange(){},onOpen(){},viewTransport:value.transport}));
  assert.match(out,/Tất cả/);assert.match(out,/Active default/);assert.match(out,/Original/);assert.equal(adapter.schema.table.views.builtIn.length,1);
  let next = await value.transport.write(value.transport.views.map(v => ({ ...v, name: "Renamed" })), adapter.context, signal());
  assert.equal(next[0].name, "Renamed"); assert.equal(next[0].version, "5");
  const rename = state.calls.find(v => v.method === "PATCH" && v.path.endsWith("/rename"))!;
  assert.deepEqual(rename.body, { expectedVersion: 4, name: "Renamed" });
  next = await value.transport.write([...next, { id: "local-draft", name: "New shared view", state: query }], adapter.context, signal());
  assert.equal(next.length, 2); assert.equal(next[1].id, other); assert.equal(next[1].version, "1");
  next = await value.transport.write(next.filter(v => v.id !== other), adapter.context, signal()); assert.equal(next.length, 1);
  const remove = state.calls.find(v => v.method === "DELETE")!; assert.deepEqual(remove.body, { expectedVersion: 1 });
  assert.equal(state.calls.some(v => String(JSON.stringify(v.body)).includes("ownerId")), false);
}));
test("Shared View grants, wrong module and 409 remain authoritative; there is no retry or fallback", async () => inBrowser("https://bo.staging.pinohouse.art", async () => {
  const { adapter, state } = await setup("BO", viewsDefinition("BO")); const config = toSharedConfig(adapter.schema, query);
  state.views = [{ id: recordId, name: "Original", moduleKey: "students", position: 0, version: 1, config }];
  const value = (await adapter.views(signal())).transport!;
  state.viewStatus = 409;
  await assert.rejects(value.write(value.views.map(v => ({ ...v, name: "Conflict" })), adapter.context, signal()), error => (error as {status?:number}).status === 409);
  assert.equal(state.calls.filter(v => v.method === "PATCH").length, 1); assert.equal(state.views[0].name, "Original");
  state.viewStatus = 200; state.permissions = state.permissions.filter(p => p !== "bo.shared_view.manage");
  await assert.rejects(value.write([], adapter.context, signal()), fails(403)); assert.equal(state.calls.some(v => v.method === "DELETE"), false);
  state.viewStatus = 403; await assert.rejects(adapter.views(signal()), error => (error as {status?:number}).status === 403);
  assert.equal(adapter.context.authorize("fixture.read"),true); assert.equal((await adapter.list(query,signal())).rows.length,1);
  state.viewStatus = 200; state.permissions.push("bo.shared_view.manage"); state.views[0].moduleKey = "roles";
  await assert.rejects(adapter.views(signal()), error => (error as {status?:number}).status === 502);
}));
test("Incompatible Shared Views are retained through unrelated writes without filter rewriting", async () => inBrowser("https://bo.staging.pinohouse.art", async () => {
  const { adapter, state } = await setup("BO", viewsDefinition("BO")); const config = toSharedConfig(adapter.schema, query);
  const incompatible = { ...config, filters: [{ field: "count", operator: "contains" as const, value: "sensitive operand" }] };
  state.views = [{ id: other, name: "Incompatible", moduleKey: "students", position: 0, version: 7, config: incompatible }, { id: recordId, name: "Good", moduleKey: "students", position: 1, version: 1, config }];
  const value = await adapter.views(signal()); assert.deepEqual(value.unavailable, [{ id: other, name: "Incompatible" }]); assert.equal(value.transport!.views.length, 1);
  await value.transport!.write(value.transport!.views.map(v => ({ ...v, name: "Renamed good" })), adapter.context, signal());
  assert.deepEqual(state.views[0].config, incompatible); assert.equal(state.views[0].version, 7); assert.equal(state.calls.some(v => v.method === "DELETE"), false);
  assert.throws(() => toSharedConfig(adapter.schema, { ...query, group: { field: "name", direction: "desc", collapsed: [], hidden: [], hideEmpty: true } }), /cannot persist/);
  assert.deepEqual(fromSharedConfig(adapter.schema, config), query);
}));
test("Unsupported personal ownership and HO Views endpoints are unavailable, never emulated", async () => {
  const ho = await setup("HO", viewsDefinition("HO")); await assert.rejects(ho.adapter.views(signal()), fails(404)); assert.equal(ho.state.calls.some(v => v.path.startsWith("views/")), false);
  const base = viewsDefinition("BO"); const personal = await setup("BO", { ...base, table: { ...base.table, views: { ...base.table.views, saved: { kind: "authorized-service", source: {adapter:"views",permission:"fixture.read"}, scopes: ["personal"], conflict: "version" } } } });
  await assert.rejects(personal.adapter.views(signal()), fails(404)); assert.equal(personal.state.calls.some(v => v.path.startsWith("views/")), false);
});

const editFields = [fields[0], fields[1], { ...fields[2], readOnly: false, capabilities: { ...caps, inlineEdit: true } }, fields[3]] as const;
type E = typeof editFields;
type FixtureRow = typeof row;
async function editable(change: (value: FixtureRow) => FixtureRow = row => row, errorStatus?: number) {
  const api = server("BO"); let calls = 0;
  const base = definition("BO", true);
  const options = { ...api, registry: new TddRegistry(), centerId: center, definition: { ...base, fields: editFields, table: { ...base.table, views: { ...base.table.views, builtIn: [] } } }, provider: {
    pagination: "server",
    list: async (_query,scope,fetcher,signal) => ({records:[(await provider("BO").detail(recordId,scope,fetcher,signal))!],total:1}),
    detail: (id,scope,fetcher,signal) => provider("BO").detail(id,scope,fetcher,signal),
    mutationCenter: (row: {readonly id:string}) => (row as typeof row & {centerId:string}).centerId,
    mutation: () => ({ update: async (_id: string, patch: {readonly count?:number|null}, _version: string) => { calls++; if (errorStatus) throw new BoApiError(errorStatus, "Rejected", null); return { status: "saved" as const, row: change({ ...row, count: patch.count ?? 2 }), version: "2" }; } }),
  } satisfies SurfaceProvider<E> };
  return { ...api, adapter: await createBoTddAdapter<E>(options, signal()), get calls() { return calls; } };
}
test("Authorized mutation preserves identity/version and rejects protected or malformed fields", async () => {
  const current = await editable(); const mutate = current.adapter.mutation!;
  assert.equal(current.adapter.capabilities.edit,true);
  const result = await mutate.update(recordId, { count: 9 }, "1", current.adapter.context, signal()); assert.equal(result.status, "saved"); if (result.status === "saved") { assert.equal(result.row.count, 9); assert.equal(result.row.secret, undefined); assert.equal(result.version, "2"); }
  assert.equal(current.calls, 1);
  assert.equal((await mutate.update(recordId, { count: 9 }, "obsolete", current.adapter.context, signal())).status, "conflict"); assert.equal(current.calls, 1);
  await assert.rejects(mutate.update(recordId, { id: other } as never, "1", current.adapter.context, signal()), fails(403));
  await assert.rejects(mutate.update(recordId, { count: "bad" } as never, "1", current.adapter.context, signal()), fails(400)); assert.equal(current.calls, 1);
});
test("Mutation rejects cross-record/Center results, revoked grants and real 403/409/transport errors", async () => {
  const wrongId = await editable(row => ({ ...row, id: other })); await assert.rejects(wrongId.adapter.mutation!.update(recordId, { count: 3 }, "1", wrongId.adapter.context, signal()), fails(502));
  const wrongCenter = await editable(row => ({ ...row, centerId: other })); await assert.rejects(wrongCenter.adapter.mutation!.update(recordId, { count: 3 }, "1", wrongCenter.adapter.context, signal()), fails(403));
  const revoked = await editable(); revoked.state.permissions = revoked.state.permissions.filter(p => p !== "fixture.edit"); await assert.rejects(revoked.adapter.mutation!.update(recordId, { count: 3 }, "1", revoked.adapter.context, signal()), fails(403)); assert.equal(revoked.calls, 0);
  for (const status of [403, 409, 503]) { const current = await editable(row => row, status); await assert.rejects(current.adapter.mutation!.update(recordId, { count: 3 }, "1", current.adapter.context, signal()), fails(status)); assert.equal(current.calls, 1); }
});
test("A late mutation response cannot expose data after edit permission is revoked", async () => {
  let revoke = () => {};
  const current = await editable(row => { revoke(); return row; }); revoke = () => { current.state.permissions = ["team.bo.access", "fixture.read"]; };
  await assert.rejects(current.adapter.mutation!.update(recordId, { count: 5 }, "1", current.adapter.context, signal()), fails(403));
});

test("Real subject history requires an authorized record and preserves truthful empty/unavailable/denied", async () => {
  const base = definition("BO"); const current = await setup("BO", { ...base, capabilities: { ...base.capabilities, history: "fixture.history" } }, { ...provider("BO"), history: boSubjectHistory("student_profile", "fixture.history") });
  assert.deepEqual(current.adapter.subject(recordId), {type:"student_profile",id:recordId});
  assert.deepEqual(await current.adapter.history(current.adapter.subject(recordId), signal()), { status: "authorized", events: [], nextCursor: null });
  assert.ok(current.state.calls.some(v => v.path === "audit/subject"));
  current.state.permissions = ["team.bo.access", "fixture.read"];
  assert.deepEqual(await current.adapter.history(current.adapter.subject(recordId), signal()), {status:"denied"});
  const ho = await setup("HO"); assert.deepEqual(await ho.adapter.history(ho.adapter.subject(recordId), signal()), {status:"unavailable",reason:"Chưa có lịch sử khả dụng"});
});
test("History cannot read a cross-Center subject or expose unredacted/raw audit data", async () => {
  const base = definition("BO"), def = { ...base, capabilities: { ...base.capabilities, history: "fixture.history" } };
  const current = await setup("BO", def, { ...provider("BO"), history: boSubjectHistory("student_profile", "fixture.history") }); current.state.wrongCenter = true;
  assert.deepEqual(await current.adapter.history(current.adapter.subject(recordId), signal()), {status:"denied"}); assert.equal(current.state.calls.some(v => v.path === "audit/subject"), false);
  const invalid = await setup("BO", def, { ...provider("BO"), history: { subjectType: "student_profile", bind: () => ({ kind: "provider", source: {adapter:"invalid",permission:"fixture.history"}, load: async subject => ({ status:"authorized",nextCursor:null,events:[{id:"event",at:"2026-10-28T00:00:00Z",actor:"Redacted",action:"changed",outcome:"succeeded",source:"Core",subject,redacted:false} as never] }) }) } });
  await assert.rejects(invalid.adapter.history(invalid.adapter.subject(recordId), signal()), /unauthorized|malformed/);
});

test("Transport rejects cross-host endpoints, caller credentials and HO write methods", async () => {
  const api = server("BO"); const session = surfaceSession("BO", api.origin, api.fetcher, {id:center,source:"centers"}); await session.refresh(signal());
  await assert.rejects(session.transport("https://ho.staging.pinohouse.art/api/bo/centers"), fails(404));
  await assert.rejects(session.transport("/api/bo/centers", {headers:{authorization:"forged"}}), fails(403));
  session.dispose(); await assert.rejects(session.transport("/api/bo/centers"), {name:"AbortError"});
  const ho = server("HO"); const session2 = surfaceSession("HO", ho.origin, ho.fetcher); await assert.rejects(session2.transport("/api/bo/centers", {method:"POST"}), fails(404));
});
test("Read-only data and history transports cannot dispatch a write even through a defective provider", async () => {
  const api = await setup("BO", definition("BO"), { ...provider("BO"), list: async (_query,_scope,fetcher,signal) => { await fetcher("/api/bo/centers",{method:"POST",signal}); return {records:[],total:0}; } });
  await assert.rejects(api.adapter.list(query,signal()),fails(403)); assert.equal(api.state.http.some(v=>v.init?.method==="POST"),false);
});
test("An older context response cannot restore revoked grants", async () => {
  const api=server("BO"); let hold=false,release!:(value:Response)=>void;
  const fetcher:typeof fetch=(input,init)=>hold&&String(input).endsWith("/context")?(hold=false,new Promise(resolve=>{release=resolve;})):api.fetcher(input,init);
  const session=surfaceSession("BO",api.origin,fetcher,{id:center,source:"centers"});await session.refresh(signal());hold=true;
  const old=session.refresh(signal());api.state.permissions=["team.bo.access"];await session.refresh(signal());
  release(Response.json({data:{userId:"user-a",surface:"BO",entitled:true,permissionKeys:["team.bo.access","fixture.read"]}}));
  await assert.rejects(old,fails(409));assert.equal(session.context.authorize("fixture.read"),false);
});
test("Typed query rejects unauthorized registered columns and unsupported filters before a provider call", async () => {
  const {adapter,state}=await setup("BO"); const before=state.calls.filter(v=>v.path.startsWith("student-visits")).length;
  await assert.rejects(adapter.list({...query,visible:[...query.visible,"secret"]},signal()),fails(400));
  await assert.rejects(adapter.list({...query,filters:{logic:"AND",rules:[{field:"count",op:"contains",value:"bad"} as never]}},signal()),fails(400));
  assert.equal(state.calls.filter(v=>v.path.startsWith("student-visits")).length,before);
});
test("Latest-only adapter loads cannot commit a previous selection even when a provider ignores cancellation", async () => {
  let release!: (value: string) => void; const request = latestRequest<string>(), committed: string[] = [];
  const pending = request.run(() => new Promise(resolve => {release=resolve;}), value => committed.push(value), () => assert.fail("old error"));
  await request.run(async () => "new-record", value => committed.push(value), () => assert.fail()); release("old-record"); await pending; assert.deepEqual(committed,["new-record"]);
});
test("Factory opt-in delegates to the same controller and compatibility inventory is not bulk migrated", async () => {
  const { adapter } = await setup("BO"); const navigation: AdapterNavigation<F> = {read:()=>({kind:"table",query,tab:"overview"}),change(){},subscribe:()=>()=>{},capture(){},restore(){}};
  const require = createRequire(import.meta.url), prior = require.extensions[".css"]; require.extensions[".css"] = loaded => {loaded.exports={};};
  try { const { BoModuleFactory } = require("../app/bo/architecture/BoModuleFactory") as typeof import("../app/bo/architecture/BoModuleFactory"); const out = renderToStaticMarkup(h(BoModuleFactory<F>, {moduleKey:"students",adapter:{list:async()=>assert.fail("legacy load")},tddAdapter:{adapter,navigation,initialQuery:query}})); assert.match(out,/data-tdd-shell="table"/); }
  finally { if(prior)require.extensions[".css"]=prior;else delete require.extensions[".css"]; }
  const registry = new TddRegistry(); assert.throws(()=>registry.registerCompatibility({classification:"GRANDFATHERED",surface:"BO",key:"legacy",route:"/bo/legacy",owner:"fixture",evidence:"fixture only",migrationTask:"PAP-1075"}),/not verified/);
  assert.throws(()=>registry.registerCompatibility({classification:"FOUNDER_APPROVED_SPECIAL",surface:"BO",key:"special",route:"/bo/*",approval:{jira:"PAP-1085",owner:"fixture",designAuthority:"fixture",files:["fixture.tsx"],tests:["fixture.test.ts"],reviewBy:"2026-12-01"}}),/classification/);
  const approval = {jira:"PAP-1085",owner:"fixture only",designAuthority:"fixture",files:["fixture.tsx"],tests:["fixture.test.ts"],reviewBy:"2026-12-01"};
  const scoped = new TddRegistry((entry, scope) => entry.jira === approval.jira && scope.route === "/ho/system/audit" && scope.surface === "HO", screen => screen.route === "/bo/legacy" && screen.migrationTask === "PAP-1075");
  assert.equal(scoped.registerCompatibility({classification:"FOUNDER_APPROVED_SPECIAL",surface:"HO",key:"special",route:"/ho/system/audit",approval}).classification,"FOUNDER_APPROVED_SPECIAL");
  assert.equal(scoped.registerCompatibility({classification:"GRANDFATHERED",surface:"BO",key:"legacy",route:"/bo/legacy",owner:"fixture only",evidence:"fixture deployment manifest",migrationTask:"PAP-1075"}).classification,"GRANDFATHERED");
  assert.throws(()=>scoped.registerCompatibility({classification:"FOUNDER_APPROVED_SPECIAL",surface:"BO",key:"unapproved",route:"/bo/unapproved",approval}),/not verified/);
});

test("PAP-1070 Table-only query/view updates never restore stale focus/scroll; record return does", () => {
  for (const previous of ["table", "drawer", "detail"] as const) {
    for (const next of ["table", "drawer", "detail"] as const) {
      assert.equal(
        shouldRestoreTableAfterNavigation(previous, next),
        next === "table" && previous !== "table",
        previous + " -> " + next,
      );
    }
  }
  assert.equal(shouldRestoreTableAfterNavigation("table", "table"), false, "sort/filter/search/View changes retain current scroll");
  assert.equal(shouldRestoreTableAfterNavigation("detail", "table"), true, "Back from Detail restores selected row");
  assert.equal(shouldRestoreTableAfterNavigation("drawer", "table"), true, "Closing Drawer restores row focus");
});

for (const surface of ["BO", "HO"] as const) test(`${surface}: navigation retains selection/tab/query/history and restores focus/scroll`, () => {
  const keys = ["window","location","history","document","HTMLElement","requestAnimationFrame"] as const;
  const previous = new Map(keys.map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let url = new URL(surface === "HO" ? "https://ho.staging.pinohouse.art/ho/centers" : "https://bo.staging.pinohouse.art/bo");
  let owned: Record<string,unknown> = {otherOwner:"preserved"}; const stack: {url:string;state:Record<string,unknown>}[] = [];
  let focus = 0, restored: number[] = [], notifications = 0;
  class ElementFixture {isConnected=true;focus(){focus++;}}
  const element = new ElementFixture(), table = {scrollLeft:22,scrollTop:33};
  const events = new EventTarget();
  const fakeHistory = {get state(){return owned;},pushState(state:Record<string,unknown>,_title:string,path:string){stack.push({url:url.href,state:owned});owned=state;url=new URL(path,url);},replaceState(state:Record<string,unknown>,_title:string,path:string){owned=state;url=new URL(path,url);}};
  const fakeWindow = {get location(){return url;},scrollX:10,scrollY:20,scrollTo:(...values:number[])=>{restored=values;},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events)};
  const values: Record<string,unknown> = {window:fakeWindow,history:fakeHistory,document:{activeElement:element,getElementById:()=>table,querySelectorAll:()=>[]},HTMLElement:ElementFixture,requestAnimationFrame:(callback:()=>void)=>callback()};
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,...(key==="location"?{get:()=>url}:{value:values[key]})});
  try {
    const nav=browserTddNavigation(surface,surface==="HO"?"centers":"students",query); const unsubscribe=nav.subscribe(()=>notifications++);
    nav.capture(recordId); nav.change({kind:"drawer",recordId,tab:"overview",query});
    assert.equal(new URLSearchParams(url.search).get("record"),recordId); assert.equal(nav.read().kind,"drawer");
    const changed={...query,page:2 as const}; nav.change({kind:"detail",recordId,tab:"history",query:changed});
    assert.equal(nav.read().tab,"history"); assert.equal(nav.read().query.page,2); assert.equal(owned.otherOwner,"preserved");
    nav.change({...nav.read(),tab:"overview"},true); assert.equal(stack.length,2);
    const back=stack.pop()!;url=new URL(back.url);owned=back.state;events.dispatchEvent(new Event("popstate"));assert.equal(nav.read().kind,"drawer");
    nav.change({kind:"table",tab:"overview",query:changed});table.scrollLeft=0;table.scrollTop=0;nav.restore();assert.equal(focus,1);assert.deepEqual(restored,[10,20]);assert.deepEqual(table,{scrollLeft:22,scrollTop:33});
    assert.equal(notifications,5);unsubscribe();
    assert.throws(()=>browserTddNavigation(surface,"not-registered",query),/mismatch/);
    if(surface==="BO") {url=new URL("https://bo.staging.pinohouse.art/bo?module=parents");assert.throws(()=>browserTddNavigation("BO","students",query),/mismatch/);url=new URL("https://bo.staging.pinohouse.art/bo?module=not-registered");assert.throws(()=>browserTddNavigation("BO","not-registered",query),/mismatch/);}
  } finally {for(const key of keys){const descriptor=previous.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});

for(const surface of ["BO","HO"] as const)test(`${surface}: approved module defaults remain independent from Custom Views and fail closed`,async()=>{
  const base=definition(surface), active={id:"active",label:"Active default",state:{...query,filters:{logic:"AND" as const,rules:[{field:"count" as const,op:"eq" as const,value:2}]}}};
  const def={...base,table:{...base.table,filters:{...base.table.filters,fields:["count","secret"] as const},views:{...base.table.views,builtIn:[active,{id:"restricted",label:"Restricted default",state:{...query,filters:{logic:"AND" as const,rules:[{field:"secret" as const,op:"contains" as const,value:"private"}]}}}]}}};
  const {adapter,state}=await setup(surface,def);assert.equal(adapter.schema.table.views.builtIn.length,2);assert.equal((await adapter.list(adapter.schema.table.views.builtIn[0].state,signal())).rows.length,1);
  const before=state.calls.filter(v=>v.path.startsWith("student-visits")).length;
  await assert.rejects(adapter.list(adapter.schema.table.views.builtIn[1].state,signal()),fails(403));assert.equal(state.calls.filter(v=>v.path.startsWith("student-visits")).length,before);
  await assert.rejects(setup(surface,{...base,table:{...base.table,views:{...base.table.views,builtIn:[active,active]}}}),/duplicate/);
  await assert.rejects(setup(surface,{...base,table:{...base.table,views:{...base.table.views,builtIn:[{...active,state:{...query,filters:{logic:"AND",rules:[{field:"count",op:"contains",value:"invalid"} as never]}}}]}}}),/operator/);
  assert.equal((await setup(surface)).adapter.schema.table.views.builtIn.length,0);
});
