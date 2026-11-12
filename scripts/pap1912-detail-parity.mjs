/** PAP-1912 (PAP-1491 SPEC-UNLOCK): mandatory global Detail parity P0 source gate.
 * CI prevents new unregistered DetailFrame shells, bypassed tablists and
 * the PAP-1907 immutable-URL -> Quick View regression. It does NOT certify G4.
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export const MANIFEST="config/pap1912-detail-parity.json";
const normalized=f=>f.replaceAll("\\","/");
const src=(root,f,overrides)=>overrides[f]??fs.readFileSync(path.join(root,f),"utf8");
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const tsx=(file,source)=>ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const jsxTags=(file,source)=>{
  const ast=tsx(file,source),result=[];
  const walk=n=>{
    if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.tagName.getText(ast)==="DetailFrame"){
      const attrs=new Map(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.getText(ast)]));
      result.push({file,line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1,attrs});
    }
    ts.forEachChild(n,walk);
  };walk(ast);return result;
};
const files=(root,dir)=>{
  const full=path.join(root,dir);
  if(!fs.existsSync(full))return [];
  return fs.readdirSync(full,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(root,dir+"/"+e.name):/\.tsx$/.test(e.name)?[normalized(dir+"/"+e.name)]:[]);
};
export function checkSharedFrame(source) {
  const errors=[];
  const markers=[
    ['native Detail shell','data-tdd-shell="detail"'],
    ['Detail hero','detail-hero'],
    ['Detail cover','detail-cover'],
    ['tablist wrapper','detail-tabs'],
    ['tab list semantic','role="tablist"'],
    ['accessible tab semantic','role: "tab"'],
    ['selected tab semantic','aria-selected'],
    ['tab-panel relation','aria-controls'],
    ['tab panel','role="tabpanel"'],
    ['reverse tab label relation','aria-labelledby'],
    ['native detail body','detail-main'],
    ['native detail panel','detail-panel'],
    ['roving keyboard','nextTabIndex'],
    ['tab interaction','onKeyDown'],
    ['legacy Parent explicit adapter','legacyContent ??'],
  ];
  for(const [name,marker] of markers)if(!source.includes(marker))errors.push("shared DetailFrame missing "+name);
  return errors;
}
function declaredTabs(source){
  const ast=tsx("detail.tsx",source);let rows;
  const visit=n=>{
    if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==="subscriptionDetailTabs"&&(ts.isArrayLiteralExpression(n.initializer)||ts.isAsExpression(n.initializer))){
      const list=ts.isAsExpression(n.initializer)?n.initializer.expression:n.initializer;
      rows=list.elements.map(obj=>{
        if(!ts.isObjectLiteralExpression(obj))return null;
        const prop=name=>{const p=obj.properties.find(x=>ts.isPropertyAssignment(x)&&x.name.getText(ast)===name);return p&&ts.isStringLiteral(p.initializer)?p.initializer.text:null;};
        return [prop("id"),prop("label")];
      });
    }
    ts.forEachChild(n,visit);
  };visit(ast);return rows;
}
export function checkImmutableDetailReload(source) {
  const errors=[],ast=tsx("detail.tsx",source);
  if(!source.includes("assertCenterDetail(")||!source.includes("readSubscriptionCenterDetail(item.id,centerId,ctl.signal)"))
    errors.push("immutable Detail must attest selected Center before rendering");
  if(!source.includes("readSubscriptionDetailRoute(window.location.search)")||
     !source.includes("subscriptionDetailUrl(window.location.href,record,tab)")||
     !/verify\(matching,\s*false\)/.test(source))
    errors.push("immutable record URL must parse/restore Detail tab on reload");
  let safeBranch=false;
  const walk=n=>{
    if(ts.isIfStatement(n)&&n.expression.getText(ast)==="pushUrl"&&n.elseStatement){
      const onTableClick=n.thenStatement.getText(ast),onReload=n.elseStatement.getText(ast);
      if(/setDrawer\s*\(\s*\{\s*id:\s*item\.id\s*,\s*row\s*\}\s*\)/.test(onTableClick)&&
         /setDetail\s*\(\s*\{\s*id:\s*item\.id\s*,\s*row\s*\}\s*\)/.test(onReload)&&
         /setDrawer\s*\(\s*null\s*\)/.test(onReload))safeBranch=true;
    }ts.forEachChild(n,walk);
  };walk(ast);
  if(!safeBranch)errors.push("immutable record reload must render Full Detail (not Quick View Drawer), while row click opens Quick View");
  if(!source.includes("setDetailTab(nextTab)")||!source.includes('onSelect={selectDetailTab}'))
    errors.push("full Detail must retain selected business tab after reload");
  return errors;
}
export function inspectConsumer(file,source,entry,legacyExceptions){
  const uses=jsxTags(file,source),errors=[];
  if(!entry)return uses.length?[`${file}: unregistered DetailFrame callsite: declare owner/Jira, tabs and G4 contract in ${MANIFEST}`]:[];
  if(uses.length!==entry.uses)errors.push(`${file}: DetailFrame usage count drift ${uses.length} != ${entry.uses}; re-register explicit callsites`);
  for(const use of uses){
    const attrs=use.attrs,legacy=attrs.get("legacyContent"),prefix=`${file}:${use.line}`;
    if(legacy){
      const allow=legacyExceptions.find(e=>e.file===file&&legacy.includes(e.component));
      if(!allow||!allow.jira||!allow.reason)errors.push(prefix+": unapproved legacyContent bypasses shared tablist/panel");
      if(attrs.has("tabs"))errors.push(prefix+": tabs supplied but legacyContent bypasses tabs and CSS wrapper");
      continue;
    }
    if(!attrs.has("tabs"))errors.push(prefix+": missing canonical tabs prop");
    if(!attrs.has("selected"))errors.push(prefix+": missing selected tab contract");
    if(!attrs.has("onSelect")&&!["href-tabs","static-single-tab"].includes(entry.mode))
      errors.push(prefix+": missing tab interaction handler");
    const text=attrs.get("tabs")??"";
    if(/tabs=\{\s*\[\s*\]\s*\}/.test(text)||/tabs=\{\s*null\s*\}/.test(text))
      errors.push(prefix+": empty or null native Detail tablist");
    if(entry.mode==="href-tabs"&&!text.includes("href"))
      errors.push(prefix+": href-tabs must retain actual link targets");
    if(entry.mode==="static-single-tab"&&!text.includes("label:"))
      errors.push(prefix+": static-single-tab requires literal accessible tab");
  }
  if(entry.tabs){
    const actual=declaredTabs(source);
    if(JSON.stringify(actual)!==JSON.stringify(entry.tabs))
      errors.push(file+": registered business tab IDs/labels drift: "+JSON.stringify(actual));
  }
  if(entry.mode==="center-attested-record-url")errors.push(...checkImmutableDetailReload(source).map(e=>file+": "+e));
  return errors;
}
export function audit(root=ROOT,{overrides={},manifest}={}){
  const config=manifest??JSON.parse(src(root,MANIFEST,overrides)),errors=[];
  if(config.schema!=="PAP1912_TDD_DETAIL_PARITY_P0_V1")errors.push("bad Detail P0 schema");
  // Historical consumers are registered above. Every *new* Detail consumer must
  // declare an executable authenticated served-G4 spec, not just a source waiver.
  const originalFiles=new Set([
    "app/bo/components/BoFullDetail.tsx",
    "app/bo/components/registration/BoFullDetail.tsx",
    "app/bo/parents/ParentDirectoryDsa.tsx",
    "app/bo/pinoria-avatars/AvatarDirectoryDsa.tsx",
    "app/bo/subscriptions/BoSubscriptionSpecialtyTab.tsx",
    "app/bo/subscriptions/SubscriptionDirectoryDsa.tsx",
    "app/ho/pinoria/tv-policies/TvPolicyRecord.tsx",
    "app/ho/system/custom-attributes/HoAttributeFullDetail.tsx",
    "app/components/workspace-renderer/Record.tsx",
  ]);
  for(const entry of config.consumers)if(!originalFiles.has(entry.file)&&
    (!entry.g4?.surface||!entry.g4?.module||!entry.g4?.route||!entry.g4?.detailSelector))
    errors.push(entry.file+": new Detail needs executable authorized live-G4 contract; CI source check alone cannot pass FSG");
  const registered=new Map(config.consumers.map(e=>[e.file,e]));
  if(registered.size!==config.consumers.length)errors.push("duplicate Detail consumer registration");
  if(!config.consumers.every(e=>/^PAP-\d+$/.test(e.jira)&&e.mode&&Number.isInteger(e.uses)&&e.uses>0))
    errors.push("every Detail consumer must declare a Jira, mode and positive count");
  const legacy=config.grandfatheredLegacyContent??[];
  if(!legacy.every(e=>/^PAP-\d+$/.test(e.jira)&&e.component&&e.reason&&e.maxUses===1))
    errors.push("legacy exceptions require exact one-use Jira + rationale");
  const allFiles=["app/bo","app/ho","app/tos","app/components/workspace-renderer"].flatMap(d=>files(root,d));
  if(!allFiles.includes("app/components/workspace-renderer/DetailFrame.tsx"))errors.push("shared DetailFrame missing");
  else errors.push(...checkSharedFrame(src(root,"app/components/workspace-renderer/DetailFrame.tsx",overrides)));
  const found=new Set();
  for(const f of allFiles){
    const source=src(root,f,overrides);
    if(!source.includes("<DetailFrame"))continue;
    const e=registered.get(f);
    errors.push(...inspectConsumer(f,source,e,legacy));
    if(jsxTags(f,source).length)found.add(f);
  }
  for(const entry of config.consumers)if(!found.has(entry.file))errors.push(entry.file+": registered DetailFrame callsite absent");
  for(const e of legacy){
    const source=src(root,e.file,overrides);
    const count=jsxTags(e.file,source).filter(u=>(u.attrs.get("legacyContent")??"").includes(e.component)).length;
    if(count!==e.maxUses)errors.push(e.file+": grandfathered adapter count drift; review migration/exception");
  }
  return errors;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const errors=audit();
  if(errors.length){for(const error of errors)console.error("TDD_DETAIL_PARITY_P0_FAIL "+error);process.exitCode=1;}
  else console.log("TDD_DETAIL_PARITY_P0_STATIC_PASS: registered DetailFrame consumers, shared shell, no new bypass, Center URL reload");
}
