import test from "node:test";
import assert from "node:assert/strict";
import {
  acknowledgeBoPublicView, conflictBoPublicView, createBoPublicView, defaultBoViewConfig,
  deleteBoPublicView, discardBoViewConflict, editBoViewConfig, loadBoPublicViews,
  renameBoPublicView, reorderBoPublicViews, selectBoPublicView, validateBoViewConfig,
  type BoPublicView, type BoViewConfig,
} from "./bo-public-view-state";

const fields=["name","id","status","student","amount","start","tags"];
const base=defaultBoViewConfig(fields);
const view=(id:string,position:number,version=3,config:BoViewConfig=base):BoPublicView=>({
  id,moduleKey:"subscriptions",name:"View "+id,position,version,config,
});
const load=(role:"manager"|"staff"="manager",selectedId:string|null="v1")=>loadBoPublicViews({
  moduleKey:"subscriptions",role,allowedFields:fields,
  views:[view("v2",1),view("v1",0)],selectedId,
});
const revised=(config:BoViewConfig=base):BoViewConfig=>({...config,
  search:"Piano",sort:{field:"amount",direction:"desc"},groupBy:"status",
  filters:[{field:"student",operator:"contains",value:"Trân"},{field:"amount",operator:"gte",value:250000}],
  columns:{order:["name","status","id","student","amount","start","tags"],visible:["name","id","status","amount"]},
});
test("load is sorted and isolates defaults/remote references (no private views)",()=>{
  const raw=view("v1",0,3,defaultBoViewConfig(fields));
  const state=loadBoPublicViews({moduleKey:"subscriptions",role:"manager",views:[raw],allowedFields:fields,selectedId:"v1"});
  assert.equal(state.activeId,"v1");
  assert.deepEqual(state.views.map(x=>x.id),["v1"]);
  raw.name="Remote corruption";
  raw.config.columns.order.pop();
  assert.equal(state.views[0].name,"View v1");
  assert.equal(state.views[0].config.columns.order.length,7);
});
test("manager modifies selected global view live and emits versioned write",()=>{
  const state=load();
  const config=revised();
  const result=editBoViewConfig(state,config,fields);
  assert.deepEqual(result.write,{kind:"update",moduleKey:"subscriptions",id:"v1",expectedVersion:3,config});
  assert.deepEqual(result.state.views[0].config,config);
  assert.equal(result.state.localDraft,false);
  assert.equal(state.views[0].config.search,"");
  assert.equal(result.state.views[1].config.search,"");
  assert.equal(selectBoPublicView(result.state,"v1",fields).state.effective.search,"Piano");
  assert.equal(selectBoPublicView(result.state,"v2",fields).state.effective.search,"");
});
test("staff may experiment locally but NEVER issue shared configuration write",()=>{
  const old=load("staff");
  const result=editBoViewConfig(old,revised(),fields);
  assert.equal(result.write,null);
  assert.equal(result.state.localDraft,true);
  assert.equal(result.state.effective.search,"Piano");
  assert.equal(result.state.views[0].config.search,"");
  assert.deepEqual(selectBoPublicView(result.state,"v1",fields).state.effective,base);
  for(const fn of [
    ()=>createBoPublicView(old,{id:"new",name:"Hi"}),
    ()=>renameBoPublicView(old,"v1","New name"),
    ()=>deleteBoPublicView(old,"v1",fields),
    ()=>reorderBoPublicViews(old,["v2","v1"]),
  ]) assert.throws(fn,/authorized manager/);
});
test("unsaved All filters are transient, + snapshots exact configuration",()=>{
  let state=selectBoPublicView(load(),null,fields).state;
  state=editBoViewConfig(state,revised(),fields).state;
  assert.equal(state.localDraft,true);
  const created=createBoPublicView(state,{id:"v3",name:"  Student needs renewal  "});
  assert.equal(created.write?.kind,"create");
  assert.deepEqual(created.state.effective,revised());
  assert.equal(created.state.activeId,"v3");
  assert.equal(created.state.views[2].name,"Student needs renewal");
  assert.deepEqual(created.state.views[2].config,revised());
  assert.deepEqual(load().views.map(x=>x.id),["v1","v2"]);
});
test("rename/delete and reorder serialize canonical shared writes with exact version",()=>{
  const first=load();
  const renamed=renameBoPublicView(first,"v1","  Critical  ");
  assert.deepEqual(renamed.write,{kind:"rename",moduleKey:"subscriptions",id:"v1",expectedVersion:3,name:"Critical"});
  assert.equal(renamed.state.views[0].name,"Critical");
  const reordered=reorderBoPublicViews(renamed.state,["v2","v1"]);
  assert.equal(reordered.write?.kind,"reorder");
  if(reordered.write?.kind==="reorder"){
    assert.deepEqual(reordered.write.positions.map(x=>x.position),[0,1]);
    assert.deepEqual(reordered.write.positions.map(x=>x.id),["v2","v1"]);
    assert.deepEqual(reordered.write.positions.map(x=>x.expectedVersion),[3,3]);
  }
  const deleted=deleteBoPublicView(reordered.state,"v1",fields);
  assert.equal(deleted.write?.kind,"delete");
  assert.equal(deleted.state.views.length,1);
  assert.equal(deleted.state.activeId,null);
  assert.deepEqual(deleted.state.effective,base);
  assert.deepEqual(load().views.map(x=>x.id),["v1","v2"]);
});
test("new view id, module names, duplicate records, version and order fail closed",()=>{
  const state=load();
  assert.throws(()=>createBoPublicView(state,{id:"v1",name:"X"}),/Duplicate/);
  assert.throws(()=>createBoPublicView(state,{id:"bad id",name:"X"}),/Invalid view ID/);
  assert.throws(()=>createBoPublicView(state,{id:"new",name:" "}),/View name/);
  assert.throws(()=>reorderBoPublicViews(state,["v1","v1"]),/permutation/);
  assert.throws(()=>reorderBoPublicViews(state,["v1","else"]),/permutation/);
  assert.throws(()=>loadBoPublicViews({moduleKey:"subscriptions",role:"staff",allowedFields:fields,views:[{...view("v1",0),moduleKey:"other"}]}),/Invalid public view/);
  assert.throws(()=>loadBoPublicViews({moduleKey:"subscriptions",role:"staff",allowedFields:fields,views:[view("v1",0),view("v1",1)]}),/Invalid public view/);
  assert.throws(()=>loadBoPublicViews({moduleKey:"subscriptions",role:"staff",allowedFields:fields,views:[view("v1",0,-1)]}),/Invalid public view/);
});
test("config validator prevents invalid, stale or unauthorized field keys and payload",()=>{
  const bad=(input:BoViewConfig)=>validateBoViewConfig(input,fields);
  assert.deepEqual(bad(revised()),revised());
  assert.throws(()=>bad({...base,sort:{field:"salary-secret",direction:"asc"}}),/Invalid sort/);
  assert.throws(()=>bad({...base,groupBy:"unknown"}),/Invalid group/);
  assert.throws(()=>bad({...base,filters:[{field:"private",operator:"equals",value:"x"}]}),/Invalid filter/);
  assert.throws(()=>bad({...base,columns:{order:["name","name"],visible:["name"]}}),/Invalid column/);
  assert.throws(()=>bad({...base,columns:{order:["name"],visible:["amount"]}}),/Invalid column/);
  assert.throws(()=>bad({...base,logic:"nand" as "and"}),/Invalid filter logic/);
  assert.throws(()=>bad({...base,filters:[{field:"status",operator:"sql_inject" as "is",value:"x"}]}),/Invalid filter/);
  assert.throws(()=>bad({...base,filters:[{field:"amount",operator:"gt",value:Number.POSITIVE_INFINITY}]}),/Unsupported filter/);
  assert.throws(()=>bad({...base,filters:Array.from({length:41},()=>({field:"name",operator:"contains",value:"x"}))}),/Invalid filter/);
});
test("conflict does not silently overwrite another manager's server version",()=>{
  const state=editBoViewConfig(load(),revised(),fields).state;
  const authoritative={...view("v1",0,4),name:"Someone else's update"};
  const conflict=conflictBoPublicView(state,authoritative,fields);
  assert.equal(conflict.conflict?.server.version,4);
  assert.throws(()=>renameBoPublicView(conflict,"v1","unsafe"),/Resolve public view conflict/);
  assert.equal(conflict.effective.search,"Piano");
  const discarded=discardBoViewConflict(conflict);
  assert.equal(discarded.views[0].version,4);
  assert.equal(discarded.effective.search,"");
  assert.equal(discarded.conflict,null);
});
test("out-of-order server ack never clobbers edits already pending locally",()=>{
  const edit=editBoViewConfig(load(),revised(),fields).state;
  const priorAck=view("v1",0,4);
  const revalidated=acknowledgeBoPublicView(edit,priorAck,fields);
  assert.equal(revalidated.views[0].version,4);
  assert.equal(revalidated.effective.search,"Piano");
  const fresh=acknowledgeBoPublicView(edit,{...priorAck,config:revised()},fields);
  assert.equal(fresh.views[0].version,4);
  assert.equal(fresh.effective.search,"Piano");
  assert.equal(acknowledgeBoPublicView(fresh,view("v1",0,2),fields).views[0].version,4);
});
test("module selection cannot cross into another BO module",()=>{
  const state=load();
  assert.throws(()=>selectBoPublicView(state,"unknown",fields),/Unknown/);
  assert.throws(()=>acknowledgeBoPublicView(state,{...view("v1",0),moduleKey:"payroll"},fields),/Invalid public view/);
});
test("all return values are isolated immutable snapshots, including tags and column arrays",()=>{
  const original=load();
  const config=revised();const edited=editBoViewConfig(original,config,fields);
  config.filters[0].value="mutated";
  config.columns.order.shift();
  assert.equal(edited.state.effective.filters[0].value,"Trân");
  assert.equal(edited.state.views[0].config.columns.order.length,7);
  assert.equal(original.effective.filters.length,0);
});
