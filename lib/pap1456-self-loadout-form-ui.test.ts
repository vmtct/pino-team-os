// PAP-1456 / Epic PAP-1097 — PINO DS form grammar for Self Loadout.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";
const editor = readFileSync(new URL("../app/bo/pinoria-avatars/SelfLoadoutDetail.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../app/components/pinoria/SelfLoadoutPreview.tsx", import.meta.url), "utf8");

test("PAP-1456 8-slot editor uses existing PINO DS labels, controls and actions", () => {
  assert.match(editor, /className="pds-property-row"/);
  assert.match(editor, /className="pds-property-label"/);
  assert.match(editor, /className="pds-property-input"/);
  assert.match(editor, /className="pds-property-actions"/);
  assert.match(editor, /className="pds-property-save"/);
  assert.doesNotMatch(editor, /className="property-control"|className="toolbar"|<form className="grid-card"/);
  assert.match(editor, /id="self-loadout-reason" required maxLength=/);
  assert.match(editor, /loadout\.ready\?"Sẵn sàng"/);
  assert.match(editor, /SLOTS\.map|options\.map/);
  assert.match(editor, /canViewItems/);
  assert.match(editor, /onSubmit=\{e=>\{void submit\(e\);\}\}/);
});

test("PAP-1456 preserves approved 9:16 Core-only preview and DS responsive grid", () => {
  assert.match(preview, /const WIDTH=270, HEIGHT=480/);
  assert.match(preview, /className="pds-properties"/);
  assert.match(preview, /className="pds-property-grid"/);
  assert.match(preview, /width=\{WIDTH\} height=\{HEIGHT\}/);
  assert.match(preview, /className="pds-property-text"/);
  assert.match(editor, /<section aria-label="Pinoria Self Loadout">/);
  assert.doesNotMatch(preview, /localStorage|sessionStorage|mockItem|fabricated/i);
  assert.match(preview, /<figure className="pds-property-section"/);
  assert.match(editor, /<h3 className="pds-property-heading">Trang bị Self<\/h3>/);
  assert.ok(editor.indexOf('id="self-loadout-set"') < editor.indexOf('options.map'));
});

// Execute the actual handler bodies with controlled IO, without requiring React or a browser.
function handler(name: string) {
  const ast=ts.createSourceFile("SelfLoadoutDetail.tsx",editor,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let source="";
  function visit(node: ts.Node) {
    if(ts.isFunctionDeclaration(node) && node.name?.text===name)source=node.getText(ast);
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.ok(source, name);
  return ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
}
const selfId="01a18140-10b8-70d3-ad6b-3e747a0cddea";
function environment(fetch: (...args: unknown[])=>unknown) {
  const chosen={HAIR:"draft-item"};
  const loadout={version:4,slots:{HAIR:"saved-item"}};
  const state:Record<string,unknown>={chosen,loadout,reason:"Keep this reason",refresh:0,conflict:false};
  const context:Record<string,unknown>={fetch,selfId,loadout,chosen,centerId:"center",reason:state.reason,canEdit:true,validSelection:true,dirty:true,crypto:{randomUUID:()=>"request-key"},TypeError,Error,
    parseLoadout:(raw:{data:unknown})=>raw.data,slotIds:(value:{slots:unknown})=>value.slots,onSaved:()=>{state.saved=true;}};
  for(const field of ["Chosen","Loadout","Reason","Refresh","Conflict","Error","Notice","Saving"]){
    const key=field[0].toLowerCase()+field.slice(1);
    context["set"+field]=(value:unknown)=>{state[key]=typeof value==="function"?value(state[key]):value;};
  }
  return {state,context,chosen,loadout};
}

for(const failure of ["network",403,409,500] as const)test(`PAP-1456 ${failure} save failure preserves choices, reason and snapshot`,async()=>{
  const env=environment(async()=>{
    if(failure==="network")throw new TypeError("Failed to fetch");
    return {ok:false,status:failure};
  });
  await runInNewContext(handler("submit")+"\nsubmit({preventDefault(){}})",env.context);
  assert.equal(env.state.chosen,env.chosen);
  assert.equal(env.state.loadout,env.loadout);
  assert.equal(env.state.reason,"Keep this reason");
  assert.equal(env.state.refresh,0,"failure must never trigger a draft-replacing GET");
  assert.equal(env.state.saving,false);
  assert.equal(env.state.conflict,failure===409);
  assert.match(String(env.state.error),/giữ lại/);
});

test("PAP-1456 success sends CAS, reason and idempotency; adopts server snapshot",async()=>{
  const snapshot={version:5,slots:{HAIR:"saved-item"}};
  let request:Record<string,unknown>={};
  const env=environment(async(_url,init)=>{request=init as Record<string,unknown>;return {ok:true,json:async()=>({data:snapshot})};});
  await runInNewContext(handler("submit")+"\nsubmit({preventDefault(){}})",env.context);
  assert.deepEqual(JSON.parse(String(request.body)),{expectedVersion:4,itemIdsBySlot:env.chosen,reason:"Keep this reason"});
  assert.equal((request.headers as Record<string,string>)["idempotency-key"],"request-key");
  assert.equal(env.state.loadout,snapshot);
  assert.equal(env.state.chosen,snapshot.slots);
  assert.equal(env.state.reason,"");
  assert.equal(env.state.saved,true);
});

test("PAP-1456 invalid/unavailable inventory blocks save; reset clears stale reason and notice",async()=>{
  for(const guard of ["canEdit","validSelection"]){
    const env=environment(async()=>{assert.fail("must not POST");});
    env.context[guard]=false;
    await runInNewContext(handler("submit")+"\nsubmit({preventDefault(){}})",env.context);
    assert.equal(env.state.reason,"Keep this reason");
  }
  const env=environment(async()=>{});
  env.context.conflict=false;
  env.state.notice="Old success";
  runInNewContext(handler("resetDraft")+"\nresetDraft()",env.context);
  assert.equal(env.state.chosen,env.loadout.slots);
  assert.equal(env.state.reason,"");
  assert.equal(env.state.notice,"");
  assert.equal(env.state.error,"");
});

test("PAP-1456 independent inventory read, stable saved media and explicit conflict recovery",()=>{
  assert.match(editor,/const readLoadout=load\(base\+"\/loadout"/);
  assert.match(editor,/const readItems=canViewItems\?load\(base\+"\/items"/);
  assert.match(editor,/inventoryReady=canViewItems && owned!==null/);
  assert.match(editor,/canEdit=canManage && inventoryReady && !loading && !saving && !conflict/);
  assert.match(editor,/useCallback\([\s\S]*?\[selfId,centerId\]\)/);
  assert.match(editor,/mediaSrc=\{mediaSrc\}/);
  assert.match(editor,/Bỏ bản nháp và tải lại/);
  assert.match(editor,/role="status" className="pds-property-text">\{dirty\?/);
  assert.doesNotMatch(editor,/style=\{|\.module\.css/);
});
