// PAP-1943 / PNR-APP-HUB — brand and geometry follow approved authoritative i5 Piner prototype.
import {PROGRAMS,TABS,routeFor,assertFailClosed} from "./adapter.mjs";
const PINO="https://assets.pinohouse.art/site/core/Pino%20Sigil.png";
const WORDMARK="/piner_app_logo_no_yellow_transparent.png";
const h=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function brand(cls="brand"){
 return '<a href="/" class="'+cls+'" aria-label="Piner APP — Trang chủ"><img class="sigil" src="'+PINO+'" alt="PINO" width="29" height="29"><img class="wordmark" src="'+WORDMARK+'" alt="Piner APP" width="98" height="29"></a>';
}
function card(space,title,sub){
 return '<a class="program-card '+space+'" href="'+routeFor(space)+'" data-launch-app="'+space+'" aria-label="Mở '+h(PROGRAMS[space].label)+'"><span class="card-photo" aria-hidden="true"></span><span class="card-fade" aria-hidden="true"></span><span class="card-copy"><strong>'+title+'</strong><span class="tagline">'+sub+'</span><span class="arrow" aria-hidden="true">→</span></span></a>';
}
function launch(){
 return '<main id="main-content" class="launch"><div class="launch-brand"><img class="launch-sigil" src="'+PINO+'" alt="PINO" width="30" height="30"><img class="launch-wordmark" src="'+WORDMARK+'" alt="Piner APP" width="160" height="70"></div><nav class="programs" aria-label="Chọn chương trình">'+
 card("house",'<span class="pino-word">PINO</span> <span class="afterschool-word">Afterschool</span>',"Hết giờ học,<br>đến giờ con khám phá.")+
 card("mytime","MyTime<small>by PINO</small>","Hết những bận rộn,<br>đến giờ mình tận hưởng.")+
 '</nav><p class="launch-note">Piner APP · Không gian sáng tạo của bạn</p></main>';
}
function icon(tab){return {home:"⌂",grid:"▦",reels:"▶",community:"◌"}[tab];}
function member(space,tab,adapter){
 assertFailClosed(adapter);
 const program=PROGRAMS[space];
 const tabLabel={home:"Bảng tin",grid:"Bộ sưu tập",reels:"Reels",community:"Cộng đồng"}[tab];
 const desc=tab==="community"?"Chưa có dữ liệu cộng đồng được phép hiển thị.":"Nội dung riêng tư sẽ xuất hiện sau khi kết nối tài khoản và quyền truy cập từ Core.";
 const notice='<div class="empty-state" data-adapter-state="unauthenticated"><span class="empty-art" aria-hidden="true">◇</span><strong>Không gian riêng tư</strong><p>'+h(desc)+'</p><small>UI Shell · Identity chưa kết nối</small></div>';
 const skeleton=tab==="grid"?'<div class="grid-skeleton" aria-hidden="true"><i></i><i></i><i></i><i></i></div>':
  tab==="reels"?'<div class="reel-skeleton" aria-hidden="true"></div>':'<div class="post-skeleton" aria-hidden="true"><div class="skeleton-heading"></div><div class="skeleton-picture"></div><div class="skeleton-caption"></div></div>';
 const content='<div class="feed-inner">'+(tab==="community"?"":'<h1>'+h(tabLabel)+'</h1>')+notice+skeleton+skeleton+'<p class="ending">Đang chuẩn bị '+h(program.label)+'</p></div>';
 const nav=TABS.map(t=>'<a class="tab-link'+(t===tab?' selected':'')+'" data-tab="'+t+'" href="'+routeFor(space,t)+'"'+(t===tab?' aria-current="page"':'')+'><span class="tab-symbol" aria-hidden="true">'+icon(t)+'</span><span>'+h({home:"Bảng tin",grid:"Bộ sưu tập",reels:"Reels",community:"Cộng đồng"}[t])+'</span></a>').join("");
 return '<section class="member" data-piner-space="'+space+'" data-unified-tab="'+tab+'" data-chrome-collapsed="false">'+
 '<header class="app-header" data-piner-shared="unified-header">'+brand()+
 '<button class="profile-switch" type="button" aria-expanded="false" aria-controls="profile-panel"><span class="avatar" aria-hidden="true">◯</span><span>'+(space==="house"?"Chọn hồ sơ":"Tài khoản")+'</span><span aria-hidden="true">⌄</span></button></header>'+
 '<div class="profile-panel" id="profile-panel" role="dialog" aria-label="Hồ sơ Piner" hidden><strong>Hồ sơ chưa kết nối</strong><p>Hồ sơ thật sẽ hiển thị khi hoàn tất Identity và Core authorization.</p><button data-dismiss>Đóng</button></div>'+
 '<main id="main-content" class="scroll-content" data-piner-slot="content" tabindex="-1">'+content+'</main>'+
 '<nav class="bottom-nav" data-piner-shared="bottom-nav" aria-label="Điều hướng Piner APP">'+nav+'</nav></section>';
}
export function renderHtml(route,adapter){
 const title=route.kind==="launcher"?"Piner APP · PINO Afterschool + MyTime by PINO":PROGRAMS[route.space].label+" · Piner APP";
 return [
 '<!doctype html><html lang="vi"><head><meta charset="utf-8">',
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
 '<meta name="theme-color" content="#faf8f3"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,">',
 '<title>'+h(title)+'</title><meta name="description" content="Piner APP — PINO Afterschool và MyTime by PINO.">',
 '<link rel="stylesheet" href="/piner-shell.css?v=pap1943">',
 '</head><body><div class="backdrop"><div class="phone'+(route.kind==="launcher"?" launch-phone":"")+'" data-piner-shell="pap1943" data-runtime="fe-only">'+(route.kind==="launcher"?launch():member(route.space,route.tab,adapter))+'</div></div>',
 '<script defer src="/piner-shell.js?v=pap1943"></script></body></html>'
 ].join("");
}
