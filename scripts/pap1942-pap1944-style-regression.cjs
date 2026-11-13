"use strict";
// PAP-1942 · Mission Assignment Classroom UI + PAP-1944 · TOS Runtime Home
// Isolated Playwright CSS geometry regression; authenticated Staging G4 is separate.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("@playwright/test");
const root=path.resolve(__dirname,"../app/components/tos-vnext");
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const homeCss=read("home.module.css"),shellCss=read("tos-vnext.module.css"),classCss=read("classroom.module.css");
const homeSource=read("TosVNextHome.tsx"),classSource=read("ClassroomV4Presentation.tsx"),missionSource=read("MissionAssignmentTab.tsx");
assert(homeSource.indexOf("homeSettingsMenu")>homeSource.indexOf("home.headerActions"),"Home menu must be after the settings actions anchor");
assert(homeSource.indexOf("homeSettingsMenu")<homeSource.indexOf("</header>"),"Home menu must be inside Header/actions, not a flex sibling");
assert(/\.homeSettingsMenu\{position:absolute;/.test(shellCss),"Home menu must be positioned out of flow");
assert(classSource.includes("Chi nhánh: "),"Student home center copy must use Chi nhánh");
assert(classSource.includes("Chưa có chi nhánh"),"Missing Center fallback must use Chi nhánh");
assert(!classSource.includes("Cơ sở gốc"),"Legacy label must be absent");
assert(!classSource.includes("<FontAwesomeIcon icon={faUserPlus}/> + Thêm"),"Student top Add CTA must be text only");
assert(!missionSource.includes("<FontAwesomeIcon icon={faPlus}/> Thêm"),"Mission Add CTA must be text only");

const vars=`:root{
 --tos-space-1:4px;--tos-space-2:8px;--tos-space-3:12px;--tos-space-4:16px;--tos-space-5:20px;
 --tos-space-6:24px;--tos-color-surface:white;--tos-color-border:#d3dce3;--tos-color-ink:#293642;
 --tos-color-muted:#637484;--tos-color-soft:#667788;--tos-color-success:#308b65;
 --tos-color-warning-text:#b6741a;--tos-color-warning-bg:#fff2df;--tos-color-night:#f5f5f5;
 --tos-color-warm:#986619;--tos-color-subtle-surface:#f6f6f3;--tos-color-backdrop:#0006;
 --tos-color-surface-translucent:#ffffffb3;--tos-color-warm-surface:#fff9ef;
 --tos-radius-control:11px;--tos-radius-card:12px;--tos-radius-sheet:22px;
 --tos-font-family:system-ui;--tos-hit-min:44px;--tos-mobile-max:430px;
 --tos-shadow-sheet:0 6px 25px #0002;--tos-shadow-card:0 2px 7px #0001;
 --tos-text-heading-md:18px;--tos-text-secondary:14px;--tos-text-caption:13px;
 --tos-weight-strong:700
} body{margin:0} *{box-sizing:border-box}`;
const homeMarkup=`<main class="screen"><div class="content"><header class="header">
<div class="greeting"><div class="avatar">T</div><div><span class="kicker">PINO · TEAM OPS</span><h1>Xin chào, Trang</h1></div></div>
<div class="headerActions"><button class="headerButton" aria-label="Thông báo">♧</button><button class="headerButton" id="gear" aria-label="Cài đặt" aria-expanded="false" aria-controls="tos-vnext-home-settings">⚙</button>
</div></header><button class="shiftCard"><strong>Ca được phân công</strong><span>Station Ninh Kiều</span></button><section class="appsSection"><h2>Ứng dụng</h2><div class="appGrid">Ca Làm · Tiếp Tân · Lớp Học</div></section></div></main>`;
const menuMarkup=`<section id="tos-vnext-home-settings" class="homeSettingsMenu" aria-label="Cài đặt"><span>Tài khoản Staff</span><label class="homeCenterLabel">Trung tâm<select aria-label="Trung tâm"><option>Cần Thơ</option><option>Ninh Kiều</option></select></label><button class="homeLogout">Đăng xuất</button></section>`;
const classroomMarkup=`<div class="phone"><section class="sheet"><div class="handle"></div><header><h2>Thêm học viên vào lớp</h2><button aria-label="Đóng">×</button></header><div class="toggle"><button>Toàn bộ học viên</button><button>Lead / trial</button></div><p class="smallMuted">Tìm trong toàn bộ học viên</p><label class="search"><span aria-hidden="true">⌕</span><input placeholder="Tìm tên bất kỳ học viên..." /></label><button class="lookupResult"><span>MK</span><div><strong>Minh Khôi</strong><small>Chi nhánh: Ninh Kiều</small></div></button></section></div>`;
async function main(){
 const b=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
 let passed=0;
 try{
  for(const width of [320,390,430,768,1440]){
   const page=await b.newPage({viewport:{width,height:844},reducedMotion:"reduce"}),errs=[];
   page.on("pageerror",e=>errs.push(e.message));
   try {
    await page.setContent("<style>"+vars+homeCss+shellCss+"</style>"+homeMarkup);
    const before=await page.$eval(".shiftCard",e=>e.getBoundingClientRect().top);
    await page.evaluate(html=>{document.querySelector(".headerActions").insertAdjacentHTML("beforeend",html);document.querySelector("#gear").setAttribute("aria-expanded","true")},menuMarkup);
    const geom=await page.evaluate(()=>{
      const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
      const menu=document.querySelector(".homeSettingsMenu");
      return {shift:box(".shiftCard"),menu:box(".homeSettingsMenu"),gear:box("#gear"),position:getComputedStyle(menu).position,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(geom.shift.y,before,"Home body shifted when settings opened at "+width);
    assert.equal(geom.position,"absolute","Menu must be overlay at "+width);
    assert(geom.menu.x>=-0.6&&geom.menu.right<=width+0.6,"Menu clips horizontally at "+width);
    assert(geom.menu.y>=geom.gear.bottom-0.6,"Menu must start below settings gear "+width);
    assert(!geom.overflow,"Home horizontal overflow "+width);
    await page.screenshot({path:"D:/pino-e2e-evidence/PAP-1944-home-overlay-"+width+".png"});
    await page.setContent("<style>"+vars+classCss+"</style>"+classroomMarkup);
    const s=await page.evaluate(()=>{
      const e=document.querySelector(".search"),input=e.querySelector("input"),head=document.querySelector(".sheet>header"),name=document.querySelector(".lookupResult strong");
      const pixels=e=>{const c=getComputedStyle(e);return {border:parseFloat(c.borderTopWidth),color:c.color,background:c.backgroundColor,boxShadow:c.boxShadow}};
      return {outer:pixels(e),inner:pixels(input),header:pixels(head),name:pixels(name),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(s.outer.border,1,"Search outer border must be exactly 1px "+width);
    assert.equal(s.inner.border,0,"Search inner input border must be removed "+width);
    assert.equal(s.header.boxShadow,"none","Sheet header must not have detached shadow "+width);
    assert.equal(s.name.color,"rgb(41, 54, 66)","Student name must be PINO neutral ink "+width);
    assert(!s.overflow,"Drawer horizontal overflow "+width);
    await page.screenshot({path:"D:/pino-e2e-evidence/PAP-1942-style-"+width+".png"});
    assert.deepEqual(errs,[],"Browser pageerror "+width);
    console.log("PLAYWRIGHT_STYLE_PASS",JSON.stringify({width,shiftDelta:geom.shift.y-before,overlay:geom.position,searchBorders:[s.outer.border,s.inner.border],ink:s.name.color}));
    passed++;
   }finally{await page.close()}
  }
 }finally{await b.close();console.log("CHROME_CLOSED",passed)}
}
main().catch(e=>{console.error("PLAYWRIGHT_STYLE_FAIL",e.stack);process.exitCode=1});
