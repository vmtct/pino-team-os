import test from "node:test";
import assert from "node:assert/strict";
import { afterschoolHistoryPath, validateAfterschoolHistoryPage, type AfterschoolHistoryEvent } from "./bo-afterschool-history";
const parent="019a1234-5678-7000-8000-123456789abc",center="019a1234-5678-7000-8000-123456789abd";
const row: AfterschoolHistoryEvent={id:"019a1234-5678-7000-8000-123456789abe",subject_type:"parent_pin_credential",subject_id:parent,occurred_at:"2026-11-17T01:00:00.000Z",actor_id:null,actor_label:"Nhân viên",action:"Cấp PIN",outcome:"succeeded",field:null,before:null,after:null,description:null,redacted:true};
test("PAP-1886 exact selected Center path, limits and opaque cursor",()=>{
  const url=new URL(afterschoolHistoryPath(parent,center,"opaque_1",1),"https://example.invalid");
  assert.equal(url.pathname,"/api/bo/identity/afterschool-users/"+parent+"/history");
  assert.equal(url.searchParams.get("centerId"),center); assert.equal(url.searchParams.get("limit"),"1"); assert.equal(url.searchParams.get("cursor"),"opaque_1");
  for(const f of [()=>afterschoolHistoryPath(parent,"bad"),()=>afterschoolHistoryPath(parent,center,"a/b"),()=>afterschoolHistoryPath(parent,center,null,51)]) assert.throws(f);
});
test("accepts exact redacted rows and descending pages",()=>{
  const first=validateAfterschoolHistoryPage({events:[row],nextCursor:"abc"},parent,[],null,1);
  const next={...row,id:"019a1234-5678-7000-8000-123456789abd",action:"Cấp lại PIN"};
  assert.deepEqual(validateAfterschoolHistoryPage({events:[next],nextCursor:null},parent,first.events,"abc",1).events,[next]);
  assert.deepEqual(validateAfterschoolHistoryPage({events:[],nextCursor:null},parent).events,[]);
});
test("rejects extra or missing fields, unknown actions/actors, raw values, mismatched subject, malformed ids and dates",()=>{
  for(const x of [{...row,payload_json:"private"},{...row,actor_id:parent},{...row,action:"unknown"},{...row,actor_label:"personal name"},{...row,subject_id:center},{...row,subject_type:"student_profile"},{...row,before:"private"},{...row,redacted:false},{...row,id:"bad"},{...row,occurred_at:"2026-11-17"},{...row,description:undefined}]) assert.throws(()=>validateAfterschoolHistoryPage({events:[x],nextCursor:null},parent));
  assert.throws(()=>validateAfterschoolHistoryPage({events:[row],nextCursor:null,extra:true},parent));
});
test("rejects repeated cursor, duplicate and unordered events, impossible pagination",()=>{
  for(const f of [()=>validateAfterschoolHistoryPage({events:[row,row],nextCursor:null},parent),()=>validateAfterschoolHistoryPage({events:[row],nextCursor:null},parent,[row]),()=>validateAfterschoolHistoryPage({events:[row],nextCursor:"abc"},parent,[],"abc",1),()=>validateAfterschoolHistoryPage({events:[],nextCursor:"abc"},parent),()=>validateAfterschoolHistoryPage({events:[row,{...row,id:center,occurred_at:"2026-11-18T01:00:00.000Z"}],nextCursor:null},parent)]) assert.throws(f);
});
