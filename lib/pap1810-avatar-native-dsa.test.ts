/** PAP-1810 · Epic PAP-1705 / PNR-AVATAR-CRUD — TDD-retired native BO DSA contracts. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoDataTable } from "../app/bo/components/registration/BoDataTable";
import { avatarFields, avatarModule } from "../app/bo/pinoria-avatars/avatar-dsa-model";
import { defaultTable } from "./bo-registration";
import { projectAvatarRow, loadAvatarPage, loadAvatarContext, avatarFilterParams } from "../app/bo/pinoria-avatars/avatar-dsa-data";

const center="01900000-0000-7000-8000-000000000001";
const person="01900000-0000-7000-8000-000000000002";
const learner="01900000-0000-7000-8000-000000000003";
const dual={rowKey:"PERSON:"+person,personId:person,pinoriaSelfId:null,selfStatus:null,
  displayName:"Lê Minh An",nickname:"Mây",subjectTypes:["LEARNER"],staffMemberId:null,studentProfileId:learner,
  subjectStatus:"ACTIVE",avatarStatus:"SELF_MISSING",loadoutVersion:null,equippedCount:null,
  ownedCount:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
const ready={...dual,pinoriaSelfId:"01900000-0000-7000-8000-000000000005",selfStatus:"ACTIVE",
  avatarStatus:"READY",loadoutVersion:4,equippedCount:3,ownedCount:6,
  createdAt:"2026-11-09T19:30:00.000Z",updatedAt:"2026-11-10T00:15:00.000Z"};

test("PAP-1810 native five defaults and four optional Core audit fields",()=>{
  const state=defaultTable(avatarFields);
  assert.deepEqual(state.visible,["name","roles","avatarLabel","ownedCount","loadoutSummary"]);
  assert.deepEqual(avatarFields.slice(5,9).map(x=>x.key),["createdAt","createdBy","updatedAt","updatedBy"]);
  assert.equal(avatarModule.label,"Pinoria Avatar");
});

test("PAP-1810 native read projection keeps Person separate from nickname; missing truth is dash",()=>{
  const missing=projectAvatarRow(dual);
  assert.equal(missing.name,"Lê Minh An");assert.equal(missing.nickname,"Mây");
  assert.equal(missing.ownedCount,null);assert.equal(missing.loadoutSummary,null);
  for(const field of ["createdAt","createdBy","updatedAt","updatedBy"])assert.equal(missing[field],"—");
  const active=projectAvatarRow(ready);
  assert.equal(active.name,"Lê Minh An");assert.equal(active.ownedCount,6);
  assert.equal(active.loadoutSummary,"3/8");assert.equal(active.createdAt,"10/11/2026 · 02:30");
  assert.equal(active.updatedAt,"10/11/2026 · 07:15");
  assert.equal(active.createdBy,"—");assert.equal(active.updatedBy,"—");
  for(const corrupt of [{...dual,ownedCount:0},{...ready,createdBy:"  "},{...ready,ownedCount:undefined}])
    assert.throws(()=>projectAvatarRow(corrupt));
});

test("PAP-1810 native BO Table renders dedicated opener only under explicit Avatar opt-in",()=>{
  const rows=[projectAvatarRow(ready),projectAvatarRow({...dual,rowKey:"PERSON:01900000-0000-7000-8000-000000000009",personId:"01900000-0000-7000-8000-000000000009"})];
  const run=(nativeAvatarOpener:boolean)=>renderToStaticMarkup(createElement(BoDataTable,{
    module:avatarModule,rows,loadState:"ready",value:{...defaultTable(avatarFields),pageSize:15},
    update:()=>{},page:1,setPage:()=>{},onOpen:()=>{},onSettings:()=>{},
    filterOpen:false,setFilterOpen:()=>{},views:[],changeViews:()=>{},activeView:null,
    applyView:()=>{},reset:()=>{},undo:()=>{},canUndo:false,nativeAvatarOpener,serverTotal:2
  }));
  const html=run(true);
  assert.match(html,/data-native-avatar=""/);
  assert.match(html,/<th scope="col" class="quick-open-th">Mở<\/th>/);
  assert.equal((html.match(/data-native-avatar-open-cell=""/g)??[]).length,2);
  assert.match(html,/data-avatar-person-primary="">Lê Minh An/);
  assert.match(html,/Avatar: Mây/);
  assert.ok(html.indexOf("quick-open-th")<html.indexOf('data-column="name"'));
  const generic=run(false);
  assert.doesNotMatch(generic,/quick-open-th|data-native-avatar-open-cell|data-avatar-person-lines/);
});

test("PAP-1810 native controller does not load TDD registry/adapter/navigation",()=>{
  const file=(name:string)=>readFileSync(new URL("../app/bo/pinoria-avatars/"+name,import.meta.url),"utf8");
  const page=file("page.tsx"),client=file("AvatarDirectoryDsa.tsx"),create=file("CreateSelfDrawer.tsx");
  assert.match(page,/AvatarDirectoryDsa/);
  assert.doesNotMatch(page+client,/SelfDirectoryTdd|TddRegistry|createBoTddAdapter|SurfaceWorkspace|browserTddNavigation|TddRenderer/);
  assert.doesNotMatch(create,/toLegacyModule|selfSchema|selfDefinition/);
  assert.match(client,/loadAvatarContext/);assert.match(client,/loadAvatarPage/);
  assert.match(client,/SelfWardrobeDetail/);assert.match(client,/SelfLoadoutDetail/);
  assert.match(client,/CreateSelfDrawer/);
});

test("PAP-1810 rejects unsupported native Core filters",()=>{
  const eq={field:"avatarStatus",op:"eq",value:"READY",second:""};
  assert.equal(avatarFilterParams([eq]).get("avatarStatus"),"READY");
  assert.throws(()=>avatarFilterParams([{...eq,op:"neq"}]));
  assert.throws(()=>avatarFilterParams([{...eq,value:"WRONG"}]));
  assert.throws(()=>avatarFilterParams([eq,eq]));
});

test("PAP-1810 authenticates selected Center and keeps BFF scope on reads, 401/403 fail-closed",async()=>{
  const oldFetch=globalThis.fetch;
  const calls:URL[]=[];
  const signal=new AbortController().signal;
  try{
    globalThis.fetch=async(input)=>{
      const url=new URL(String(input),"https://bo.staging.pinohouse.art");
      calls.push(url);
      if(url.pathname.endsWith("/context"))return Response.json({data:{
        entitled:true,surface:"BO",userId:"actor",permissionKeys:["team.bo.access","pinoria.avatar.directory.view"]
      }});
      return Response.json({data:{items:[dual],nextCursor:null}});
    };
    const keys=await loadAvatarContext(center,signal);
    assert.ok(keys.has("team.bo.access"));
    const result=await loadAvatarPage(center,{limit:15,search:"Lê",rules:[]},signal);
    assert.equal(result.records.length,1);
    assert.equal(calls[0]?.searchParams.get("centerId"),center);
    assert.equal(calls[1]?.searchParams.get("centerId"),center);
    assert.equal(calls[1]?.searchParams.get("q"),"Lê");
    globalThis.fetch=async()=>Response.json({error:"Forbidden"},{status:403});
    await assert.rejects(()=>loadAvatarPage(center,{limit:15,search:"",rules:[]},signal));
    globalThis.fetch=async()=>Response.json({error:"Unauthenticated"},{status:401});
    await assert.rejects(()=>loadAvatarContext(center,signal));
  }finally{globalThis.fetch=oldFetch;}
});

test("PAP-1810 exact Founder retirement excludes Avatar from legacy admission only",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../config/tdd-admission.json",import.meta.url),"utf8")) as {modules:{file:string;profile:string}[]};
  assert.ok(!manifest.modules.some(m=>m.file==="app/bo/pinoria-avatars/page.tsx"));
  assert.ok(manifest.modules.some(m=>m.file==="app/ho/staff/page.tsx" && m.profile==="TDD_DEFAULT"));
  assert.ok(manifest.modules.some(m=>m.file==="app/bo/missions/page.tsx" && m.profile==="TDD_DEFAULT"));
});
test("PAP-1810 Core effective directory permission must be present, not BO shell alone",async()=>{
  const old=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({data:{surface:"BO",entitled:true,userId:"actor",permissionKeys:["team.bo.access","pinoria.self.create"]}});
    await assert.rejects(()=>loadAvatarContext(center,new AbortController().signal),{status:403});
  }finally{globalThis.fetch=old;}
});
