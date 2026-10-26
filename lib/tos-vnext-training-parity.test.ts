import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderV4,buttons} from "./test-support/v4-render";
import type {TrainingV5CatalogItem} from "./tos-training-v5-api";
const trainingModule:TrainingV5CatalogItem={moduleId:"module-test",code:"TEST",title:"Training kiểm thử",summary:"Tóm tắt",description:"Nội dung",path:"Test Path",track:"Test",popular:true,popularityRank:1,minHours:40,guideUrl:null,active:true,revision:1,prerequisiteModuleIds:[],createdAt:"2026-10-26",updatedAt:"2026-10-26"};
const noop=()=>{};
const props={tab:"progress",onTab:noop,search:"",onSearch:noop,path:"",onPath:noop,filter:"Tất cả",onFilter:noop,catalog:[trainingModule],registrations:[],qualifications:[],selected:trainingModule,onSelect:noop,busy:false,error:"",certBusy:false,certError:"",eligibility:null,eligibilityBusy:false,eligibilityError:"",total:1,offset:0,onOffset:noop,onRetry:noop,onCertRetry:noop};
test("PAP-946 V4 two tabs, minimum hours and blocked registration render",async()=>{
 const html=await renderV4("TrainingV4Presentation",props);
 assert.match(html,/Training Library/);assert.match(html,/Chứng Nhận/);assert.match(html,/Giờ đã làm tối thiểu:/);assert.doesNotMatch(html,/Phát triển kỹ năng/);
 assert.match(buttons(html,"Đăng ký")[0],/disabled/);
 const css=readFileSync("app/components/tos-vnext/training.module.css","utf8");assert.match(css,/minimumHours[^}]*gap:var\(--tos-space-1\)/);
});
test("PAP-946 unavailable V5 remains an error while F0 certificates are separate",async()=>{
 const html=await renderV4("TrainingV4Presentation",{...props,tab:"certificates",selected:null,catalog:[],error:"V5 unavailable",certError:"F0 unavailable"});
 assert.match(html,/V5 unavailable/);assert.match(html,/F0 unavailable/);assert.doesNotMatch(html,/Chưa có chứng nhận Core hiện hữu/);
});
test("PAP-946 completed registration cannot offer cancellation or issue a certificate",async()=>{
 const html=await renderV4("TrainingV4Presentation",{...props,registrations:[{id:"r",moduleId:trainingModule.moduleId,status:"COMPLETED"}]});
 assert.match(buttons(html,"Hoàn thành").at(-1)!,/disabled/);assert.equal(buttons(html,"Hủy đăng ký").length,0);
});
