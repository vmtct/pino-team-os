/** PAP-1855 / PAP-1856 / Epic PAP-650 PNR-TV:
 * DSA_FIELD_SINGLE_AUTHORITY_P0 — one semantic property, one trusted field.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import {
  hoTvDetailSections, hoTvEditableBusinessKeys, projectHoTvPolicyDetail,
} from "./ho-tv-policy-detail-projection";
import type { BoRecord } from "./bo-registration";
import type { TvLiveVisibility, TvVisibilityCenter } from "./ho-tv-visibility-client";

const origin="019d1000-0001-7000-8000-000000000001";
const secondary="019d1000-0001-7000-8000-000000000002";
const id="tvp1-center-"+origin;
const centers:TvVisibilityCenter[]=[
  {id:origin,name:"Cần Thơ"},{id:secondary,name:"Long Xuyên"},
];
const policy:BoRecord={
  id,name:"Stale Directory Name",scope:"DEFAULT",center:"Stale Directory Center",
  typeName:"Ambient Welcome",resolution:"UNCONFIGURED",inherited:null,
  active:null,latest:null,aspectRatio:"16:9",
  createdAt:"—",createdByUser:"—",updatedAt:"—",updatedByUser:"—",
};
const visibility:TvLiveVisibility={
  id,originCenterId:origin,name:"Verified Name",scope:"CENTER",
  assignedCenterIds:[origin],revision:3,
  createdAt:null,createdByUserId:null,updatedAt:null,updatedByUserId:null,
};

function render(verified:TvLiveVisibility):{html:string; record:BoRecord}{
  const x=projectHoTvPolicyDetail(policy,verified,centers);
  const html=renderToStaticMarkup(createElement(PropertySections,{
    variant:"detail",...x,
    canEdit:field=>!field.readonly && (field.key!=="center"||verified.scope==="CENTER"),
    onEdit:()=>{},
  }));
  return {html,record:x.record};
}
function assertSingleAuthority(html:string,editable:string[]){
  assert.equal((html.match(/class="v24-prop-item"/g)??[]).length,13,"13 canonical rows, never 13+3");
  for(const key of hoTvEditableBusinessKeys){
    const values=html.match(new RegExp('data-detail-edit="'+key+'"','g'))??[];
    assert.equal(values.length,editable.includes(key)?1:0,"exactly one editable "+key);
    const keyLabels=html.match(new RegExp('data-prop="'+key+'"','g'))??[];
    assert.equal(keyLabels.length,editable.includes(key)?1:0,"readonly counterpart must not also render "+key);
  }
  assert.equal((html.match(/class="v24-prop-value writable"/g)??[]).length,editable.length);
  assert.equal((html.match(/class="v24-prop-value readonly"/g)??[]).length,13-editable.length);
  assert.doesNotMatch(html,/Hiển thị trên TOS|visibilityScope|centerIds|tv-logical-visibility/);
  assert.match(html,/Thông tin Policy/);
  assert.match(html,/Thông tin hệ thống/);
  for(const label of ["Created Time","Created by (User)","Last Modified Time","Last Modified by (User)"])
    assert.match(html,new RegExp('aria-label="Chỉ đọc '+label.replace(/[()]/g,"\\$&")+'"'));
}
test("PAP-1856 manifest has one semantic key and retains all four audit fields",()=>{
  const all: string[]=hoTvDetailSections.flatMap(s=>[...s.fields]);
  assert.equal(all.length,13);
  assert.equal(new Set(all).size,13);
  assert.deepEqual(all.filter(x=>hoTvEditableBusinessKeys.includes(x as typeof hoTvEditableBusinessKeys[number])),
    [...hoTvEditableBusinessKeys.filter(key=>all.includes(key))]);
  for(const a of ["createdAt","createdByUser","updatedAt","updatedByUser"])assert(all.includes(a));
  assert(!all.includes("visibilityScope")&&!all.includes("centerIds"));
});
test("PAP-1855 live projection ignores stale Directory business fields and has 13 unique DSA properties",()=>{
  const {html,record}=render(visibility);
  assert.equal(record.name,"Verified Name");
  assert.equal(record.scope,"CENTER");
  assert.deepEqual(record.center,["Cần Thơ · 000001"]);
  assertSingleAuthority(html,["name","scope","center"]);
  assert.match(html,/Verified Name/);
  assert.doesNotMatch(html,/Stale Directory Name|Stale Directory Center/);
});
test("PAP-1855 post-write independent Core snapshot replaces value at the SAME single row",()=>{
  const changed={...visibility,name:"After Verified Readback",scope:"CENTER" as const,
    assignedCenterIds:[origin,secondary],revision:4};
  const {html,record}=render(changed);
  assertSingleAuthority(html,["name","scope","center"]);
  assert.equal(record.name,"After Verified Readback");
  assert.deepEqual(record.center,["Cần Thơ · 000001","Long Xuyên · 000002"]);
  assert.match(html,/After Verified Readback/);
  assert.match(html,/Long Xuyên/);
  assert.doesNotMatch(html,/Verified Name|Stale Directory Name|Stale Directory Center/);
});
test("PAP-1855 DEFAULT disables Center edit but preserves one readonly Center value",()=>{
  const changed={...visibility,scope:"DEFAULT" as const,assignedCenterIds:[],revision:5};
  const x=projectHoTvPolicyDetail(policy,changed,centers);
  const {html,record}=render(changed);
  assertSingleAuthority(html,["name","scope"]);
  assert.equal(record.scope,"DEFAULT");
  assert.deepEqual(record.center,["Tất cả Center"]);
  assert.equal(x.fields.find(f=>f.key==="center")?.readonly,true);
  assert.match(html,/Tất cả Center/);
});
test("PAP-1855 projection cannot render mismatched Policy or invisible Center",()=>{
  assert.throws(()=>projectHoTvPolicyDetail({...policy,id:"tvp1-default"},visibility,centers),/PAP1855_POLICY_PROJECTION_MISMATCH/);
  assert.throws(()=>projectHoTvPolicyDetail(policy,{...visibility,assignedCenterIds:["019d1000-0001-7000-8000-0000000000ff"]},centers),/PAP1855_UNAUTHORIZED_CENTER_PROJECTION/);
});
