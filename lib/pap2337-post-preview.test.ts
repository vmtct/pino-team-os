import test from "node:test";
import assert from "node:assert/strict";
import {completePost,transitionPost} from "../app/bo/content/posts/post-preview-contract";
import {newPost,originalMedia} from "../app/bo/content/posts/post-preview-fixture";
test("one consistent isolated synthetic identity and unavailable audit",()=>{
 const bo=newPost("bo"),ho=newPost("ho");
 assert.equal(bo.id,"POST-MOCK-001");assert.equal(bo.id,ho.id);
 assert.deepEqual({...bo,status:ho.status},ho);
 for(const p of [bo,ho]){assert.equal(p.fixture,true);assert.deepEqual([p.createdAt,p.createdBy,p.updatedAt,p.updatedBy],[null,null,null,null]);}
});
test("BO submit, HO publish, hide and republish; no BO publish",()=>{
 const p=newPost("bo");assert.throws(()=>transitionPost(p,"bo","Đã đăng"));
 const submitted=transitionPost(p,"bo","Chờ duyệt");
 assert.throws(()=>transitionPost(submitted,"bo","Nháp","fix"));
 const published=transitionPost(submitted,"ho","Đã đăng");
 const hidden=transitionPost(published,"ho","Đã ẩn");
 assert.equal(transitionPost(hidden,"ho","Đã đăng").status,"Đã đăng");
 assert.equal(p.status,"Nháp");assert.equal(published.history.length,2);
});
test("return reason, missing content and claimed diary rejected",()=>{
 const p=newPost("ho");
 assert.throws(()=>transitionPost(p,"ho","Nháp"," "));
 assert.equal(transitionPost(p,"ho","Nháp","Sửa caption").status,"Nháp");
 for(const bad of [{...p,caption:" "},{...p,diaries:[]},{...p,media:[]}]){assert.equal(completePost(bad),false);assert.throws(()=>transitionPost(bad,"ho","Đã đăng"));}
 assert.throws(()=>originalMedia("DIARY-MOCK-003"));
});
