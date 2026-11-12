#!/usr/bin/env node
/** PAP-1895 / Epic PAP-1676 — PINO_DATETIME_V1 hard gate for BO/HO/TOS UI.
 * Existing legacy debt is explicitly indexed, never silently expandable.
 * This audits source declarations; dynamic ISO→ICT behavior is tested in typed tests.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Hash-pinned pre-existing exceptions are migration debt, not new-feature exemptions.
const legacy = JSON.parse(readFileSync(new URL("./pino-datetime-legacy.json", import.meta.url), "utf8"));
if (legacy.version !== "PINO_DATETIME_LEGACY_V1") throw Error("Unapproved PINO datetime debt ledger version");
export const LEGACY_TEXT_TIMESTAMP = Object.freeze(legacy.textTimestampExceptions);
export const LEGACY_UNZONED_UI = Object.freeze(legacy.unZonedLocale);
const normalize = x => x.replaceAll("\\","/");
function walk(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path,{withFileTypes:true}).flatMap(entry=>{
    const next=join(path,entry.name);
    return entry.isDirectory()?walk(next):entry.isFile() && /\.tsx?$/.test(entry.name)?[next]:[];
  });
}
const isTimestamp = key => /At$/.test(key) || /DateTime$/.test(key);
function declaredFields(content) {
  // Field type and label appear before a nested capabilities block in PINO typed schemas.
  return [...content.matchAll(/\{\s*key:\s*["']([A-Za-z]\w*)["']([\s\S]*?)\}/g)]
    .map(m=>({key:m[1], body:m[2],type:/\btype:\s*["']([^"']+)["']/.exec(m[2])?.[1],
      label:/\blabel:\s*["']([^"']+)["']/.exec(m[2])?.[1]}))
    .filter(x=>isTimestamp(x.key) && x.type);
}
export function auditPinoDatetime(root, { requireCanon=true, legacyText=LEGACY_TEXT_TIMESTAMP,
    legacyLocale=LEGACY_UNZONED_UI }={}) {
  const errors=[], debt=[], seen=new Set(), seenLocale=new Set();
  const sha256 = line => createHash("sha256").update(line.trim()).digest("hex");
  for(const surface of ["bo","ho","tos-v4","staff","classroom"]){
    for(const path of walk(join(root,"app",surface))){
      const file=normalize(relative(root,path));
      const source=readFileSync(path,"utf8");
      for(const field of declaredFields(source)){
        if(field.label && /\(\s*UTC\s*\)/i.test(field.label))
          errors.push(`${file}#${field.key}: raw UTC label forbidden`);
        if(field.type!=="datetime"){
          const existing=(legacyText[file]??[]).includes(field.key);
          if(existing && field.type==="text"){
            seen.add(file+"#"+field.key);
            debt.push(file+"#"+field.key);
          } else errors.push(`${file}#${field.key}: actual timestamp must use datetime, not ${field.type}`);
        }
      }
      if(/new Date\([^\r\n]*\)\.toLocaleString\(/.test(source)){
        const lines=source.split(/\r?\n/).filter(x=>/new Date\([^\r\n]*\)\.toLocaleString\(/.test(x));
        for(const line of lines){
          if(/timeZone\s*:/.test(line)) continue;
          const digest=sha256(line);
          if(legacyLocale.some(entry=>entry.file===file && entry.sha256===digest)) {
            seenLocale.add(file+"#"+digest);
            debt.push(file+"#"+digest.slice(0,10));
          } else errors.push(`${file}: new or modified unzoned Date.toLocaleString UI rendering`);
        }
      }
    }
  }
  for(const [file,keys] of Object.entries(legacyText))
    for(const key of keys) if(!seen.has(file+"#"+key))
      errors.push(`${file}#${key}: stale legacy exception, remove after migration`);
  for(const entry of legacyLocale)
    if(!seenLocale.has(entry.file+"#"+entry.sha256))
      errors.push(`${entry.file}#${entry.sha256.slice(0,10)}: stale pinned legacy locale exception`);
  if(requireCanon){
    const bo=readFileSync(join(root,"app/bo/components/registration/BoValue.tsx"),"utf8");
    const mission=readFileSync(join(root,"app/bo/missions/schema.ts"),"utf8");
    const audit=readFileSync(join(root,"lib/bo-mission-audit-projection.ts"),"utf8");
    const formatter=readFileSync(join(root,"lib/pino-datetime.ts"),"utf8");
    if(!/formatPinoDateTime\(v\)/.test(bo)) errors.push("BoValue must use canonical PINO DateTime renderer");
    if(!/return formatPinoDateTime\(value\)/.test(audit)) errors.push("Mission audit must consume canonical PINO DateTime");
    if(!/PINO_DATETIME_V1/.test(formatter) || !/Asia\/Ho_Chi_Minh/.test(formatter))
      errors.push("Versioned PINO_DATETIME_V1 ICT formatter missing");
    for(const [key,label] of [["assignedAt","Ngày giao"],["cancelledAt","Ngày hủy"]]){
      const f=declaredFields(mission).find(x=>x.key===key);
      if(!f || f.type!=="datetime" || f.label!==label)
        errors.push(`PAP-1894 Mission ${key} must be typed datetime with approved human label`);
    }
  }
  return {version:"PINO_DATETIME_V1",passed:errors.length===0,errors,debt,checkedSurfaces:["bo","ho","tos-v4","staff","classroom"]};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=auditPinoDatetime(process.cwd());
  console.log(JSON.stringify(result,null,2));
  if(!result.passed)process.exitCode=1;
}
