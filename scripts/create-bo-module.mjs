/**
 * PAP-926 BO module scaffold. Creates the canonical entry and registration
 * but deliberately blocks CI until the developer implements a real Core-backed
 * authorized adapter + explicit permission strings.
 *
 * Usage: node scripts/create-bo-module.mjs studio-classes "Studio Classes"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=process.env.PINO_BO_CONTRACT_ROOT ? path.resolve(process.env.PINO_BO_CONTRACT_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const [key,label]=process.argv.slice(2);
if(!key || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key) || !label || !label.trim() || label.trim().length>80){
  console.error('Usage: node scripts/create-bo-module.mjs <lowercase-kebab-key> "Vietnamese label"');
  process.exit(2);
}
const href=`/bo/${key}`,route=path.join(root,"app","bo",key,"page.tsx");
const registerFile=path.join(root,"app","bo","architecture","registry.ts");
const navFile=path.join(root,"app","bo","navigation.ts");
const registry=fs.readFileSync(registerFile,"utf8"),nav=fs.readFileSync(navFile,"utf8");
const marker="  // BO_NEW_MODULE_REGISTRATIONS — GENERATOR APPENDS ABOVE THIS LINE.";
if(fs.existsSync(route)||registry.includes(`key: "${key}"`)||nav.includes(`href: "${href}"`))throw new Error("BO module already exists; refuse overwrite");
if(!registry.includes(marker))throw new Error("Registry generator anchor missing");
const workspaceMarker='items: [{ href: "/bo", label: "Hôm nay" }]';
if(!nav.includes(workspaceMarker))throw new Error("Navigation anchor changed; require manual integration");
const nextRegistry=registry
  .replace('import { defineBoModuleRegistry, type BoModuleContract }', 'import { defineBoModule, defineBoModuleRegistry, type BoModuleContract }')
  .replace(marker,`  defineBoModule({
    key: "${key}",
    href: "${href}",
    label: ${JSON.stringify(label.trim())},
    kind: "entity",
    permissions: { read: "TODO_READ_PERMISSION", write: "TODO_WRITE_PERMISSION" },
    fields: [
      { key: "id", label: "ID", type: "id", readOnly: true },
      { key: "name", label: "Tên", type: "text" },
    ],
    publicViews: "module-shared",
    quickView: "canonical-properties",
    fullDetail: "shared-tabs",
  }),
${marker}`);
const nextNav=nav.replace(workspaceMarker,
  `items: [{ href: "/bo", label: "Hôm nay" }, { href: "${href}", label: ${JSON.stringify(label.trim())} }]`);
if(nextRegistry===registry||nextNav===nav)throw new Error("Generator failed to produce structural changes");
fs.mkdirSync(path.dirname(route),{recursive:true});
const page=`"use client";

import { BoModuleFactory } from "@/app/bo/architecture/BoModuleFactory";
import { moduleAdapter } from "./adapter";

export default function ${key.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join("")}Page() {
  return <BoModuleFactory moduleKey="${key}" adapter={moduleAdapter} />;
}
`;
const adapter=`import type { BoModuleReadAdapter } from "@/app/bo/architecture/BoModuleFactory";

/** Replace this DENY stub with the authorized, bounded domain Core adapter. */
export const moduleAdapter: BoModuleReadAdapter = {
  async list() {
    throw new Error("TODO_BO_DOMAIN_ADAPTER: implement Core-authenticated list with domain ACL");
  },
};
`;
fs.writeFileSync(route,page,{flag:"wx"});
fs.writeFileSync(path.join(path.dirname(route),"adapter.ts"),adapter,{flag:"wx"});
fs.writeFileSync(registerFile,nextRegistry);
fs.writeFileSync(navFile,nextNav);
console.log(`Scaffold created: ${href}. CI WILL FAIL until real adapter and Core permissions replace TODO markers.`);
console.log("Only module registry, route, adapter and Workspace nav were changed.");
