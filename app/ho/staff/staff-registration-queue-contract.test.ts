import test from "node:test";import assert from "node:assert/strict";
import {registrationQueueDefinition,registrationQueueQuery} from "./staff-registration-queue-contract";
import {TddRegistry,validateQuery} from "@/lib/workspace-schema";
test("PAP-2420 dossier queue exposes reviewed Center and no Staff Role query or action",()=>{
 const schema=new TddRegistry().register({...registrationQueueDefinition,data:{id:"isolated-dossier-test",list:async()=>({rows:[],total:0}),detail:async()=>null}});
 const context={surface:"HO" as const,authorize:(p:string)=>p==="team.bo.access"};
 validateQuery(schema,registrationQueueQuery,context);
 assert.deepEqual(registrationQueueQuery.visible.slice(0,3),["name","center","status"]);
 for(const fields of [schema.table.search.fields,schema.table.filters.fields,schema.table.sort.fields,schema.table.group.fields])assert(!fields.some(k=>k==="role"));
 assert(!schema.detail.overview.sections.some(s=>s.fields.some(k=>k==="role"||k==="loginEmail")));
 assert.equal(schema.detail.businessTabs.length,0);assert.equal(schema.table.inlineEdit.enabled,false);
});
