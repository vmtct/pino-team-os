"use strict";
// PAP-1960 · TOS Classroom / keeper Epic PAP-1676 MISSION-ASSIGNMENT.
// CSS/DOM G3 only; authenticated Staging G4 is separate.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("@playwright/test");
const root=path.resolve(__dirname,"../app/components/tos-vnext");
const read=p=>fs.readFileSync(p,"utf8");
const source=read(path.join(root,"ClassroomV4Presentation.tsx"));
const diarySource=read(path.join(root,"DiaryCapturePanel.tsx"));
const classCss=read(path.join(root,"classroom.module.css"));
const frameCss=read(path.join(root,"../tos-ds/phone-frame.module.css")).replace(/:global\(([^()]+)\)/g,"$1");
const vars=`@layer tos.reset,tos.apps,tos.components,tos.layout,tos.controls;
body{margin:0}
:root{--tos-font-family:system-ui;--tos-mobile-max:430px;--tos-space-1:4px;--tos-space-2:8px;
--tos-space-3:12px;--tos-space-4:16px;--tos-space-5:20px;--tos-space-6:24px;--tos-space-24:96px;
--tos-nav-height:68px;--tos-hit-min:44px;--tos-color-surface:white;--tos-color-border:#ced3d8;
--tos-color-ink:#293642;--tos-color-soft:#667788;--tos-color-muted:#647482;
--tos-color-warning:#b88634;--tos-color-warning-text:#70502e;--tos-color-warning-bg:#fff5e9;
--tos-color-warm-text:#866641;--tos-color-classroom-action:#f7eee1;
--tos-color-classroom-on-action:#665135;--tos-radius-control:10px;--tos-radius-card:12px;
--tos-shadow-card:0 1px 4px #aaa;--tos-text-caption:13px;--tos-text-secondary:14px}`;
const cards=Array.from({length:19},(_,i)=>`<button class="diaryCard" data-tos-slot="diaryCard"><strong>Học viên ${i}</strong><h3>Path Art</h3><p>Ghi chú học viên</p><span>Xem Nhật ký</span></button>`).join("");
const markup=`<div class="phoneFrame" data-tos-mobile-frame="classroom"><div class="nativeBody">
<main class="shell" data-tos-slot="shell"><div class="phone" data-tos-slot="phone">
<header class="sessionBar" data-tos-slot="sessionBar">Lớp đang truy cập</header>
<div class="content" data-tos-slot="content"><section id="tos-classroom-panel-diaries" role="tabpanel">
<div class="sectionHead" data-tos-slot="sectionHead"><h2>Nhật ký buổi học</h2><button>Thêm</button></div>
<div class="filterPills"><button>Tất cả</button><button>Đang học</button></div>${cards}</section></div>
<nav class="bottomNav" data-tos-slot="bottomNav"><button>Học viên</button><button>Nhiệm vụ</button><button>Nhật ký</button></nav>
</div></main></div></div>`;
async function run(){
 const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
 try{
  for(const width of [320,390,430,768]){
   const p=await browser.newPage({viewport:{width,height:780},reducedMotion:"reduce"});
   try{
    await p.setContent("<style>"+vars+classCss+frameCss+"</style>"+markup);
    const state=await p.evaluate(()=>{
      const nav=document.querySelector(".bottomNav"),body=document.querySelector(".nativeBody"),content=document.querySelector(".content");
      const diary=document.querySelector(".diaryCard"),cs=getComputedStyle(diary),nr=nav.getBoundingClientRect();
      const rows=Array.from(document.querySelectorAll('[role="tabpanel"]>.diaryCard'));
      const r0=rows[0].getBoundingClientRect(),r1=rows[1].getBoundingClientRect();
      return {navBottom:nr.bottom,navTop:nr.top,viewport:innerHeight,scroll:content.scrollHeight,client:content.clientHeight,
       gap:r1.top-r0.bottom,diaryColor:cs.color,bodyHeight:body.clientHeight};
    });
    assert(state.navTop>=0&&state.navBottom<=781,"Bottom tab nav must stay in viewport "+width+" "+JSON.stringify(state));
    assert(state.scroll>state.client,"Diary list must scroll independently "+width);
    assert(state.gap>=8,"Diary cards need DS gap "+width+" "+JSON.stringify(state));
    assert.equal(state.diaryColor,"rgb(41, 54, 66)","Diary text must use neutral ink");
    await p.screenshot({path:"D:/pino-e2e-evidence/PAP-1960-Diary-G3-"+width+".png"});
    const people='<div class="sectionHead">Học viên</div>'+Array.from({length:2},()=>'<article class="personCard"><div class="personBody"><div class="personTitle"><strong>Học viên An</strong><span class="studentAge">7 tuổi</span></div><div class="personActions"><button>Hồ sơ</button><button>+ Nhiệm vụ</button></div></div></article>').join("");
    await p.evaluate(html=>document.querySelector('[role="tabpanel"]').innerHTML=html,people);
    const person=await p.evaluate(()=>{const rows=[...document.querySelectorAll(".personCard")],a=rows[0].getBoundingClientRect(),b=rows[1].getBoundingClientRect(),buttons=rows[0].querySelectorAll(".personActions button"),b1=buttons[0].getBoundingClientRect(),b2=buttons[1].getBoundingClientRect(),age=getComputedStyle(rows[0].querySelector(".studentAge"));return {cardGap:b.top-a.bottom,ctaGap:b2.left-b1.right,ageColor:age.color,ageSize:age.fontSize}});
    assert(person.cardGap>=8&&person.ctaGap>=8,"Student cards and actions need DS gap "+width+" "+JSON.stringify(person));
    assert.equal(person.ageColor,"rgb(102, 119, 136)","Student age should be visually muted");
    const missions='<div class="sectionHead"><h2>Nhiệm vụ</h2><button>Thêm</button></div>'+Array.from({length:2},()=>'<section class="missionBatch"><strong>Nhiệm vụ</strong><div class="missionCompactActions"><button>Đổi</button><button>Hoàn thành</button></div></section>').join("");
    await p.evaluate(html=>document.querySelector('[role="tabpanel"]').innerHTML=html,missions);
    const missionGap=await p.evaluate(()=>{const e=[...document.querySelectorAll(".missionBatch")],a=e[0].getBoundingClientRect(),b=e[1].getBoundingClientRect();return b.top-a.bottom});
    assert(missionGap>=8,"Mission cards need DS gap "+width);
    await p.evaluate(()=>document.querySelector('[role="tabpanel"]').innerHTML='<div class="sectionHead">Học viên</div>');
    const after=await p.locator(".bottomNav").boundingBox();
    assert(after&&after.y+after.height<=781,"Tab nav must restore after diary panel hides "+width);
    console.log("PAP1960_LAYOUT_PASS",JSON.stringify({width,...state,person,missionGap,restored:after.y}));
   }finally{await p.close()}
  }
  assert.match(source,/className=\{styles\.studentAge\}/,"Student age must be explicitly muted alongside name");
  assert.match(source,/Vào lớp<\/button>/,"Bypass CTA must read Vào lớp");
  for(const s of ["Có thể vào lớp mà không mở ca","Không xác nhận lớp đã mở","Nhật ký kiểm tra qua Core","Không tạo mở ca, ảnh setup hay chấm công"])assert(!source.includes(s),"Old technical copy leaked: "+s);
  assert(!diarySource.includes("Ghi Nhật ký chỉ khả dụng khi đã xác nhận"),"Diary old technical admission hint must not remain");
  assert(diarySource.includes("Chưa thể gửi Nhật ký ở lớp này."),"Diary must keep concise disabled feedback");
  assert.match(source,/classContentRef\.current\.scrollTop=0/,"Tab switch must reset internal diary scroll");
  console.log("PAP1960_SOURCE_PASS");
 }finally{await browser.close();console.log("PAP1960_CHROME_CLOSED")}
}
run().catch(e=>{console.error("PAP1960_FAIL",e.message);process.exitCode=1});
