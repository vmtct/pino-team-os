import assert from "node:assert/strict";
import test from "node:test";
import { projectPancakeChannels } from "./bo-pancake-channel-grid";
import type { BoPancakeChannel } from "./bo-api";

const base=(id:string, displayName:string, enabled:boolean, discoveredBy:"MANUAL"|"PANCAKE_EVENT", providerPageId:string):BoPancakeChannel=>({id,providerPageId,channel:"FACEBOOK",displayName,enabled,discoveredBy,createdAt:"2026-10-01T00:00:00.000Z",lastSeenAt:`2026-10-${id.padStart(2,"0")}T00:00:00.000Z`,updatedAt:`2026-10-${id.padStart(2,"0")}T01:00:00.000Z`,version:1});
const rows=[base("1","PINO Main",true,"PANCAKE_EVENT","page-main"),base("2","PINO Camp",false,"MANUAL","page-camp"),base("3","Art House",true,"PANCAKE_EVENT","page-art")];

test("Pancake channel grid searches stable provider identity and display metadata",()=>{
  assert.deepEqual(projectPancakeChannels(rows,{page:1,pageSize:25,search:"page-camp",status:"",sort:"updatedAt",direction:"desc"}).items.map(x=>x.id),["2"]);
  assert.deepEqual(projectPancakeChannels(rows,{page:1,pageSize:25,search:"auto",status:"",sort:"displayName",direction:"asc"}).items.map(x=>x.id),[]);
  assert.deepEqual(projectPancakeChannels(rows,{page:1,pageSize:25,search:"pino",status:"ENABLED",sort:"displayName",direction:"asc"}).items.map(x=>x.id),["1"]);
});

test("Pancake channel grid filters status, sorts deterministically and reconciles stale pages",()=>{
  const disabled=projectPancakeChannels(rows,{page:1,pageSize:25,search:"",status:"DISABLED",sort:"providerPageId",direction:"asc"});
  assert.deepEqual(disabled.items.map(x=>x.providerPageId),["page-camp"]);
  const stale=projectPancakeChannels(rows,{page:9,pageSize:2,search:"",status:"",sort:"displayName",direction:"asc"});
  assert.equal(stale.page,2);assert.equal(stale.reconcilePage,2);assert.deepEqual(stale.items.map(x=>x.displayName),["PINO Main"]);
});
