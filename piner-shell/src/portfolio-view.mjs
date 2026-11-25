// PAP-2377 / PNR-APP-HUB — native read-only portfolio presentation.
// No session/ACL decisions here: only a server-authorized or isolated test provider may supply this view model.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const states=new Set(["ready","loading","empty","no-profile","denied","error"]);
const imageSrc=v=>typeof v==="string"&&(/^\/(?!\/)[A-Za-z0-9_./%-]+$/.test(v)&&!v.includes("..")&&!/%(?:2e|2f|5c)/i.test(v)||/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v))?v:null;
const photo=(m,i)=>'<img src="'+esc(m.src)+'" alt="'+esc(m.alt||("Ảnh "+(i+1)))+'" loading="lazy" decoding="async">';
const stateCopy={"loading":["Đang tải","Nội dung đang được cập nhật."],"empty":["Chưa có bài viết","Những khoảnh khắc sáng tạo sẽ xuất hiện tại đây."],"no-profile":["Hồ sơ chưa kết nối","Chọn hồ sơ được liên kết để xem nội dung."],"denied":["Không thể xem nội dung","Nội dung không khả dụng cho hồ sơ hiện tại."],"error":["Chưa tải được nội dung","Vui lòng thử lại."]};
function empty(state){const [title,body]=stateCopy[state]??stateCopy.error;return '<div class="empty-state portfolio-state" data-portfolio-state="'+state+'" role="status"><span class="empty-art" aria-hidden="true">◇</span><strong>'+title+'</strong><p>'+body+'</p>'+(state==="error"?'<button type="button" data-portfolio-retry>Thử lại</button>':"")+'</div>';}
function validPost(p,space){return p&&p.space===space&&typeof p.key==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(p.key)&&typeof p.label==="string"&&typeof p.caption==="string"&&typeof p.date==="string"&&Array.isArray(p.media)&&p.media.length>=1&&p.media.length<=5&&p.media.every(m=>m&&imageSrc(m.src));}
function detail(p){return '<dialog class="portfolio-viewer" data-portfolio-viewer="'+esc(p.key)+'" aria-label="Chi tiết bài viết"><div class="portfolio-viewer-top"><strong>'+esc(p.label)+'</strong><button type="button" data-portfolio-close aria-label="Đóng chi tiết">×</button></div><div class="portfolio-slides">'+p.media.map((m,i)=>'<div data-portfolio-slide="'+i+'"'+(i?' hidden':'')+'>'+photo(m,i)+'</div>').join("")+'</div><div class="portfolio-controls"><button type="button" data-portfolio-prev aria-label="Ảnh trước">‹</button><span data-portfolio-counter aria-live="polite">1 / '+p.media.length+'</span><button type="button" data-portfolio-next aria-label="Ảnh sau">›</button></div><div class="portfolio-copy"><time>'+esc(p.date)+'</time><p>'+esc(p.caption)+'</p>'+feedback(p)+'</div></dialog>';}
function feedback(p){return typeof p.feedback==="string"&&p.feedback.trim()?'<div class="portfolio-feedback"><strong>'+esc(p.feedbackBy||"Nhận xét giáo viên")+'</strong><p>'+esc(p.feedback)+'</p></div>':"";}
export function renderPortfolio(space,tab,model){
 if(!model||!["house","mytime"].includes(space)||!["home","grid"].includes(tab))return null;
 if(model.space!==space||!states.has(model.state))return empty("denied");
 if(model.state!=="ready")return empty(model.state);
 if(!Array.isArray(model.posts)||!model.posts.length)return empty("empty");
 const keys=new Set();
 for(const p of model.posts){if(!validPost(p,space)||keys.has(p.key))return empty("error");keys.add(p.key);}
 const posts=model.posts;
 const main=tab==="grid"?'<div class="portfolio-grid">'+posts.map(p=>p.media.map((m,i)=>'<button type="button" data-portfolio-open="'+esc(p.key)+'" data-portfolio-index="'+i+'" aria-label="Xem ảnh '+(i+1)+' — '+esc(p.label)+'">'+photo(m,i)+'</button>').join("")).join("")+'</div>':
 posts.map(p=>'<article class="portfolio-post"><div class="portfolio-post-header"><strong>'+esc(p.label)+'</strong><time>'+esc(p.date)+'</time></div><button type="button" class="portfolio-cover" data-portfolio-open="'+esc(p.key)+'" data-portfolio-index="0" aria-label="Xem bài viết">'+photo(p.media[0],0)+(p.media.length>1?'<span class="portfolio-count">1 / '+p.media.length+'</span>':"")+'</button><div class="portfolio-copy"><p>'+esc(p.caption)+'</p>'+feedback(p)+'</div></article>').join("");
 return '<section class="portfolio" data-portfolio-state="ready">'+main+posts.map(detail).join("")+'</section>';
}
