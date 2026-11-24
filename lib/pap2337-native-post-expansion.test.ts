import test from "node:test";
import assert from "node:assert/strict";
import {createPostPreviewSession} from "../app/bo/piner-posts/post-preview-session";
const signal=()=>new AbortController().signal;
test("native Post expansion reuses typed schema and one seed across list/detail",async()=>{
 const s=createPostPreviewSession();try{const list=await s.schema.data.list({} as never,s.context,signal());assert.equal(list.rows.length,1);const row=await s.controller.detail("POST-MOCK-001",signal());assert.equal(row.id,list.rows[0].id);assert.equal(row.mediaCount,1);assert.equal(row.createdAt,null);assert.equal(row.updatedBy,null);const after=await s.personChoices("AFTERSCHOOL",signal()),mytime=await s.personChoices("MYTIME",signal());assert.match(after[0].label,/Học viên/);assert.match(mytime[0].label,/Khách MyTime/);assert.notEqual(after[0].id,mytime[0].id);}finally{s.dispose();}
});
test("native Media slot reserves Diary per Post, reorders and releases provenance",async()=>{
 const s=createPostPreviewSession();try{const id="POST-MOCK-001",composer=s.composer!(id);assert.equal(composer.snapshot().media.length,1);await assert.rejects(composer.toggle("DIARY-MOCK-003",signal()));await composer.toggle("DIARY-MOCK-002",signal());const second=composer.snapshot().media[1];assert.equal(second.diaryId,"DIARY-MOCK-002");await composer.reorder(second.id,-1,signal());assert.equal(composer.snapshot().media[0].id,second.id);const other=await s.controller.createDraft("PERSON-MOCK-002","MYTIME","New",signal());assert.equal(s.composer!(other.id).snapshot().diaries[1].used,true);await assert.rejects(s.composer!(other.id).toggle("DIARY-MOCK-002",signal()));await composer.toggle("DIARY-MOCK-002",signal());assert.equal(s.composer!(other.id).snapshot().diaries[1].used,false);assert.equal((await s.controller.detail(id,signal())).mediaCount,1);}finally{s.dispose();}
});
test("preview submit locks caption, media and Diary mutations",async()=>{
 const s=createPostPreviewSession();try{const id="POST-MOCK-001",before=await s.controller.detail(id,signal()),submitted=await s.submitPreview!(id,before.version,signal());assert.equal(submitted.status,"Chờ duyệt");assert.equal(submitted.version,before.version+1);await assert.rejects(s.controller.editCaption(id,submitted.version,"changed",signal()));await assert.rejects(s.composer!(id).toggle("DIARY-MOCK-002",signal()));await assert.rejects(s.mediaController(id).remove("MEDIA-MOCK-001",signal()));assert.equal((await s.controller.detail(id,signal())).caption,before.caption);const list=await s.schema.data.list({} as never,s.context,signal());assert.equal(list.rows[0].status,"Chờ duyệt");}finally{s.dispose();}
});
test("preview rejects invalid program/person and real IDs; dispose revokes local presentation",async()=>{
 const s=createPostPreviewSession();await assert.rejects(s.controller.createDraft("PERSON-MOCK-002","AFTERSCHOOL","x",signal()));await assert.rejects(s.controller.detail("123e4567-e89b-12d3-a456-426614174000",signal()));s.dispose();await assert.rejects(s.controller.list(signal()));
});
