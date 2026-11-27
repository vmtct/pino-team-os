// PAP-1943 / PNR-APP-HUB — brand and geometry follow approved authoritative i5 Piner prototype.
import {PROGRAMS,TABS,routeFor,assertFailClosed} from "./adapter.mjs";
import {renderPortfolio} from "./portfolio-view.mjs";
const PINO="https://assets.pinohouse.art/site/core/Pino%20Sigil.png";
const WORDMARK="/piner_app_logo_no_yellow_transparent.png";
const h=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function brand(cls="brand"){
 return '<a href="/" class="'+cls+'" aria-label="Piner APP — Trang chủ"><img class="sigil" src="'+PINO+'" alt="PINO" width="29" height="29"><img class="wordmark" src="'+WORDMARK+'" alt="Piner APP" width="98" height="29"></a>';
}
function card(space,title,sub){
 return '<a class="program-card '+space+'" href="'+routeFor(space)+'" data-launch-app="'+space+'" aria-label="Mở '+h(PROGRAMS[space].label)+'"><span class="card-photo" aria-hidden="true"></span><span class="card-fade" aria-hidden="true"></span><span class="card-copy"><strong>'+title+'</strong><span class="tagline">'+sub+'</span><span class="arrow" aria-hidden="true">→</span></span></a>';
}
function launch(chrome){
 return '<main id="main-content" class="launch"><div class="launch-brand"><img class="launch-sigil" src="'+PINO+'" alt="PINO" width="45" height="45"><img class="launch-wordmark" src="'+WORDMARK+'" alt="Piner APP" width="160" height="70"></div><nav class="programs" aria-label="Chọn chương trình">'+
 card("house",'<span class="pino-word">PINO</span> <span class="afterschool-word">Afterschool</span>',"Hết giờ học,<br>đến giờ con khám phá.")+
 card("mytime","MyTime<small>by PINO</small>","Hết những bận rộn,<br>đến giờ mình tận hưởng.")+
 '</nav>'+(chrome?'<div class="member-actions"><button type="button" data-sign-out>Đăng xuất</button></div>':"")+'<p class="launch-note">Piner APP · Không gian sáng tạo của bạn</p></main>';
}
function icon(tab){return {home:"⌂",grid:"▦",reels:"▶",community:"◌"}[tab];}
function member(space,tab,adapter,afterschoolLoginAvailable,chrome,portfolio){
 assertFailClosed(adapter);
 const program=PROGRAMS[space];
 const tabLabel={home:"Bảng tin",grid:"Bộ sưu tập",reels:"Reels",community:"Cộng đồng"}[tab];
 const desc=tab==="community"?"Chưa có dữ liệu cộng đồng được phép hiển thị.":"Nội dung riêng tư sẽ xuất hiện sau khi kết nối tài khoản và quyền truy cập từ Core.";
 const loginLink=space==="house"&&afterschoolLoginAvailable===true?'<p><a href="/login" data-afterschool-login>Đăng nhập PINO Afterschool</a></p>':"";
 const notice='<div class="empty-state" data-adapter-state="unauthenticated"><span class="empty-art" aria-hidden="true">◇</span><strong>Không gian riêng tư</strong><p>'+h(desc)+'</p>'+(loginLink||'<small>UI Shell · Identity chưa kết nối</small>')+'</div>';
 const skeleton=tab==="grid"?'<div class="grid-skeleton" aria-hidden="true"><i></i><i></i><i></i><i></i></div>':
  tab==="reels"?'<div class="reel-skeleton" aria-hidden="true"></div>':'<div class="post-skeleton" aria-hidden="true"><div class="skeleton-heading"></div><div class="skeleton-picture"></div><div class="skeleton-caption"></div></div>';
 const memberNotice=chrome?'<div class="empty-state" data-adapter-state="empty"><span class="empty-art" aria-hidden="true">◇</span><strong>'+(space==="mytime"?"MyTime by PINO":tabLabel)+'</strong><p>'+(space==="mytime"?"Chưa kết nối tài khoản MyTime.":chrome.studentState==="error"?"Chưa tải được danh sách học viên. Vui lòng thử lại.":"Chưa có nội dung được kết nối.")+'</p></div>':notice;
 const profile=chrome?.students?.find(s=>s.id===chrome.selectedId)??(chrome?.students?.length===1?chrome.students[0]:null);
 const scoped=portfolio?.state==="ready"&&space==="house"&&(!profile||portfolio.profileKey!==profile.id)?{space,state:"no-profile"}:portfolio;
 const portfolioContent=chrome?renderPortfolio(space,tab,scoped):null;
 const content='<div class="feed-inner">'+(tab==="community"?"":'<h1>'+h(tabLabel)+'</h1>')+(portfolioContent??(memberNotice+(chrome?"":skeleton+skeleton)))+(portfolioContent?"":'<p class="ending">Đang chuẩn bị '+h(program.label)+'</p>')+'</div>';
 const students=chrome&&space==="house"?chrome.students:[];
 const selected=students.find(s=>s.id===chrome?.selectedId)??(students.length===1?students[0]:null);
 const label=chrome?(space==="mytime"?"Tài khoản":selected?h(selected.label):"Chọn học viên"):(space==="house"?"Chọn hồ sơ":"Tài khoản");
 const initial=s=>h(String(s?.label??"?").trim().split(/\s+/).at(-1)?.slice(0,1).toUpperCase()||"?");
 const panel=chrome?'<div class="profile-panel member-profile" id="profile-panel" aria-label="Hồ sơ Piner" hidden>'+(space==="house"?'<div class="student-title">Chọn hồ sơ</div><div class="student-options" role="listbox" id="student-options" aria-label="Chọn hồ sơ học viên">'+(students.length?students.map(s=>'<button type="button" role="option" data-student-id="'+h(s.id)+'" aria-selected="'+String(s.id===selected?.id)+'"><span class="student-avatar" aria-hidden="true">'+initial(s)+'</span><span class="student-label"><strong>'+h(s.label)+'</strong>'+(s.program?'<small>'+h(s.program)+'</small>':"")+'</span><span class="student-check" aria-hidden="true">✓</span></button>').join(""):chrome.studentState==="error"?'<p role="alert">Chưa tải được danh sách học viên.</p><button type="button" data-student-retry>Thử lại</button>':'<p>Không có học viên liên kết.</p>')+'</div>':'<strong>MyTime by PINO</strong><p>Chưa kết nối tài khoản MyTime.</p>')+'<button type="button" data-sign-out>Đăng xuất</button></div>':'<div class="profile-panel" id="profile-panel" role="dialog" aria-label="Hồ sơ Piner" hidden><strong>Hồ sơ chưa kết nối</strong><p>Hồ sơ thật sẽ hiển thị khi hoàn tất Identity và Core authorization.</p><button data-dismiss>Đóng</button></div>';
 const navLabels={home:"Bảng tin",grid:"Bộ sưu tập",reels:"Reels",community:"Cộng đồng"};
 const linePaths={"home":"<path d=\"m3.5 10.3 8.5-7 8.5 7\"/><path d=\"M5.5 9.2V20h13V9.2M10 20v-6h4v6\"/>","grid":"<rect x=\"3.5\" y=\"3.5\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13.5\" y=\"3.5\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3.5\" y=\"13.5\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"13.5\" y=\"13.5\" width=\"7\" height=\"7\" rx=\"1.5\"/>","reels":"<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"m10 8 5 4-5 4z\"/>","community":"<circle cx=\"9\" cy=\"8.1\" r=\"3.2\"/><path d=\"M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5z\"/><path d=\"M16.1 5.6a3.1 3.1 0 0 1 0 5.9M17.7 14c2 .6 3 2.2 3 4.5V20h-3\"/>"};
 const nav=TABS.map(t=>'<a class="tab-link'+(t===tab?' selected':'')+'" data-tab="'+t+'" href="'+routeFor(space,t)+'"'+(t===tab?' aria-current="page"':'')+(chrome?' aria-label="'+h(navLabels[t])+'" title="'+h(navLabels[t])+'"><svg fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-line-icon="'+t+'">'+linePaths[t]+'</svg>':'><span class="tab-symbol" aria-hidden="true">'+icon(t)+'</span><span>'+h(navLabels[t])+'</span>')+'</a>').join("");
 return '<section class="member" data-piner-space="'+space+'" data-unified-tab="'+tab+'" data-chrome-collapsed="false">'+
 '<header class="app-header" data-piner-shared="unified-header">'+brand()+
 '<button class="profile-switch" type="button" aria-expanded="false" aria-controls="profile-panel"'+(chrome&&space==="house"?' aria-haspopup="listbox"':"")+'><span class="avatar" aria-hidden="true">'+(chrome?(space==="house"?initial(selected):"M"):"◯")+'</span><span>'+label+'</span>'+(chrome&&space==="house"?"":'<span class="profile-chevron" aria-hidden="true">⌄</span>')+'</button></header>'+
 panel+
 '<main id="main-content" class="scroll-content" data-piner-slot="content" tabindex="-1">'+content+'</main>'+
 '<nav class="bottom-nav" data-piner-shared="bottom-nav" aria-label="Điều hướng Piner APP">'+nav+'</nav></section>';
}
// PAP-2194 presentation only: public worker never supplies memberChrome.
export function renderHtml(route,adapter,{afterschoolLoginAvailable=false,memberChrome=null,portfolio=null}={}){
 assertFailClosed(adapter);
 const chrome=memberChrome&&Array.isArray(memberChrome.students)?memberChrome:null;
 const title=route.kind==="launcher"?"Piner APP · PINO Afterschool + MyTime by PINO":PROGRAMS[route.space].label+" · Piner APP";
 return [
 '<!doctype html><html lang="vi"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
 '<meta name="theme-color" content="#faf8f3"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,">',
 '<title>'+h(title)+'</title><meta name="description" content="Piner APP — PINO Afterschool và MyTime by PINO.">',
 '<link rel="stylesheet" href="/piner-shell.css?v=pap2194">',
 '</head><body><div class="backdrop"><div class="phone'+(route.kind==="launcher"?" launch-phone":"")+'" data-piner-shell="pap1943" data-runtime="fe-only"'+(chrome?' data-member-chrome="true"':"")+(chrome?.runtime?' data-member-session="true"':"")+'>'+(route.kind==="launcher"?launch(chrome):member(route.space,route.tab,adapter,afterschoolLoginAvailable,chrome,portfolio))+'</div></div>',
 '<script defer src="/piner-shell.js?v=pap2194"></script></body></html>'
 ].join("");
}
