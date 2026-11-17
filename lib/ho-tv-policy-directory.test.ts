/** PAP-650 / PNR-TV · PAP-1386 / PAP-1419: HO S3 exact Core read contracts. */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TvPolicyDirectory } from "../app/ho/pinoria/tv-policies/TvPolicyDirectory";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { defaultTable } from "./bo-registration";
import { isHoTvReadRequest, parseHoTvRead, InvalidTvReadQuery } from "./ho-tv-read-contract";
import { HO_STAGING_HOSTNAME, BO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { loadHoTvPolicyDirectory, presentHoTvPolicyRows, readHoTvPolicyDirectory, tvPolicyModule } from "./ho-tv-policy-directory";

const c1 = "019b1126-0001-7000-8000-000000000001";
const defaultRow = {
  id: "tvp1-default", centerId: null, name: "Ambient Welcome · Mặc định",
  typeName: "Ambient Welcome", scope: "DEFAULT", center: null,
  resolution: "UNCONFIGURED", inherited: null, active: null, latest: null,
  displaysCount: null, aspectRatio: "16:9",
  createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null,
  visibility: { name: "Ambient Welcome · Mặc định", scope: "DEFAULT",
    assignedCenterIds: [], assignedCenterNames: [], revision: 0 },
};
const centerRow = {
  ...defaultRow, id: "tvp1-center-" + c1, centerId: c1, scope: "CENTER",
  name: "Ambient Welcome · Cần Thơ", center: "Cần Thơ",
  visibility: {name: "Ambient Welcome · Cần Thơ", scope: "CENTER",
    assignedCenterIds: [c1], assignedCenterNames: ["Cần Thơ"], revision: 0},
  resolution: "INHERITED", inherited: "DEFAULT", active: 1, latest: null,
};
const answer = (data: unknown, status = 200) =>
  new Response(JSON.stringify({data}), {status, headers: {"content-type": "application/json"}});
const reply = (data: unknown, status = 200): typeof fetch =>
  (async () => answer(data, status)) as typeof fetch;

test("V3.2 projects exactly 13 approved read-only logical-TV fields and audit quartet", () => {
  assert.deepEqual(tvPolicyModule.fields.map(f => f.label), [
    "Policy", "Loại TV", "Scope", "Center", "Effective State", "Inherited From",
    "Active Revision", "Head Revision", "Frame", "Created Time",
    "Created by (User)", "Last Modified Time", "Last Modified by (User)",
  ]);
  const state = defaultTable(tvPolicyModule.fields);
  assert.equal(state.visible.length, 13);
  assert.deepEqual(state.visible, state.order);
  assert.ok(tvPolicyModule.fields.every(f => f.readonly));
});

test("private HO Directory is exact GET with bounded unique query; other hosts and writes denied", () => {
  const path = "/api/ho/pinoria/tv-policies/directory";
  const parse = (suffix = "") => parseHoTvRead(new URL("https://" + HO_STAGING_HOSTNAME + path + suffix));
  assert.equal(isHoTvReadRequest(path, "GET"), true);
  assert.deepEqual(parse(), {path: "pinoria/tv-policies/directory", body: {limit: 25, offset: 0}});
  assert.deepEqual(parse("?limit=50&offset=0"), {path: "pinoria/tv-policies/directory", body: {limit: 50, offset: 0}});
  for (const suffix of ["?debug=true", "?limit=51", "?limit=0", "?limit=02", "?offset=-1",
    "?offset=10001", "?limit=25&limit=25"]) assert.throws(() => parse(suffix), InvalidTvReadQuery);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"])
    assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path, method).action, "not_found");
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path, "GET").action, "next");
  assert.equal(decideHostBoundary(BO_STAGING_HOSTNAME, path, "GET").action, "not_found");
  for (const wrong of ["tv-policies", "tv-policy", "tv-policies/directory/extra",
    "tv-config/policy/directory", "tv-health/policies"])
    assert.equal(isHoTvReadRequest("/api/ho/pinoria/" + wrong, "GET"), false);
});

test("unverified initial Core Directory and SSR Table never fabricate rows or zero count", () => {
  const read = readHoTvPolicyDirectory();
  assert.equal(read.status, "unavailable");
  assert.equal(read.total, null);
  assert.deepEqual(read.rows, []);
  const html = renderToStaticMarkup(createElement(TvPolicyDirectory));
  assert.equal((html.match(/<th /g) ?? []).length, 13);
  assert.match(html, /role="status"/);
  assert.match(html, /Đang tải dữ liệu/);
  assert.doesNotMatch(html, /id="result-count"|id="page-range"|data-record=|Mở Quick View|Tạo mới|Mở TV|Sao chép URL/);
});

test("private Core 200 projects only validated source rows with truthful nulls", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return answer({policies: [defaultRow, centerRow], total: 2, limit: 50, offset: 0, nextOffset: null});
  }) as typeof fetch;
  const read = await loadHoTvPolicyDirectory(fetcher);
  assert.equal(read.status, "ready");
  assert.equal(read.total, 2);
  assert.equal(read.rows[0]?.createdByUser, null);
  assert.equal(read.rows[1]?.displaysCount, null);
  assert.equal(read.rows[1]?.inherited, "DEFAULT");
  assert.deepEqual(calls, ["/api/ho/pinoria/tv-policies/directory?limit=50&offset=0"]);
});

test("PAP-1859 Table and Drawer display one authoritative persisted business projection, never legacy twins", async () => {
  const changed = {...centerRow, visibility: {name: "PINO TV — Founder verified",
    scope: "CENTER", assignedCenterIds: [c1], assignedCenterNames: ["Cần Thơ"], revision: 33}};
  const found = await loadHoTvPolicyDirectory(reply({
    policies: [defaultRow, changed], total: 2, limit: 50, offset: 0, nextOffset: null,
  }));
  assert.equal(found.status, "ready");
  const row = found.rows[1]!;
  assert.equal(row.name, "PINO TV — Founder verified");
  assert.equal(row.scope, "CENTER");
  assert.deepEqual(row.center, ["Cần Thơ · 000001"]);
  assert.equal(row.originCenterId, c1);
  assert.equal(row.originCenterName, "Cần Thơ");
  assert.equal(row.visibilityRevision, 33);
  assert.deepEqual(row.visibilityAssignedCenterIds, [c1]);
  const html = renderToStaticMarkup(createElement(BoDataTable, {
    module: tvPolicyModule, rows: [row], loadState: "ready",
    value: defaultTable(tvPolicyModule.fields), update: () => {}, page: 1, setPage: () => {},
    onOpen: () => {}, onSettings: () => {}, filterOpen: false, setFilterOpen: () => {},
    views: [], changeViews: () => {}, activeView: null, applyView: () => {},
    reset: () => {}, undo: () => {}, canUndo: false, openEnabled: true, showChrome: false,
  }));
  assert.match(html, /PINO TV — Founder verified/);
  assert.doesNotMatch(html, /Ambient Welcome · Cần Thơ/);
  const drawer = renderToStaticMarkup(createElement(PropertySections, {
    fields:tvPolicyModule.fields, record:row,
    sections:[{id:"policy",label:"Thông tin Policy",fields:[
      "name","typeName","scope","center","resolution","inherited","active","latest","aspectRatio",
    ]},{id:"audit",label:"Thông tin hệ thống",fields:[
      "createdAt","createdByUser","updatedAt","updatedByUser",
    ]}],variant:"drawer",
  }));
  assert.equal((drawer.match(/class="property-row"/g)??[]).length,13);
  assert.match(drawer, /PINO TV — Founder verified/);
  assert.doesNotMatch(drawer, /Ambient Welcome · Cần Thơ|data-detail-edit=/);
});
test("PAP-1859 independent Core GET after PATCH replaces Name and Center across future Directory reads", async () => {
  const revised = {...centerRow, visibility: {name:"Live revision 34",scope:"CENTER",
    assignedCenterIds:[c1],assignedCenterNames:["Cần Thơ"],revision:34}};
  const baseline=await loadHoTvPolicyDirectory(reply({policies:[defaultRow,centerRow],
    total:2,limit:50,offset:0,nextOffset:null}));
  const updated=await loadHoTvPolicyDirectory(reply({policies:[defaultRow,revised],
    total:2,limit:50,offset:0,nextOffset:null}));
  assert.equal(baseline.rows[1]?.name, "Ambient Welcome · Cần Thơ");
  assert.equal(updated.rows[1]?.name, "Live revision 34");
  assert.equal(updated.rows[1]?.visibilityRevision,34);
});
test("PAP-1859 mutable DEFAULT does not rekey origin Center or remove Center choice",async()=>{
  const row={...centerRow,visibility:{name:"All Centers",scope:"DEFAULT",
    assignedCenterIds:[],assignedCenterNames:[],revision:5}};
  const result=await loadHoTvPolicyDirectory(reply({policies:[defaultRow,row],
    total:2,limit:50,offset:0,nextOffset:null}));
  assert.equal(result.status,"ready");
  assert.equal(result.rows[1]?.scope,"DEFAULT");
  assert.deepEqual(result.rows[1]?.center,["Tất cả Center"]);
  assert.equal(result.rows[1]?.originCenterId,c1);
  assert.equal(result.rows[1]?.originCenterName,"Cần Thơ");
});
test("PAP-1859 Founder may return DEFAULT→CENTER before assigning a Center; Directory remains readable",async()=>{
  // Real Core PATCH contract: scope CENTER with zero assigned Centers is a
  // legitimate intermediate saved state. The UI must show Trống and keep the
  // immutable Policy origin so Founder can open Center picker to finish setup.
  const emptyCenter={...centerRow,visibility:{name:"Pending Center Choice",
    scope:"CENTER",assignedCenterIds:[],assignedCenterNames:[],revision:39}};
  const result=await loadHoTvPolicyDirectory(reply({policies:[defaultRow,emptyCenter],
    total:2,limit:50,offset:0,nextOffset:null}));
  assert.equal(result.status,"ready");
  assert.equal(result.rows[1]?.name,"Pending Center Choice");
  assert.equal(result.rows[1]?.scope,"CENTER");
  assert.deepEqual(result.rows[1]?.center,[]);
  assert.deepEqual(result.rows[1]?.visibilityAssignedCenterIds,[]);
  assert.equal(result.rows[1]?.visibilityRevision,39);
  assert.equal(result.rows[1]?.originCenterId,c1);
  assert.equal(result.rows[1]?.originCenterName,"Cần Thơ");
  const table=renderToStaticMarkup(createElement(BoDataTable,{
    module:tvPolicyModule,rows:[result.rows[1]!],loadState:"ready",
    value:defaultTable(tvPolicyModule.fields),update:()=>{},page:1,setPage:()=>{},
    onOpen:()=>{},onSettings:()=>{},filterOpen:false,setFilterOpen:()=>{},
    views:[],changeViews:()=>{},activeView:null,applyView:()=>{},
    reset:()=>{},undo:()=>{},canUndo:false,openEnabled:true,showChrome:false,
  }));
  assert.match(table,/Pending Center Choice/);
  assert.match(table,/Trống/);
});
test("PAP-1859 fails closed on stale/missing/tampered Core visibility even if Registry is valid",async()=>{
  const malformed=[
    {...centerRow,visibility:undefined},
    {...centerRow,visibility:{...centerRow.visibility,name:""}},
    {...centerRow,visibility:{...centerRow.visibility,name:"Changed with fake revision zero"}},
    {...centerRow,visibility:{...centerRow.visibility,revision:-1}},
    {...centerRow,visibility:{...centerRow.visibility,assignedCenterIds:[c1,c1],
      assignedCenterNames:["Cần Thơ","Cần Thơ"],revision:3}},
    {...centerRow,visibility:{...centerRow.visibility,assignedCenterIds:["019b1126-0001-7000-8000-000000000002"],
      assignedCenterNames:["Unknown"],revision:3}},
    {...centerRow,visibility:{...centerRow.visibility,assignedCenterIds:[c1],
      assignedCenterNames:["Forged origin label"],revision:3}},
    {...centerRow,visibility:{...centerRow.visibility,scope:"DEFAULT",assignedCenterIds:[c1],
      assignedCenterNames:["Cần Thơ"],revision:3}},
  ];
  for(const changed of malformed){
    const result=await loadHoTvPolicyDirectory(reply({policies:[defaultRow,changed],
      total:2,limit:50,offset:0,nextOffset:null}));
    assert.equal(result.status,"unavailable");
    assert.deepEqual(result.rows,[]);
  }
});test("unverified Core payload, fabricated revisions, duplicates and partial pagination fail closed", async () => {
  for (const policies of [
    [{...defaultRow, createdByUser: "unverified"}],
    [{...defaultRow, displaysCount: 0}],
    [{...defaultRow, active: 3}],
    [{...defaultRow, id: "unsafe"}],
    [defaultRow, defaultRow],
  ]) {
    const read = await loadHoTvPolicyDirectory(reply({policies, total: policies.length, limit: 50, offset: 0, nextOffset: null}));
    assert.equal(read.status, "unavailable");
    assert.equal(read.total, null);
    assert.deepEqual(read.rows, []);
  }
  const partial = await loadHoTvPolicyDirectory(reply({policies: [defaultRow], total: 2, limit: 50, offset: 0, nextOffset: null}));
  assert.equal(partial.status, "unavailable");
  assert.deepEqual(partial.rows, []);
});

test("401/403 deny and failed Core read cannot display Policy count or records", async () => {
  for (const status of [401, 403]) {
    const result = await loadHoTvPolicyDirectory(reply(null, status));
    assert.equal(result.status, "denied");
    assert.equal(result.total, null);
    assert.deepEqual(result.rows, []);
  }
  const bad = await loadHoTvPolicyDirectory((async () => new Response("gateway", {status: 503})) as typeof fetch);
  assert.equal(bad.status, "unavailable");
  assert.deepEqual(bad.rows, []);
});

test("shared Table retains original footer behavior unless totalKnown=false", () => {
  const noop = () => {};
  const props = {
    module: tvPolicyModule, rows: [], loadState: "ready", value: defaultTable(tvPolicyModule.fields),
    update: noop, page: 1, setPage: noop, onOpen: noop, onSettings: noop,
    filterOpen: false, setFilterOpen: noop, views: [], changeViews: noop,
    activeView: null, applyView: noop, reset: noop, undo: noop, canUndo: false,
  };
  assert.match(renderToStaticMarkup(createElement(BoDataTable, props)), /id="result-count"/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(BoDataTable, {...props, totalKnown: false})), /id="result-count"/);
});

test("loaded S3 rows are readable but cannot advertise an unimplemented S4 Quick View", () => {
  const noop = () => {};
  const row = {
    id: "tvp1-default", name: "Ambient Welcome", scope: "DEFAULT",
    typeName: "Ambient Welcome", center: null, resolution: "UNCONFIGURED",
    inherited: null, active: null, latest: null, displaysCount: null, aspectRatio: "16:9",
    createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null,
  };
  const html = renderToStaticMarkup(createElement(BoDataTable, {
    module: tvPolicyModule, rows: [row], loadState: "ready",
    value: defaultTable(tvPolicyModule.fields), update: noop, page: 1, setPage: noop,
    onOpen: noop, onSettings: noop, filterOpen: false, setFilterOpen: noop, views: [],
    changeViews: noop, activeView: null, applyView: noop, reset: noop,
    undo: noop, canUndo: false, openEnabled: false, showChrome: false,
  }));
  assert.match(html, /data-record="tvp1-default"/);
  assert.match(html, /disabled=""/);
  assert.doesNotMatch(html, /Mở Quick View|data-open="tvp1-default"/);
});

test("PAP-1419 S3 PINO DS Table exposes usable search/filter/sort without dead Quick View controls", () => {
  const html = renderToStaticMarkup(createElement(TvPolicyDirectory));
  assert.match(html, /id="search"/);
  assert.match(html, /id="filter-toggle"/);
  assert.match(html, /id="visible-columns"/);
  assert.doesNotMatch(html, /id="table-count"|id="result-count"|id="group-shortcut"|id="add-view-tab"|id="save-view"/);
  assert.equal(tvPolicyModule.fields.find(f => f.key === "active")?.type, "number");
  assert.equal(tvPolicyModule.fields.find(f => f.key === "latest")?.type, "number");
});

test("PAP-1419 FSG3 presents real Core nulls as — without changing the shared TDD Table", () => {
  const original = { ...defaultRow, visibility: undefined };
  const presented = presentHoTvPolicyRows([original]);
  assert.notEqual(presented[0], original, "render-only clone, not source mutation");
  for (const key of ["displaysCount", "createdAt", "createdByUser", "updatedAt", "updatedByUser"]) {
    assert.equal(original[key as keyof typeof original], null);
    assert.equal(presented[0][key], "—");
  }
  assert.equal(presented[0].name, original.name);
  const noop = () => {};
  const props = {
    module: tvPolicyModule, rows: presented, loadState: "ready",
    value: defaultTable(tvPolicyModule.fields), update: noop, page: 1, setPage: noop,
    onOpen: noop, onSettings: noop, filterOpen: false, setFilterOpen: noop,
    views: [], changeViews: noop, activeView: null, applyView: noop,
    reset: noop, undo: noop, canUndo: false, openEnabled: false,
  };
  const tv = renderToStaticMarkup(createElement(BoDataTable, props));
  for (const label of ["Created Time", "Created by (User)", "Last Modified Time", "Last Modified by (User)"])
    assert.ok(tv.includes('aria-label="' + label + ': —"'), "unverified audit " + label + " must be —");
  assert.match(tv, /typed-cell readonly/);
  assert.doesNotMatch(tv, /aria-label="Displays:/);
  const baseline = renderToStaticMarkup(createElement(BoDataTable, { ...props, rows: [original] }));
  assert.match(baseline, /aria-label="Created Time: —"/);
  assert.match(baseline, /class="empty-val">Trống<\/span>/);
});
