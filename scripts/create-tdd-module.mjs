/**
 * PAP-1077: Safe, deny-first TDD_DEFAULT BO/HO module starter.
 * No ACL grants, Core endpoints, staging accounts or production mutations.
 */
import fs from "node:fs";
import { tddAcceptanceFiles } from "./tdd-module-acceptance.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const permissionPattern = /^[a-z][a-z0-9_.:-]+$/;
const validSegment = value => typeof value === "string" && value.length <= 60 && keyPattern.test(value);
const json = value => JSON.stringify(value);
const title = key => key.split("-").map(x => x[0].toUpperCase() + x.slice(1)).join("");
const writeData = (filename, body) => ({ filename, body });

export function scaffoldTddModule({ root = repoRoot, surface, key, label, permission }) {
  if (!["bo", "ho"].includes(surface) || !validSegment(key) || typeof label !== "string" ||
      !label.trim() || label.length > 80 || typeof permission !== "string" ||
      !permissionPattern.test(permission) || permission.startsWith("todo") || permission.length > 100) {
    throw Error("Usage: npm run tdd:new-module -- --surface=bo|ho --key=module-key --label='Label' --permission=registered.read.permission");
  }
  const upper = surface.toUpperCase(), route = `/${surface}/${key}`, base = `app/${surface}/${key}`;
  const pascal = title(key), fields = `${pascal}Fields`, definition = `${pascal}Definition`;
  const query = `${pascal}Query`, provider = `${pascal}Provider`, schema = `${pascal}Schema`;
  const component = `${pascal}Tdd`;
  const admitFile = path.join(root, "config/tdd-admission.json");
  const manifest = JSON.parse(fs.readFileSync(admitFile, "utf8"));
  if (!Array.isArray(manifest.modules)) throw Error("TDD admission manifest unavailable");
  if (manifest.modules.some(m => m.route === route || m.file === `${base}/page.tsx` || m.key === key && m.surface === upper)) throw Error("Module already admitted");
  if (fs.existsSync(path.join(root, base))) throw Error("Module path exists; refuse overwrite");
  const perms = json(permission), labelString = json(label.trim());
  const read = `{ display: true, search: true, filter: true, sort: true, group: false, inlineEdit: false }`;
  const schemaBody = `import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters";
import type { ModuleRow } from "@/lib/workspace-schema";

export const ${fields} = [
  { key: "name", label: "Tên", type: "text", icon: "Aa", width: 240, permission: ${perms}, readOnly: true, capabilities: ${read} },
  { key: "status", label: "Trạng thái", type: "text", icon: "Aa", width: 160, permission: ${perms}, readOnly: true, capabilities: ${read} },
] as const satisfies readonly FieldSchema[];
type F = typeof ${fields};
const sections = [{ id: "summary", label: "Thông tin", fields: ["name", "status"] }] as const;
export const ${query}: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null,
  order: ["name", "status"], visible: ["name", "status"], page: 1, pageSize: 15,
};
export const ${definition} = {
  version: 1, classification: "TDD_DEFAULT", surface: "${upper}", key: ${json(key)}, label: ${labelString}, group: "Workspace",
  fields: ${fields}, capabilities: { read: ${perms} },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: [{ field: "name", visible: true }, { field: "status", visible: true }],
    search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["status"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "status"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: [], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: { overview: { sections }, businessTabs: [], history: { kind: "unavailable", reason: "Chưa có nguồn lịch sử được phê duyệt." } },
} as const satisfies SurfaceDefinition<F>;

/** NEVER implement a fake authorized data source to make a PR green. */
export const ${provider}: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope) {
    if (scope.surface !== "${upper}") throw Error("Denied surface");
    throw Error("TODO_TDD_CORE_BACKED_LIST: bind authorized Core API, scope and negative 401/403 tests");
  },
  async detail(_id, scope) {
    if (scope.surface !== "${upper}") throw Error("Denied surface");
    throw Error("TODO_TDD_CORE_BACKED_DETAIL: bind authorized Core API and no-data 404");
  },
};
const registry = new TddRegistry();
export const ${schema} = registry.register({
  ...${definition},
  data: {
    id: ${json(key + "-session-required")},
    list: async (_q: TableQuery<F>, _c, _signal) => { throw Error("TODO_TDD_CORE_BACKED_LIST"); },
    detail: async (_id: string, _c, _signal) => { throw Error("TODO_TDD_CORE_BACKED_DETAIL"); },
  },
});
`;
  const boCenter = upper === "BO" ?
`  // TODO_TDD_AUTHORIZED_CENTER: resolve and validate a real authorized Center from Core.
  const centerId = "";
` : "";
  const ctor = upper === "BO" ?
`createBoTddAdapter({ registry: new TddRegistry(), definition: ${definition}, provider: ${provider}, centerId: centerId }, ctl.signal)` :
`createHoTddAdapter({ registry: new TddRegistry(), definition: ${definition}, provider: ${provider} }, ctl.signal)`;
  const prerequisite = upper === "BO" ? 'if (!centerId) return;' : "";
  const render = upper === "BO" ? `!centerId ? <p role="alert">Chưa xác minh cơ sở đã được cấp quyền.</p> : ` : "";
  const entryBody = `"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { TddRegistry } from "@/lib/workspace-schema";
import { ${upper === "BO" ? "createBoTddAdapter" : "createHoTddAdapter"}, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { ${definition}, ${fields}, ${query}, ${provider} } from "./schema";
type F = typeof ${fields};
type Bound = { adapter: AuthenticatedSurfaceAdapter<F>; navigation: AdapterNavigation<F> };
export function ${component}() {
${boCenter}  const [bound, setBound] = useState<Bound | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    ${prerequisite}
    const ctl = new AbortController();
    let instance: AuthenticatedSurfaceAdapter<F> | null = null;
    void ${ctor}.then(adapter => {
      instance = adapter;
      if (ctl.signal.aborted) { adapter.dispose(); return; }
      setBound({ adapter, navigation: browserTddNavigation("${upper}", ${json(key)}, ${query}) });
    }).catch(() => { if (!ctl.signal.aborted) setError(true); });
    return () => { ctl.abort(); instance?.dispose(); };
  }, [retry${upper === "BO" ? ", centerId" : ""}]);
  return <section aria-label={${labelString}}>
    {${render}error
      ? <p role="alert">Không thể tải module được cấp quyền. <button type="button" onClick={() => {setError(false);setRetry(n => n + 1);}}>Thử lại</button></p>
      : bound ? <SurfaceWorkspace adapter={bound.adapter} navigation={bound.navigation} initialQuery={${query}} />
      : <p role="status">Đang kiểm tra phiên và quyền…</p>}
  </section>;
}
`;
  const specBody = `import test from "node:test";
import assert from "node:assert/strict";
import { ${provider}, ${definition} } from "./schema";

test("PAP-1077 fail closed: no self-authorized data or other surface", async () => {
  assert.equal(${definition}.surface, "${upper}");
  const forbidden = { surface: "${upper === "BO" ? "HO" : "BO"}" };
  await assert.rejects(() => ${provider}.list(null as never, forbidden as never, fetch, new AbortController().signal), /Denied surface/);
});
test("PAP-1077 required acceptance contracts not yet met", () => {
  // TODO_TDD_G2_G4: replace with Center/HO negative auth, keyboard, responsive,
  // real Staging exact-serving-SHA and readback evidence. Never auto-pass.
  assert.fail("TODO_TDD_G2_G4: gated module has no production-ready Core contract");
});
`;
  const files = [
    writeData(`${base}/page.tsx`, `import { ${component} } from "./${component}";\nexport default function ${pascal}Page() { return <${component} />; }\n`),
    writeData(`${base}/${component}.tsx`, entryBody),
    writeData(`${base}/schema.ts`, schemaBody),
    writeData(`${base}/module.test.ts`, specBody),
    ...tddAcceptanceFiles({base, surface: upper, route}),
  ];
  const manifestEntry = {
    profile: "TDD_DEFAULT", surface: upper, key, route, file: `${base}/page.tsx`,
    files: [`${base}/page.tsx`, `${base}/${component}.tsx`, `${base}/schema.ts`],
    externalReferences: upper === "BO" ? [
      {file: "lib/bo-url-contract.ts", owner: "PAP-1089"},
      {file: "lib/host-boundary.ts", owner: "PAP-990"},
    ] : [{file: "lib/ho-routes.ts", owner: "PAP-990"}],
    schema: { file: `${base}/schema.ts`, export: schema },
    binding: { kind: "SURFACE_WORKSPACE_ADAPTER", file: `${base}/${component}.tsx` },
    tests: [`${base}/module.test.ts`, `${base}/acceptance.gates.test.mjs`],
  };
  const nextManifest = JSON.stringify({ ...manifest, modules: [...manifest.modules, manifestEntry] }, null, 2) + "\n";
  files.push(writeData("config/tdd-admission.json", nextManifest));
  if (upper === "BO") {
    const navFile = "app/bo/navigation.ts", nav = fs.readFileSync(path.join(root, navFile), "utf8");
    const anchor = 'items: [{ href: "/bo", label: "Hôm nay" }';
    if (!nav.includes(anchor) || nav.includes(`href: "${route}"`)) throw Error("BO nav anchor missing or route exists");
    files.push(writeData(navFile, nav.replace(anchor, anchor + `, { href: "${route}", label: ${labelString} }`)));
    const urlFile = "lib/bo-url-contract.ts", urls = fs.readFileSync(path.join(root, urlFile), "utf8");
    const urlAnchor = "export const BO_TARGET_ROUTES = [";
    if (!urls.includes(urlAnchor) || urls.includes(`key: ${json(key)}`) || urls.includes(`path: ${json(route)}`)) throw Error("BO URL registry anchor missing or module exists");
    files.push(writeData(urlFile, urls.replace(urlAnchor, urlAnchor + `\n  { key: ${json(key)}, path: ${json(route)}, tabs: ["overview", "history"] },`)));
    const hostFile = "lib/host-boundary.ts", hosts = fs.readFileSync(path.join(root, hostFile), "utf8");
    const hostAnchor = '    if (pathname === "/bo/pinoria-avatars") {';
    if (!hosts.includes(hostAnchor) || hosts.includes(`pathname === ${json(route)}`)) throw Error("BO host admission anchor missing or route exists");
    files.push(writeData(hostFile, hosts.replace(hostAnchor, `    if (pathname === ${json(route)}) {\n      return hostname === BO_STAGING_HOSTNAME && (method === "GET" || method === "HEAD") ? { action: "next" } : { action: "not_found" };\n    }\n` + hostAnchor)));
  } else {
    const hoFile = "lib/ho-routes.ts", source = fs.readFileSync(path.join(root, hoFile), "utf8");
    const anchor = "export const HO_PAGE_PATHS = {";
    if (!source.includes(anchor) || source.includes(`"${route}"`)) throw Error("HO route anchor missing or route exists");
    files.push(writeData(hoFile, source.replace(anchor, anchor + `\n  ${json(key)}: "${route}",`)));
  }
  // Preflight all paths before touching the file system. Never modify existing generated source.
  for (const { filename } of files) {
    const abs = path.join(root, filename);
    if (!fs.existsSync(abs) && !filename.startsWith(base + "/")) throw Error("Unexpected new control path: " + filename);
    if (filename.startsWith(base + "/") && fs.existsSync(abs)) throw Error("Overwrite refused: " + filename);
  }
  fs.mkdirSync(path.join(root, base), { recursive: false });
  for (const { filename, body } of files) fs.writeFileSync(path.join(root, filename), body, "utf8");
  return { route, files: files.map(f => f.filename), status: "DENY_FIRST_PENDING_CORE_AND_G2_G4" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = {};
    for (const x of process.argv.slice(2)) {
      const m = /^--(surface|key|label|permission)=(.*)$/.exec(x);
      if (!m || Object.hasOwn(opts, m[1])) throw Error("Unexpected or repeated CLI argument");
      opts[m[1]] = m[2];
    }
    const result = scaffoldTddModule(opts);
    console.log(JSON.stringify(result, null, 2));
    console.log("FAIL-CLOSED: replace TODO_TDD placeholders; add domain G2/G3/G4 evidence; CI must reject this scaffold until authorized.");
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
