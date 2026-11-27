import {test} from "node:test";
import assert from "node:assert/strict";
import {projectPortfolioPage as project} from "../src/portfolio-read-model.mjs";
import {renderHtml} from "../src/view.mjs";
import {parseRoute,getShellAdapter} from "../src/adapter.mjs";
import {renderPortfolio} from "../src/portfolio-view.mjs";
const id=n=>"018f0000-0000-7000-8000-"+String(n).padStart(12,"0");
const at="2026-11-26T12:00:00.000Z";
const item={postId:id(4),editorialVersion:8,caption:"Synthetic caption",occurredAt:at,media:[{attachmentId:id(5),position:1},{attachmentId:id(6),position:2}]};
const cursor={postId:item.postId,editorialVersion:8,occurredAt:at};
const page={items:[item],nextCursor:cursor};
const link=m=>"/test-only-private/"+m.postId+"/"+m.editorialVersion+"/"+m.attachmentId;
const chrome={runtime:true,selectedId:id(1),students:[{id:id(1),label:"QA"},{id:id(2),label:"Other"}]};
const scope=space=>({space,studentId:space==="house"?id(1):null,memberChrome:chrome});
const projectPortfolioPage=(space,page,link)=>project(space,page,link,scope(space));
test("PAP-2432 projects real reader DTO into existing Feed and Gallery without invented metadata",()=>{
 for(const space of ["house","mytime"]){
  const out=projectPortfolioPage(space,page,link);
  assert.equal(out.model.state,"ready");assert.deepEqual(out.nextCursor,cursor);
  assert.equal(out.model.posts[0].media.length,2);
  assert.equal(out.model.posts[0].synthetic,undefined);
  assert.equal(out.model.posts[0].feedback,undefined);
  for(const tab of ["home","grid"]){const html=renderPortfolio(space,tab,out.model);assert.ok(html.includes(item.caption));assert.ok(!html.includes("Bài mẫu"));assert.ok(!html.includes("portfolio-metrics"));}
 }
});
test("PAP-2432 rejects malformed page, foreign metadata, duplicate or nonordered media",()=>{
 for(const invalid of [{...page,items:[{...item,personId:id(1)}]},{...page,items:[item,item]},{...page,items:[{...item,media:[item.media[1],item.media[0]]}]},{...page,nextCursor:{...cursor,postId:id(9)}},{...page,items:[]}]){
  const out=projectPortfolioPage("house",invalid,link);assert.equal(out.model.state,"error");assert.deepEqual(out.model.posts,[]);
 }
});
test("PAP-2432 rejects external, raw object and unsafe media links",()=>{
 for(const src of ["https://public.invalid/image","//public.invalid/image","/piner/posts/"+id(5),"/test/%2fescape","/test/../secret"])assert.equal(projectPortfolioPage("mytime",page,()=>src).model.state,"error");
});
test("PAP-2432 empty is honest and invalid order is not silently repaired",()=>{
 assert.equal(projectPortfolioPage("house",{items:[],nextCursor:null},link).model.state,"empty");
 assert.equal(projectPortfolioPage("house",{items:[item,{...item,postId:id(7)}],nextCursor:null},link).model.state,"error");
});

test("PAP-2432 native shell binds exact authorized profile and suppresses stale content",()=>{
 const result=project("house",page,link,scope("house"));
 assert.equal(result.model.profileKey,id(1));
 const render=(space,tab,model,memberChrome)=>renderHtml(parseRoute("/piner/"+space+(tab==="grid"?"/grid":"")),getShellAdapter(),{memberChrome,portfolio:model});
 for(const tab of ["home","grid"]){
  assert.match(render("house",tab,result.model,chrome),/data-portfolio-state="ready"/);
  assert.doesNotMatch(render("house",tab,result.model,{...chrome,selectedId:id(2)}),/Synthetic caption/);
  assert.doesNotMatch(render("house",tab,result.model,null),/Synthetic caption/);
  assert.match(render("mytime",tab,project("mytime",page,link,scope("mytime")).model,chrome),/data-portfolio-state="ready"/);
 }
 assert.equal(project("house",page,link,{...scope("house"),studentId:id(2)}).model.state,"no-profile");
 assert.equal(project("house",page,link,null).model.state,"error");
 assert.equal(project("mytime",page,link,{...scope("mytime"),studentId:id(1)}).model.state,"error");
});
