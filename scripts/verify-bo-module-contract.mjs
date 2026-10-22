/**
 * PAP-926: immutable legacy baseline + deny-by-default new BO route admission.
 * Run on EVERY PR after dependencies are installed, and protect the CI check.
 *
 * Source static analysis intentionally does not execute TS/JS route code.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { auditCanonicalBoRoute } from "./bo-route-import-guard.mjs";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_SHA256 = "6eb9110b8838b72d4bc6af9e55c4182bf1dc3fd85cbeee0e006ef74bb384c472";
const KEY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROUTE = /^\/bo\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
const FIELD = /^[a-z][a-zA-Z0-9_]*$/;
const PROPERTY_TYPES = new Set([
  "id","text","textarea","number","currency","date","datetime","select",
  "multiselect","relation","multirelation","person","boolean","email","url","formula",
]);

const read = (root, name) => fs.readFileSync(path.join(root,name),"utf8");
const source = (name, text) => ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const prop = (obj,key) => obj.properties.find(item =>
  ts.isPropertyAssignment(item) && (
    ts.isIdentifier(item.name) && item.name.text===key ||
    ts.isStringLiteral(item.name) && item.name.text===key
  ))?.initializer;
const literal = (node) =>
  node && (ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))?node.text:undefined;
const truth = node => node?.kind===ts.SyntaxKind.TrueKeyword?true:
  node?.kind===ts.SyntaxKind.FalseKeyword?false:undefined;

function visit(node, fn){
  fn(node);ts.forEachChild(node,child=>visit(child,fn));
}
function getRoutes(root) {
  const base=path.join(root,"app","bo");
  const result=[];
  if(!fs.existsSync(base))return result;
  function step(dir){
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      if(e.name.startsWith(".") || e.name==="node_modules")continue;
      const full=path.join(dir,e.name);
      if(e.isDirectory()) step(full);
      else if(e.name==="page.tsx")result.push(path.relative(root,full).replaceAll(path.sep,"/"));
    }
  }
  step(base);return result.sort();
}
function routeFromFile(file) {
  if(!file.startsWith("app/bo/") || !file.endsWith("/page.tsx"))return null;
  return "/bo/"+file.slice("app/bo/".length,-"/page.tsx".length);
}
function navigation(root){
  const f=source("app/bo/navigation.ts",read(root,"app/bo/navigation.ts"));
  const hrefs=[];
  visit(f,n=>{
    if(ts.isPropertyAssignment(n) &&
      ((ts.isIdentifier(n.name)&&n.name.text==="href")||(ts.isStringLiteral(n.name)&&n.name.text==="href"))) {
      const value=literal(n.initializer);
      if(value!==undefined&&value.startsWith("/bo"))hrefs.push(value);
    }
  });
  return [...new Set(hrefs)].sort();
}
function registry(root,issues){
  const file="app/bo/architecture/registry.ts";
  const parsed=source(file,read(root,file));
  let found;
  visit(parsed,node=>{
    if(ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      node.expression.text==="defineBoModuleRegistry") found=node;
  });
  if(!found || !found.arguments.length || !ts.isArrayLiteralExpression(found.arguments[0])) {
    issues.push("Registry must use a literal defineBoModuleRegistry([...]) declaration");
    return [];
  }
  const definitions=[];
  for(const node of found.arguments[0].elements){
    if(!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) ||
      node.expression.text!=="defineBoModule" || node.arguments.length!==1 ||
      !ts.isObjectLiteralExpression(node.arguments[0])) {
      issues.push("Each registry row must be a literal defineBoModule({...}) call");
      continue;
    }
    const object=node.arguments[0];
    const key=literal(prop(object,"key")),href=literal(prop(object,"href")),kind=literal(prop(object,"kind"));
    const label=literal(prop(object,"label")),publicViews=literal(prop(object,"publicViews"));
    const quickView=literal(prop(object,"quickView")),fullDetail=literal(prop(object,"fullDetail"));
    const permissions=prop(object,"permissions"),fields=prop(object,"fields");
    if(!key||!KEY.test(key)||!href||!ROUTE.test(href)||!label?.trim()||kind!=="entity"||
      publicViews!=="module-shared" || quickView!=="canonical-properties"||fullDetail!=="shared-tabs" ||
      !ts.isObjectLiteralExpression(permissions)||!literal(prop(permissions,"read"))?.trim() ||
      !literal(prop(permissions,"write"))?.trim() ||
      literal(prop(permissions,"read"))?.startsWith("TODO_") ||
      literal(prop(permissions,"write"))?.startsWith("TODO_") || !ts.isArrayLiteralExpression(fields)){
      issues.push(`Malformed BO module registry entry: ${key??"?"}`);continue;
    }
    const seen=new Set();let idOk=false,other=false;
    for(const entry of fields.elements){
      if(!ts.isObjectLiteralExpression(entry)){issues.push(`Non-literal field in ${key}`);continue;}
      const fieldKey=literal(prop(entry,"key")),type=literal(prop(entry,"type"));
      if(!fieldKey||!FIELD.test(fieldKey)||seen.has(fieldKey)||!PROPERTY_TYPES.has(type)){
        issues.push(`Invalid/duplicate property in ${key}`);continue;
      }
      seen.add(fieldKey);
      if(fieldKey==="id"&&type==="id"&&truth(prop(entry,"readOnly"))===true)idOk=true;
      if(fieldKey!=="id")other=true;
    }
    if(!idOk||!other)issues.push(`Module ${key} requires read-only canonical id and other properties`);
    if(href!=="/bo/"+key)issues.push(`Module ${key}: href must match key (no unapproved dynamic aliases)`);
    definitions.push({key,href});
  }
  return definitions;
}
function canonicalRoute(root,file,expectedKey,issues){
  const text=read(root,file);
  const sf=source(file,text);
  let factoryImport=false,validFactory=false;
  visit(sf,node=>{
    if(ts.isImportDeclaration(node)&&literal(node.moduleSpecifier)==="@/app/bo/architecture/BoModuleFactory") {
      factoryImport=Boolean(node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.some(el=>el.name.text==="BoModuleFactory"));
    }
    if(ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node)){
      if(node.tagName.getText(sf)!=="BoModuleFactory")return;
      const item=node.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.text==="moduleKey");
      if(item&&ts.isJsxAttribute(item)&&item.initializer&&ts.isStringLiteral(item.initializer)) {
        validFactory=item.initializer.text===expectedKey;
      }
    }
  });
  if(!factoryImport||!validFactory)issues.push(`${file}: NEW BO page MUST import BoModuleFactory and mount <BoModuleFactory moduleKey="${expectedKey}" ... />`);
  if(/TODO_BO_DOMAIN_ADAPTER/.test(text)||
    fs.existsSync(path.join(root,path.dirname(file),"adapter.ts")) &&
    /TODO_BO_DOMAIN_ADAPTER/.test(read(root,path.join(path.dirname(file),"adapter.ts")))) {
    issues.push(`${file}: domain adapter scaffold is incomplete; provide authorized real Core adapter`);
  }
  // New route cannot quietly bring another table implementation through imports.
  if(/<\s*(table|BoDataGrid|BoDataGridSidePeek)(?=[\s/>])/.test(text))issues.push(`${file}: bespoke Level-1 table or drawer is forbidden; use BoModuleFactory`);
}

export function verifyBoModuleContract(root=DEFAULT_ROOT) {
  const issues=[];
  const baselineFile=path.join(root,"app/bo/architecture/legacy-baseline.json");
  const bytes=fs.readFileSync(baselineFile);
  const hash=crypto.createHash("sha256").update(bytes).digest("hex");
  if(hash!==BASELINE_SHA256)issues.push("Legacy baseline hash mismatch: grandfathered routes cannot be expanded");
  const baseline=JSON.parse(bytes.toString("utf8"));
  const legacyRoutes=new Set(baseline.legacyRoutes??[]);
  const legacyNav=new Set(baseline.legacyNavigation??[]);
  const routes=getRoutes(root),nav=navigation(root),defs=registry(root,issues);
  const byKey=new Map(),byHref=new Map();
  for(const def of defs){
    if(byKey.has(def.key)||byHref.has(def.href))issues.push(`Duplicate registered BO key/path: ${def.key}`);
    byKey.set(def.key,def);byHref.set(def.href,def);
  }
  const newRoutes=routes.filter(f=>!legacyRoutes.has(f));
  const newNav=nav.filter(h=>!legacyNav.has(h));
  for(const file of newRoutes){
    const href=routeFromFile(file);
    const def=href&&byHref.get(href);
    if(!def){issues.push(`Unregistered NEW BO page: ${file}`);continue;}
    canonicalRoute(root,file,def.key,issues);
    auditCanonicalBoRoute(root,file,def.key,issues);
  }
  for(const href of newNav){
    if(!byHref.has(href))issues.push(`Unregistered NEW BO navigation path: ${href}`);
  }
  for(const def of defs){
    const route=`app/bo/${def.href.slice(4)}/page.tsx`;
    if(!newRoutes.includes(route))issues.push(`Registered BO module ${def.key} lacks NEW canonical page ${route}`);
    if(!nav.includes(def.href))issues.push(`Registered BO module ${def.key} missing from BO navigation`);
  }
  return {issues,baselineRoutes:legacyRoutes.size,baselineNav:legacyNav.size,
    newRoutes:newRoutes.length,newNav:newNav.length,registered:defs.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyBoModuleContract(process.env.PINO_BO_CONTRACT_ROOT?path.resolve(process.env.PINO_BO_CONTRACT_ROOT):DEFAULT_ROOT);
  if(result.issues.length){
    for(const issue of result.issues)console.error("BO_CONTRACT_FAIL:",issue);
    process.exitCode=1;
  }else console.log(`BO_CONTRACT_PASS legacy_routes=${result.baselineRoutes} legacy_nav=${result.baselineNav} new_routes=${result.newRoutes} registered=${result.registered}`);
}
