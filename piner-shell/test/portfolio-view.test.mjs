import test from "node:test";
import assert from "node:assert/strict";
import {renderHtml} from "../src/view.mjs";
import {parseRoute,getShellAdapter} from "../src/adapter.mjs";
import {handleRequest} from "../src/worker.mjs";
import {renderPortfolio} from "../src/portfolio-view.mjs";
const chrome={students:[{id:"SYNTHETIC-PROFILE",label:"Hồ sơ mẫu"}],selectedId:"SYNTHETIC-PROFILE",runtime:false};
const media=[{src:"/fixture-art-one.png",alt:"Tranh mẫu 1"},{src:"/fixture-art-two.png",alt:"Tranh mẫu 2"}];
const fixture=space=>({space,profileKey:"SYNTHETIC-PROFILE",state:"ready",posts:[{space,key:"PORTFOLIO-MOCK-001",label:"Hồ sơ mẫu",date:"25/11/2026",caption:"Một buổi sáng tạo",feedback:"Con phối màu tốt.",feedbackBy:"Giáo viên mẫu",media}]});
test("same native shell and one consistent post in Feed and Gallery, both spaces",()=>{
 for(const space of ["house","mytime"]){for(const tab of ["home","grid"]){const path="/piner/"+space+(tab==="grid"?"/grid":"");const html=renderHtml(parseRoute(path),getShellAdapter(),{memberChrome:chrome,portfolio:fixture(space)});assert.match(html,/data-member-chrome="true"/);assert.match(html,/data-portfolio-state="ready"/);assert.match(html,/data-portfolio-viewer="PORTFOLIO-MOCK-001"/);assert.match(html,/Một buổi sáng tạo/);assert.match(html,/Con phối màu tốt/);assert.match(html,/fixture-art-one.png/);assert.match(html,/fixture-art-two.png/);assert.equal((html.match(/data-tab="/g)||[]).length,4);}}
});
test("no fixture or portfolio without explicit member chrome; excluded tabs remain unchanged",async()=>{
 const route=parseRoute("/piner/house");assert.doesNotMatch(renderHtml(route,getShellAdapter(),{portfolio:fixture("house")}),/PORTFOLIO-MOCK-001/);
 for(const path of ["/piner/house/reels","/piner/house/community"]){assert.doesNotMatch(renderHtml(parseRoute(path),getShellAdapter(),{memberChrome:chrome,portfolio:fixture("house")}),/PORTFOLIO-MOCK-001/);}
 const live=await handleRequest(new Request("https://app.pinohouse.art/piner/house?portfolio=PORTFOLIO-MOCK-001"));assert.doesNotMatch(await live.text(),/PORTFOLIO-MOCK-001/);
});
test("scope mismatch, invalid media, duplicate keys and non-ready states fail closed",()=>{
 assert.match(renderPortfolio("mytime","home",fixture("house")),/data-portfolio-state="denied"/);
 const invalid=fixture("house");invalid.posts[0].media=[{src:"https://foreign.example/secret.png"}];assert.match(renderPortfolio("house","home",invalid),/data-portfolio-state="error"/);
 const dup=fixture("house");dup.posts.push(dup.posts[0]);assert.match(renderPortfolio("house","home",dup),/data-portfolio-state="error"/);
 for(const state of ["loading","empty","no-profile","denied","error"]){const html=renderPortfolio("house","grid",{space:"house",state,posts:fixture("house").posts});assert.match(html,new RegExp('data-portfolio-state="'+state+'"'));assert.doesNotMatch(html,/PORTFOLIO-MOCK-001|fixture-art-one/);}
});
test("untrusted text is escaped",()=>{const p=fixture("house");p.posts[0].caption='<script>alert(1)</script>';assert.doesNotMatch(renderPortfolio("house","home",p),/<script>/);});
test("house renderer rejects a ready projection for another profile",()=>{const model=fixture("house");model.profileKey="OTHER";const html=renderHtml(parseRoute("/piner/house"),getShellAdapter(),{memberChrome:chrome,portfolio:model});assert.match(html,/data-portfolio-state="no-profile"/);assert.doesNotMatch(html,/PORTFOLIO-MOCK-001/);});
test("native combined client and style include scoped interaction code",async()=>{const {CLIENT}=await import("../src/client.mjs");const {CSS}=await import("../src/styles.mjs");assert.doesNotThrow(()=>new Function(CLIENT));assert.match(CLIENT,/showModal/);assert.match(CLIENT,/piner:select-student/);assert.match(CSS,/\.portfolio-grid/);});
