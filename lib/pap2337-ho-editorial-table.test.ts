// PAP-2337 — HO native editorial Table projection, no live data or grant.
import test from "node:test";
import assert from "node:assert/strict";
import {baseQuery,schema,registry,context,projectEditorialRow} from "../app/ho/content/post-approval/editorial-table-model";
import {newPost} from "../app/bo/content/posts/post-preview-fixture";
import {registeredSchema} from "../app/components/workspace-renderer/Record";
import {recordProjection} from "../app/components/workspace-renderer/projection";
import {toLegacyModule,toLegacyTableState,validateQuery} from "./workspace-schema";
import {registeredTableRows} from "../app/components/workspace-renderer/tableRows";
test("editorial native schema exposes canonical controls without raw media or audit fabrication",()=>{
 const post=newPost("ho"),row=projectEditorialRow(post);
 assert.equal(row.cover,1);assert.equal(row.name,post.person);assert.equal(row.submittedAt,null);
 assert(!JSON.stringify(row).includes("data:image/"));assert.equal("media" in row,false);
 assert.throws(()=>projectEditorialRow({...post,id:"real-record"}));
 assert.equal(recordProjection(registeredSchema(registry,schema),{surface:"HO",authorize:()=>false},row),null);
 assert.equal(schema.table.interaction.quickView,"separate-opener");
 assert.equal(schema.table.pagination.mode,"local-ui");validateQuery(schema,baseQuery,context);
});
test("status views use exact native filters and preserve current row identity",()=>{
 const rows=[projectEditorialRow(newPost("ho")),projectEditorialRow({...newPost("ho","POST-MOCK-002"),status:"Đã đăng"})].map(r=>recordProjection(registeredSchema(registry,schema),context,r)!.record);
 const fields=toLegacyModule(registeredSchema(registry,schema)).fields;
 const policy={identity:"name",search:schema.table.search.fields,filter:schema.table.filters.fields,sort:schema.table.sort.fields,group:schema.table.group.fields,edit:[],viewActions:schema.table.views.actions};
 const pending=schema.table.views.builtIn.find(v=>v.label==="Chờ duyệt")!;
 const published=schema.table.views.builtIn.find(v=>v.label==="Đã đăng")!;
 for(const [view,id] of [[pending,"POST-MOCK-001"],[published,"POST-MOCK-002"]] as const){
   validateQuery(schema,view.state,context);
   assert.deepEqual(registeredTableRows(rows,fields,toLegacyTableState(schema,view.state,context),policy).map(r=>r.id),[id]);
 }
});