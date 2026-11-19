import {test} from "node:test";
import assert from "node:assert/strict";
import {canOpenWorkshop} from "../app/components/mytime-workshop/nav-access";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc";
test("PAP-2164 nav requires actual correct scoped list, even empty",async()=>{
 const signal=new AbortController().signal;
 const ok:typeof fetch=async(input,init)=>{assert.equal(String(input),"/api/bo/learning/mytime-workshops?limit=1&centerId="+id);assert.equal(init?.cache,"no-store");assert.equal(init?.credentials,"same-origin");return Response.json({data:{scopeCenterId:id,events:[],nextBeforeId:null}});};
 assert.equal(await canOpenWorkshop("BO",id,signal,ok),true);
 assert.equal(await canOpenWorkshop("BO",id,signal,async()=>Response.json({data:{scopeCenterId:null,events:[],nextBeforeId:null}})),false);
 assert.equal(await canOpenWorkshop("BO",id,signal,async()=>Response.json({error:"denied"},{status:403})),false);
 assert.equal(await canOpenWorkshop("BO",id,signal,async()=>Response.json({data:{scopeCenterId:id,events:[{}],nextBeforeId:null}})),false);
 assert.equal(await canOpenWorkshop("HO",null,signal,async()=>Response.json({data:{scopeCenterId:null,events:[],nextBeforeId:null}})),true);
 assert.equal(await canOpenWorkshop("HO",id,signal,async()=>{throw Error("must not call")}),false);
 const ctl=new AbortController();ctl.abort();assert.equal(await canOpenWorkshop("BO",id,ctl.signal,ok),false);
});
