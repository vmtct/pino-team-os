/**
 * PAP-929: migration ledger for frozen BO legacy page/navigation paths.
 *
 * A route cannot disappear silently, and retired names cannot be resurrected.
 * Migrated routes must actually satisfy PAP-926/928 canonical runtime factory
 * admission, even if the file path was grandfathered in 2026-10-22 baseline.
 *
 * This file is source-governance only. Secure CI/reviewer settings are external.
 */
import fs from "node:fs";
import path from "node:path";

const KINDS = ["adoptedRoutes","retiredRoutes","adoptedNavigation","retiredNavigation"];
const ISSUE=/^PAP-[1-9][0-9]{0,5}$/;
const ENTRY_KEYS=new Set(["path","issue"]);
const TOP_KEYS=new Set(["version","strictLegacy",...KINDS]);

export function verifyBoLegacyLedger({root,baseline,routes,nav,definitions,issues,canonical}){
  const ledgerPath=path.join(root,"app/bo/architecture/legacy-migration-ledger.json");
  let ledger;
  try {ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));}
  catch(e){issues.push("Missing/malformed BO legacy migration ledger: "+String(e));return {strictLegacy:false,coverage:{}};}
  if(!ledger || typeof ledger!=="object"||Array.isArray(ledger) ||
    Object.keys(ledger).some(key=>!TOP_KEYS.has(key)) ||
    ledger.version!==1 || typeof ledger.strictLegacy!=="boolean" ||
    KINDS.some(k=>!Array.isArray(ledger[k]))) {
    issues.push("Invalid BO legacy ledger version/mode/keys");return {strictLegacy:false,coverage:{}};
  }
  const legacyRoutes=new Set(baseline.legacyRoutes),legacyNav=new Set(baseline.legacyNavigation);
  const liveRoutes=new Set(routes),liveNav=new Set(nav);
  const byHref=new Map(definitions.map(x=>[x.href,x]));
  const indexes={};
  for(const kind of KINDS){
    const allowable=kind.endsWith("Routes")?legacyRoutes:legacyNav;
    const set=new Set();
    indexes[kind]=set;
    for(const row of ledger[kind]){
      if(!row||typeof row!=="object"||Array.isArray(row) ||
         Object.keys(row).some(key=>!ENTRY_KEYS.has(key)) ||
         typeof row.path!=="string" || !allowable.has(row.path) ||
         typeof row.issue!=="string" || !ISSUE.test(row.issue) ||
         set.has(row.path)){
        issues.push(`Invalid/duplicate legacy ${kind} receipt`);
        continue;
      }
      set.add(row.path);
    }
  }
  const {adoptedRoutes,retiredRoutes,adoptedNavigation,retiredNavigation}=indexes;
  for(const file of legacyRoutes){
    const exists=liveRoutes.has(file);
    const adopted=adoptedRoutes.has(file),retired=retiredRoutes.has(file);
    if(adopted&&retired)issues.push(`Legacy page has conflicting adopted+retired receipts: ${file}`);
    if(retired&&exists)issues.push(`Retired legacy BO page reintroduced: ${file}`);
    if(adopted&&!exists)issues.push(`Adopted legacy BO page missing: ${file}`);
    if(!exists&&!retired)issues.push(`Legacy BO page disappeared without retirement receipt: ${file}`);
    const legacyHref="/bo/"+file.slice("app/bo/".length,-"/page.tsx".length);
    if(exists&&byHref.has(legacyHref)&&!adopted)issues.push(`Registered legacy BO page requires adoption receipt: ${file}`);
    if(adopted&&exists){
      const href="/bo/"+file.slice("app/bo/".length,-"/page.tsx".length);
      const def=byHref.get(href);
      if(!def)issues.push(`Adopted legacy BO page lacks registered module: ${file}`);
      else canonical(file,def.key);
    }
  }
  for(const href of legacyNav){
    const exists=liveNav.has(href),adopted=adoptedNavigation.has(href),retired=retiredNavigation.has(href);
    if(adopted&&retired)issues.push(`Legacy navigation has conflicting adopted+retired receipts: ${href}`);
    if(retired&&exists)issues.push(`Retired legacy BO navigation reintroduced: ${href}`);
    if(adopted&&!exists)issues.push(`Adopted legacy BO navigation missing: ${href}`);
    if(!exists&&!retired)issues.push(`Legacy navigation disappeared without retirement receipt: ${href}`);
    if(adopted&&exists&&!byHref.has(href))issues.push(`Adopted legacy BO navigation lacks registry: ${href}`);
    if(exists&&byHref.has(href)&&!adopted)issues.push(`Registered legacy BO navigation requires adoption receipt: ${href}`);
  }
  if(ledger.strictLegacy){
    for(const file of legacyRoutes){
      if(!adoptedRoutes.has(file)&&!retiredRoutes.has(file))
        issues.push(`Strict BO legacy mode cannot grandfather route: ${file}`);
    }
    for(const href of legacyNav){
      if(!adoptedNavigation.has(href)&&!retiredNavigation.has(href))
        issues.push(`Strict BO legacy mode cannot grandfather navigation: ${href}`);
    }
  }
  return {strictLegacy:ledger.strictLegacy,coverage:{
    adoptedRoutes:adoptedRoutes.size,retiredRoutes:retiredRoutes.size,
    adoptedNavigation:adoptedNavigation.size,retiredNavigation:retiredNavigation.size,
  }};
}
