/** PAP-1822 · Epic PAP-1705 / PNR-AVATAR-CRUD
 * Native BO Avatar G3 hard-fail regression: 56px opener, visible selector,
 * fixed Person track, truthful optional audit, canonical PINO locale.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { boNavigation } from "../app/bo/navigation";
import { pinoLocalizedLabel } from "./pino-nav-locale";
import { avatarFields } from "../app/bo/pinoria-avatars/avatar-dsa-model";
import { defaultTable } from "./bo-registration";

const read=(f:string)=>readFileSync(f,"utf8");
const geometry=postcss.parse(read("app/components/workspace-renderer/tdd-table-geometry.css"));
const scoped=postcss.parse(read("public/bo-authority-source/bo-scoped.css"));
function findRule(root:postcss.Root,selector:string){
  const matches:postcss.Rule[]=[];
  root.walkRules(r=>{if(r.selector===selector)matches.push(r);});
  assert.equal(matches.length,1,"exact rule: "+selector);
  return matches[0];
}
function declaration(rule:postcss.Rule,prop:string){
  const d=rule.nodes.find(n=>n.type==="decl" && n.prop===prop);
  assert.ok(d&&d.type==="decl","missing "+prop+" in "+rule.selector);
  return d;
}

test("PAP-1822 native DSA owns fixed table geometry independent of retired TDD shell",()=>{
  const table=findRule(geometry,"[data-native-avatar] #typed-table");
  assert.equal(declaration(table,"table-layout").value,"fixed");
  assert.equal(declaration(table,"width").value,"max-content");
  assert.equal(declaration(table,"min-width").value,"max-content");
  const cols=findRule(geometry,"[data-native-avatar] #typed-table th[data-column],\n[data-native-avatar] #typed-table td.schema-column");
  assert.equal(declaration(cols,"width").value,"var(--bo-column-width, 225px)");
  assert.equal(declaration(cols,"max-width").value,"var(--bo-column-width, 225px)");
  const person=findRule(geometry,"[data-native-avatar] #typed-table :is(th,td)[data-tdd-identity-column]");
  assert.equal(declaration(person,"width").value,"240px");
  assert.equal(declaration(person,"left").value,"56px");
  assert.ok(read("app/bo/pinoria-avatars/page.tsx").includes("AvatarDirectoryDsa"));
  assert.doesNotMatch(read("app/bo/pinoria-avatars/page.tsx"),/SelfDirectoryTdd|SurfaceWorkspace|TddRegistry/);
});

test("PAP-1822 native toolbar re-enables actual Filter/Column Selector/Reset without changing all BO Tables",()=>{
  const selector="[data-native-avatar] #filter-toggle,\n[data-native-avatar] #visible-columns,\n[data-native-avatar] #reset-all,\n[data-native-avatar] #save-view";
  const rule=findRule(geometry,selector);
  assert.equal(declaration(rule,"display").value,"inline-flex");
  assert.ok(declaration(rule,"display").important);
  const matches:postcss.Rule[]=[];
  scoped.walkRules(r=>{if(r.selector.includes("[data-native-avatar] #visible-columns"))matches.push(r);});
  assert.equal(matches.length,1,"one compiled native Avatar selector rule");
  const scopedRule=matches[0];
  for(const id of ["#filter-toggle","#visible-columns","#reset-all","#save-view"])
    assert.ok(scopedRule.selector.includes("[data-native-avatar] "+id),"compiled native selector "+id);
  assert.equal(declaration(scopedRule,"display").value,"inline-flex");
  assert.ok(declaration(scopedRule,"display").important);
  const nativeCssRules:postcss.Rule[]=[];
  geometry.walkRules(r=>{if(r.selector.includes("[data-native-avatar]"))nativeCssRules.push(r);});
  assert.ok(nativeCssRules.length>=5);
  assert.ok(nativeCssRules.every(r=>postcss.list.comma(r.selector).every(s=>s.trim().startsWith("[data-native-avatar]"))));
});

test("PAP-1822 BO Avatar menu is consistently named in Vietnamese/English",()=>{
  const list=boNavigation.find(group=>group.label==="Pinoria")?.items.filter(x=>x.href==="/bo/pinoria-avatars")??[];
  assert.equal(list.length,1);
  assert.equal(list[0].label,"Pinoria Avatar");
  for(const locale of ["en","vi"] as const)
    assert.equal(pinoLocalizedLabel("bo","Nav Item","pinoria-avatars",list[0].label,locale),"Pinoria Avatar");
  assert.ok(!read("app/bo/navigation.ts").includes('label: "Self Directory"'));
});

test("PAP-1822 still exposes five primary and four optional audit columns, no invented truth",()=>{
  const v=defaultTable(avatarFields);
  assert.deepEqual(v.visible,["name","roles","avatarLabel","ownedCount","loadoutSummary"]);
  assert.deepEqual(avatarFields.slice(5,9).map(f=>f.key),["createdAt","createdBy","updatedAt","updatedBy"]);
  assert.ok(avatarFields.slice(5,9).every(f=>f.defaultVisible===false));
  const projection=read("app/bo/pinoria-avatars/avatar-dsa-data.ts");
  assert.match(projection,/if \(value === null\) return "—";/);
  assert.match(projection,/createdBy: \(r.createdBy \?\? "—"\)/);
});
