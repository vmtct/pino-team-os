import {test} from "node:test";
import assert from "node:assert/strict";
import {projectPortfolioPage} from "../src/portfolio-read-model.mjs";
import {renderPortfolio} from "../src/portfolio-view.mjs";
const id=n=>"018f0000-0000-7000-8000-"+String(n).padStart(12,"0");
const at="2026-11-26T12:00:00.000Z";
const item={postId:id(4),editorialVersion:8,caption:"Synthetic caption",occurredAt:at,media:[{attachmentId:id(5),position:1},{attachmentId:id(6),position:2}]};
const cursor={postId:item.postId,editorialVersion:8,occurredAt:at};
const page={items:[item],nextCursor:cursor};
const link=m=>"/test-only-private/"+m.postId+"/"+m.editorialVersion+"/"+m.attachmentId;
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
