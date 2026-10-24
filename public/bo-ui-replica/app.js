/* PAP-881 · BO Level 1 Architecture V2 · interactive local mock, NO Core data/API */
(() => {
"use strict";
const GROUPS = [
{ title:"WORKSPACE", ids:["today"] },
{ title:"SCHOOL", ids:["students","visits","subscriptions","classes","schedule"] },
{ title:"OPERATIONS", ids:["leads","openstudio","tvs"] },
{ title:"LEARNING", ids:["syllabus","missions","practice"] },
{ title:"WORKFORCE", ids:["staff","workforce","checkin","timekeeping","compensation","duties","payroll","overtime","traininglib","trainingreg"] },
{ title:"PINORIA", ids:["world","economy","companions","wardrobe","effects","tvpolicy"] },
{ title:"CONTENT", ids:["cms"] },
{ title:"SYSTEM", ids:["access","roles","policies","aidata","pancake","audit"] }
];
const moduleList = [
["today","Hôm nay","WORKSPACE","◈","Hàng đợi công việc của BO trong ngày. Chọn một dòng để xem và xử lý nhanh.","Công việc","Người phụ trách|Loại|Hạn xử lý|Trạng thái","workflow"],
["students","Học viên","SCHOOL","◉","Danh bạ học viên, chương trình đang học và thông tin liên quan.","Học viên","Path|Tuổi|Buổi còn lại|Trạng thái","optional"],
["visits","Student Visits","SCHOOL","↳","Nhật ký ra vào trung tâm và các phiên ghé thăm.","Visit","Cơ sở|Giờ vào|Giờ ra|Nguồn|Trạng thái","optional"],
["subscriptions","Subscriptions","SCHOOL","▤","Vòng đời gói học: lịch sử đăng ký, tiêu thụ và gia hạn.","Subscription","Path|Buổi/tuần|Còn lại|Bắt đầu|Trạng thái","workflow"],
["classes","Classes","SCHOOL","▦","Các lớp đang vận hành, lịch học và công suất.","Running Class","Chương trình|Lịch|Sức chứa|Giáo viên|Trạng thái","optional"],
["schedule","Schedule","SCHOOL","▧","Danh sách sự kiện lịch; mở Full Detail để xem lịch trực quan.","Sự kiện lịch","Loại|Cơ sở|Ngày|Thời gian|Trạng thái","calendar"],
["leads","Leads","OPERATIONS","◎","Khách hàng tiềm năng, trạng thái tư vấn và chuyển đổi.","Lead","Nguồn|Quan tâm|Tuổi bé|Liên hệ cuối|Trạng thái","optional"],
["openstudio","Open Studio","OPERATIONS","✳","Phiên studio, lượt đăng ký và quản lý vận hành.","Phiên Studio","Cơ sở|Khung giờ|Sức chứa|Đã đặt|Trạng thái","workflow"],
["tvs","TVs","OPERATIONS","▣","Thiết bị hiển thị, màn chiếu và trạng thái hoạt động.","TV / Device","Cơ sở|Vị trí|Chế độ|Kết nối|Trạng thái","workflow"],
["syllabus","Programs & Syllabus","LEARNING","▥","Danh mục chương trình và giáo án học tập.","Program","Path|Cấp độ|Phiên bản|Nhiệm vụ|Trạng thái","editor"],
["missions","Missions","LEARNING","✧","Nhiệm vụ học tập, điều kiện tiên quyết và PLS.","Mission","Path|Level|PLS|Khổ giấy|Trạng thái","editor"],
["practice","Practice","LEARNING","◌","Luyện tập, repertoire và hồ sơ thực hành.","Practice","Path|Loại|Học viên|Cập nhật|Trạng thái","optional"],
["staff","Staff","WORKFORCE","♙","Danh sách nhân sự, vai trò theo ca và năng lực.","Nhân sự","Role|Cơ sở|Bậc|Ngày gia nhập|Trạng thái","optional"],
["workforce","Schedule & Time","WORKFORCE","◷","Danh sách phân ca; mở Full Detail để xếp lịch theo tuần.","Ca làm","Vai trò|Nhân sự|Ngày|Thời gian|Trạng thái","calendar"],
["checkin","Check-in Exceptions","WORKFORCE","◇","Yêu cầu ngoại lệ check-in và bằng chứng cần xem xét.","Check-in request","Nhân sự|Ngày|Cơ sở|Lý do|Trạng thái","optional"],
["timekeeping","Timekeeping","WORKFORCE","◴","Bảng chấm công đã ghi nhận và các bất thường.","Timekeeping","Nhân sự|Ngày|Check-in|Check-out|Trạng thái","optional"],
["compensation","Lịch sử lương","WORKFORCE","＄","Nhật ký ngày công, tổng giờ và thành tiền.","Ngày lương","Nhân sự|Ngày|Giờ tính|Đơn giá|Trạng thái","optional"],
["duties","Duty Exceptions","WORKFORCE","♢","Các ngoại lệ nhiệm vụ, bàn giao và đề nghị xác nhận.","Duty request","Nhân sự|Ca làm|Lý do|Ngày yêu cầu|Trạng thái","optional"],
["payroll","Kỳ lương","WORKFORCE","▦","Danh sách kỳ lương; chốt và thanh toán theo từng nhân viên.","Kỳ lương","Từ ngày|Đến ngày|Nhân viên|Tổng dự kiến|Trạng thái","payroll"],
["overtime","Duyệt thêm giờ","WORKFORCE","⊕","Yêu cầu tính thêm giờ và quyết định duyệt.","Overtime request","Nhân sự|Ngày|Phút thêm|Lý do|Trạng thái","optional"],
["traininglib","Training Library","WORKFORCE","◫","Kho khóa học và chương trình thăng tiến của nhân sự.","Training","Role|Phiên bản|Tài liệu|Cập nhật|Trạng thái","editor"],
["trainingreg","Training Register","WORKFORCE","◧","Bản ghi đăng ký học và xác nhận hoàn thành.","Training Register","Nhân sự|Khóa học|Đăng ký|Kết quả|Trạng thái","optional"],
["world","World","PINORIA","◉","Thế giới Pinoria, vùng, cảnh và cấu hình studio.","World / Region","Season|Loại|Scenes|Version|Trạng thái","world"],
["economy","Economy","PINORIA","✦","Dữ liệu Wish, Energy và các chính sách kinh tế.","Economy entry","Loại|Giá trị|Áp dụng|Cập nhật|Trạng thái","editor"],
["companions","Collection","PINORIA","❖","Companions, trứng và vòng đời Pet.","Companion","Nguyên tố|Giai đoạn|Rarity|Version|Trạng thái","editor"],
["wardrobe","Wardrobe","PINORIA","✿","Vật phẩm Ward, variant và xem trước asset.","Ward Item","Loại|Slot|Bộ sưu tập|Rarity|Trạng thái","world"],
["effects","Effects","PINORIA","✺","Các hiệu ứng đặc biệt và surfaces hỗ trợ.","Effect","Rarity|Capability|Version|Surface|Trạng thái","editor"],
["tvpolicy","TV Projection Policy","PINORIA","▣","Bản cấu hình nội dung chiếu TV và trình tự phát.","Projection Rule","Loại|Độ ưu tiên|Hết hạn|Cơ sở|Trạng thái","workflow"],
["cms","Website CMS","CONTENT","▧","Nội dung website, bản nháp và phiên bản phát hành.","Content Page","Website|Locale|Loại|Cập nhật|Trạng thái","editor"],
["access","Access","SYSTEM","♧","Tài khoản BO/TOS, quyền và phạm vi truy cập.","Access User","Staff link|Role|Scope|Cập nhật|Trạng thái","optional"],
["roles","Roles","SYSTEM","⚿","Bộ vai trò và các nhóm quyền khai báo.","Role","Phạm vi|Quyền|Số users|Cập nhật|Trạng thái","editor"],
["policies","Policies","SYSTEM","☷","Danh sách chính sách vận hành; Full Detail cho bộ cấu hình.","Policy","Cơ sở|Lĩnh vực|Phiên bản|Hiệu lực|Trạng thái","workflow"],
["aidata","AI Data Inbox","SYSTEM","▤","Các change set AI đang chờ review và đối soát.","Change Set","Loại|Operations|Submitted|Cập nhật|Trạng thái","optional"],
["pancake","Pancake","SYSTEM","◎","Danh sách channel và trạng thái kết nối Pancake.","Channel","Provider|Page ID|Last seen|Đồng bộ|Trạng thái","optional"],
["audit","Audit","SYSTEM","≡","Audit events, request ID, actor và kết quả.","Audit Event","Actor|Action|Đối tượng|Thời gian|Trạng thái","optional"]
];
const MODULES = Object.fromEntries(moduleList.map(a => [a[0], {id:a[0],label:a[1],group:a[2],icon:a[3],description:a[4],noun:a[5],cols:a[6].split("|"),kind:a[7]}]));
const NAMES = ["Bảo Trân","An Nhiên","Nguyễn Phúc Minh","Lâm Xuân Thảo","Vương Quỳnh Chi","Trần Quốc Thái","Di Băng","Phạm Quốc Toàn","Lê Nhã Phương","Võ Bảo Khang","Phan Hồng Thiện","Trần Thái Cát Đan"];
const STAFF = ["Hằng Nguyễn","Vy Trần","Bảo Phạm","Trang Lê","Hương Đỗ","Nhi Phan","Phúc Trần","Hân Võ","Ngọc Nguyễn","Đào Lê","Lam Phạm"];
const PROGRAMS = ["Artchitect","PianoHouse","Little Piner Art","Little Piner Piano","Chroma Sea","Pinoria CAMP"];
const ROLE = ["Reception","TE","TA","Shift Leader","BO Manager","Mentor"];
const generic = ["Đang hoạt động","Chờ duyệt","Bản nháp","Đang hoạt động","Hoàn thành","Đang hoạt động","Cần xử lý","Đang hoạt động","Bản nháp"];
const SPECIAL = {
today:["Duyệt ngoại lệ check-in","Xác nhận hoàn thành Training","Gia hạn gói học tháng 10","Kiểm tra công nhật","Đối soát lịch lớp tối","Bàn giao ca tối","Duyệt báo cáo hoạt động"],
visits:["Visit · Học viên đến lớp","Visit · Open Studio","Visit · Khách thử","Visit · Đổi lịch","Visit · Hoạt động CAMP"],
subscriptions:["Gói Artchitect · Standard","Gói PianoHouse · Standard","Gói Little Piner · Renaissance","Gói Chroma Sea · CAMP","Gói PianoHouse · 6 tháng"],
classes:["Artchitect · Mon Studio","PianoHouse · Wed","Little Piner Art · Fri","Artchitect · Sat Workshop","PianoHouse · Tue Studio"],
schedule:["Lớp Artchitect · Thứ Hai","Lớp PianoHouse · Thứ Tư","Nghỉ lễ / Closure","Workshop cuối tuần","Lớp Music · Thứ Sáu"],
leads:["Lead · Phụ huynh Bảo Trân","Lead · PianoHouse","Lead · Open Studio","Lead · Little Piner Art","Lead · Tư vấn CAMP"],
openstudio:["Open Studio · Thứ Bảy","Open Studio · Thứ Tư","Family Studio · Chủ Nhật","Art Discovery · Thứ Sáu"],
tvs:["TV · Sảnh tầng trệt","TV · Trạm Art","TV · Lớp Piano","TV · Pinoria Corner"],
syllabus:["Artchitect · Foundation","PianoHouse · Beginner","Little Piner Art","Little Piner Piano","Chroma Sea · Region"],
missions:["M-001 · Sea Colours","M-002 · Prism Lighthouse","M-003 · Paint the Current","M-004 · Melody Waves","M-005 · Nature Motif"],
practice:["Practice · Scale C Major","Practice · Sketching","Practice · Repertoire","Practice · Composition"],
workforce:["Ca tối · Tiếp tân","Ca tối · Teacher","Ca tối · Shift Leader","Ca chiều · Workshop"],
checkin:["Đi muộn có lý do","Thiếu ảnh check-in","Xin về sớm","Bổ sung check-out"],
timekeeping:["Ca 18:00–21:00","Ca 18:30–20:00","Ca 16:00–19:00","Ca 17:30–21:00"],
compensation:["Ngày lương · 20/10","Ngày lương · 19/10","Ngày lương · 18/10","Ngày lương · 17/10"],
duties:["Báo cáo thiếu ảnh setup","Xin đổi nhiệm vụ","Xin bổ sung thời gian","Thiếu nhật ký lớp"],
payroll:["Kỳ lương 01–15/10","Kỳ lương 16–31/10","Kỳ lương 01–15/09","Kỳ lương 16–30/09"],
overtime:["Thêm giờ · cuối ca","Thêm giờ · setup lớp","Thêm giờ · workshop"],
traininglib:["Training · Quy trình tiếp tân","Training · Teacher Essentials","Training · Pinoria Introduction","Training · Shift Leader","Training · Tư vấn gói học"],
trainingreg:["Register · Reception","Register · Teacher Essentials","Register · Shift Leader"],
world:["Chroma Sea","Pine Forest","Golden Valley","Sky Islands","Prism Lighthouse"],
economy:["Energy Seed","Wish Standard","Wish Bonus","Hạt Năng Lượng","Gift Rule"],
companions:["MORI","DORO","SUNA","KORA","Companion Egg"],
wardrobe:["Pearl Crown","Sea Aura","Shell Outfit","Back Aura","Coral Mark","Clover Hat"],
effects:["Rainbow","Ghost","Tiny","Giant","Sparkle"],
tvpolicy:["Arrival Projection","Quick Choice","Departure Projection","Ambient Loop","Pinoria TV Policy"],
cms:["Trang chủ · PINO House","Về chúng tôi","Đăng ký học","Workshop","Chính sách trung tâm"],
access:["Manager · Cần Thơ","Frontdesk · Center","Teacher · Art","Teacher · Piano","Staff · Shift Leader"],
roles:["BO Manager","Center Manager","TE","TA","Reception","Shift Leader"],
policies:["Đăng ký ca","Xếp ca tuần","Check-in bằng chứng","Bảng lương","Phân quyền"],
aidata:["Change Set · Learner Mapping","Change Set · Staff Sync","Change Set · Catalog Import","Change Set · Core Reconciliation"],
pancake:["PINO House Main Page","PINO Workshop","PINO Art","PINO Piano"],
audit:["Access grant","Subscription updated","Staff check-in","Payroll period created","Training completion","Student record updated"]
};
const MODULE_KEYS = Object.keys(MODULES);
const navCollapsed=new Set();
const searchable=value=>String(value).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const state = {module:"students",view:"all",query:"",filter:"all",sort:null,sortDesc:false,page:1,pageSize:8,compact:false,selected:null,mode:"view",detail:null,detailTab:"Tổng quan",commandOpen:false,commandIndex:0,dirty:false,previousFocus:null};
const source = {};
const d = x => document.getElementById(x);
const esc = v => String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusKind = t => /hoạt động|đang học|active|hoàn thành|approved|kết nối/i.test(t) ? "active" : /chờ|cần|đang xử lý|pending/i.test(t) ? "attention" : /bản nháp|draft/i.test(t) ? "draft":"done";
const badge = v => '<span class="status '+statusKind(v)+'">'+esc(v)+'</span>';
const colorKind = i => ["","sky","amber","green"][i%4];
const abbrev = s => String(s).replace(/[^\p{L}\p{N} ]/gu,"").split(" ").slice(-2).map(x=>x[0]||"").join("").toUpperCase();
const dateAt = i => {const n=(i%22)+1;return String(n).padStart(2,"0")+"/10/2026"};
const idFor=(m,i)=>"PINO-"+m.id.toUpperCase().slice(0,3)+"-"+String(i+1).padStart(4,"0");
function valueFor(col,i,m) {
  const c=col.toLowerCase(),pi=i%PROGRAMS.length;
  if(/trạng thái|kết quả|đồng bộ|kết nối/i.test(c))return generic[i%generic.length];
  if(/nhân sự|người phụ trách|giáo viên|actor|staff link/i.test(c))return STAFF[i%STAFF.length];
  if(/path|chương trình|khóa học/i.test(c))return PROGRAMS[pi];
  if(/role|vai trò/i.test(c))return ROLE[i%ROLE.length];
  if(/cơ sở|scope/i.test(c))return ["Cần Thơ · House","Cần Thơ · Art","Cần Thơ · Piano"][i%3];
  if(/từ ngày/i.test(c))return i%2===0?"01/10/2026":"16/10/2026";
  if(/đến ngày/i.test(c))return i%2===0?"15/10/2026":"31/10/2026";
  if(/ngày gia nhập|bắt đầu|ngày|cập nhật|submitted|last seen|hiệu lực|liên hệ cuối|thời gian/i.test(c))return /thời gian|khung giờ/i.test(c)?"18:00 – 21:00":dateAt(20-i);
  if(/check-in|giờ vào/i.test(c))return ["17:52","18:04","18:27","16:01"][i%4];
  if(/check-out|giờ ra/i.test(c))return ["21:05","20:01","19:30","18:20"][i%4];
  if(/hạn xử lý/i.test(c))return "Hôm nay · 20:30";
  if(/buổi còn lại|còn lại/i.test(c))return String(3+(i*3)%25)+" buổi";
  if(/buổi\/tuần/i.test(c))return String(2+i%2);
  if(/sức chứa/i.test(c))return (i%3+2)+"/8";
  if(/đã đặt/i.test(c))return String(i%7+1);
  if(/tuổi/i.test(c))return String(5+i%12)+" tuổi";
  if(/nguồn/i.test(c))return ["Facebook","Zalo OA","Walk-in","Referral"][i%4];
  if(/quan tâm/i.test(c))return PROGRAMS[pi];
  if(/level|cấp độ|bậc/i.test(c))return "Level "+(i%5+1);
  if(/pls/i.test(c))return String((i+1)*10);
  if(/khổ giấy/i.test(c))return ["A4","A3","B5"][i%3];
  if(/tổng dự kiến|giá trị|đơn giá/i.test(c))return (250000+(i*185000)).toLocaleString("vi-VN")+" ₫";
  if(/giờ tính/i.test(c))return ["1.5 giờ","3 giờ","2 giờ","4 giờ"][i%4];
  if(/phút thêm/i.test(c))return String(15+i%4*15)+" phút";
  if(/priority|độ ưu tiên/i.test(c))return String(i%5+1);
  if(/đăng ký/i.test(c))return dateAt(i+1);
  if(/lý do/i.test(c))return ["Đổi lịch","Bổ sung bằng chứng","Nghỉ phép","Ngoài khung giờ"][i%4];
  if(/loại/i.test(c))return ["ACA","CAMP","Workshop","Policy"][i%4];
  if(/vị trí/i.test(c))return ["Tầng trệt","Lầu 1","Lầu 2"][i%3];
  if(/version|phiên bản/i.test(c))return "v"+(1+i%3);
  if(/surface|scenes/i.test(c))return String(i%6+2)+" scenes";
  if(/rarity/i.test(c))return "★".repeat(1+i%5);
  if(/nguyên tố/i.test(c))return ["Water","Earth","Wind"][i%3];
  if(/giai đoạn/i.test(c))return ["Egg","Waking","Animation"][i%3];
  if(/slot/i.test(c))return ["HEADWEAR","OUTFIT","BACK","AURA"][i%4];
  if(/bộ sưu tập|season/i.test(c))return ["Chroma Sea","Evergreen","Golden Journey"][i%3];
  if(/provider/i.test(c))return "Pancake";
  if(/page id/i.test(c))return "pino_page_"+String(1000+i);
  if(/locale/i.test(c))return ["vi-VN","en-US"][i%2];
  if(/website/i.test(c))return "pinohouse.art";
  if(/số users|nhân viên/i.test(c))return String(3+i%7);
  if(/operations|nhiệm vụ|tài liệu|quyền/i.test(c))return String(i%8+3);
  if(/action/i.test(c))return ["UPDATE","CREATE","APPROVE"][i%3];
  if(/đối tượng/i.test(c))return "Core / "+m.noun;
  return ["Canonical","Standard","V1","Cần Thơ"][i%4];
}
function records(m) {
 if(source[m.id])return source[m.id];
 const seeds = SPECIAL[m.id] || (m.id==="students"?NAMES:m.id==="staff"?STAFF:[m.noun]);
 source[m.id]=Array.from({length:m.id==="today"?12:21},(_,i)=>{
   const original=seeds[i%seeds.length],identity=seeds.length<12&&i>=seeds.length?original+" · "+String(1+Math.floor(i/seeds.length)):original;
   const values=Object.fromEntries(m.cols.map(x=>[x,valueFor(x,i,m)]));
   if(m.id==="subscriptions"){values["Path"]=PROGRAMS[i%4];values["Trạng thái"]=["Đang hoạt động","Cần xử lý","Bản nháp"][i%3];}
   if(m.id==="students"){values["Trạng thái"]=["Đang học","Đang học","Cần xử lý","Hoàn thành"][i%4];}
   return {id:idFor(m,i),title:identity,values,status:values["Trạng thái"]||generic[i%generic.length],index:i};
 });
 return source[m.id];
}
function getMod(){return MODULES[state.module] || MODULES.students;}
function getFilteredRows(){
 let a=[...records(getMod())];const q=state.query.trim().toLocaleLowerCase("vi");
 if(q)a=a.filter(r=>[r.title,r.id,...Object.values(r.values)].join(" ").toLocaleLowerCase("vi").includes(q));
 if(state.view==="active")a=a.filter(r=>statusKind(r.status)==="active");
 if(state.view==="attention")a=a.filter(r=>statusKind(r.status)==="attention");
 if(state.filter!=="all")a=a.filter(r=>statusKind(r.status)===state.filter);
 if(state.sort){const k=state.sort,sign=state.sortDesc?-1:1,val=r=>k==="title"?r.title:k==="id"?r.id:r.values[k]||"";a.sort((x,y)=>sign*String(val(x)).localeCompare(String(val(y)),"vi"));}
 return a;
}
function saveUrl(push=false) {
 const url=new URL(location.href);url.searchParams.set("module",state.module);
 ["q","view","filter","page","record","detail"].forEach(k=>url.searchParams.delete(k));
 if(state.query)url.searchParams.set("q",state.query);if(state.view!=="all")url.searchParams.set("view",state.view);if(state.filter!=="all")url.searchParams.set("filter",state.filter);
 if(state.page>1)url.searchParams.set("page",String(state.page));if(state.selected)url.searchParams.set("record",state.selected);
 if(state.detail)url.searchParams.set("detail",state.detail);
 history[push?"pushState":"replaceState"]({}, "",url.pathname+url.search);
}
function loadUrl(){
 const q=new URLSearchParams(location.search);state.module=MODULES[q.get("module")]?q.get("module"):"students";state.query=q.get("q")||"";state.view=["all","active","attention"].includes(q.get("view"))?q.get("view"):"all";state.filter=["all","active","attention","draft","done"].includes(q.get("filter"))?q.get("filter"):"all";state.page=Math.max(1,Number(q.get("page")||1)||1);state.selected=q.get("record");state.detail=q.get("detail");state.mode="view";
}
function renderNav(){
 const term=searchable(state.navQuery||"").trim();
 const groups=GROUPS.map(g=>({g,items:g.ids.map(id=>MODULES[id]).filter(m=>!term||searchable(m.label).includes(term))})).filter(x=>x.items.length);
 d("nav-scroll").innerHTML=groups.map(({g,items})=>{
  const expanded=Boolean(term)||!navCollapsed.has(g.title);
  return '<section class="nav-group"><button type="button" class="nav-group-toggle" data-group="'+esc(g.title)+'" aria-expanded="'+expanded+'"><span>'+esc(g.title)+'</span><span class="nav-group-caret">'+(expanded?'⌄':'›')+'</span></button>'+
  (expanded?'<div class="nav-group-links">'+items.map(m=>'<button type="button" class="nav-link '+(state.module===m.id?'active':'')+'" data-module="'+m.id+'" title="'+esc(m.label)+'"><span class="nav-icon">'+m.icon+'</span><span class="nav-title">'+esc(m.label)+'</span></button>').join("")+'</div>':'')+'</section>';
 }).join("")||(term?'<div class="nav-empty">Không tìm thấy module</div>':'');
 d("nav-scroll").querySelectorAll("[data-module]").forEach(btn=>btn.onclick=()=>navigate(btn.dataset.module));
 d("nav-scroll").querySelectorAll("[data-group]").forEach(btn=>btn.onclick=()=>{
  const group=btn.dataset.group;if(navCollapsed.has(group))navCollapsed.delete(group);else navCollapsed.add(group);renderNav();
 });
 const n=GROUPS.filter(g=>navCollapsed.has(g.title)).length;
 d("nav-collapse-all").disabled=n===GROUPS.length;
 d("nav-expand-all").disabled=n===0;
}
function renderHeader(){
 const m=getMod();d("topbar-current").textContent=m.label;d("page-title").textContent=m.label;d("page-eyebrow").textContent=m.group+" / "+m.noun.toUpperCase();d("page-description").textContent=m.description;d("create-label").textContent="Tạo mới";d("table-caption").textContent="Danh sách "+m.noun;
 d("table-search").value=state.query;d("table-screen").classList.toggle("hidden",!!state.detail);d("detail-screen").classList.toggle("hidden",!state.detail);
 d("table-index").textContent="TABLE VIEW 01";
 renderNav();
}
function renderTable(){
 const m=getMod(),filtered=getFilteredRows(),total=filtered.length,per=state.pageSize,pages=Math.max(1,Math.ceil(total/per));
 state.page=Math.min(state.page,pages);
 const rows=filtered.slice((state.page-1)*per,state.page*per),cols=state.compact?m.cols.slice(0,2):m.cols;
 const sharedColumns=window.PinoBODesignSystem.tableColumns({noun:m.noun,fields:m.cols,compact:state.compact});
 const header=(key,label)=>'<th data-key="'+esc(key)+'" data-sort="'+(state.sort===key?'active':'')+'">'+esc(label)+' <span class="sort-icon">'+(state.sort===key?(state.sortDesc?'↓':'↑'):'↕')+'</span></th>';
 d("table-head").innerHTML='<tr>'+sharedColumns.map(c=>header(c.key,c.label)).join("")+'<th class="row-action-column"></th></tr>';
 d("table-head").querySelectorAll("th[data-key]").forEach(th=>th.onclick=()=>{
  if(state.sort===th.dataset.key)state.sortDesc=!state.sortDesc;else{state.sort=th.dataset.key;state.sortDesc=false;}
  state.page=1;renderTable();saveUrl();
 });
 const cell=(r,c)=>{
  const value=r.values[c]??"",markup=/trạng thái|kết quả|đồng bộ|kết nối/i.test(c)?badge(value):esc(value);
  return '<td class="value-cell"><button type="button" class="editable-cell" data-field="'+esc(c)+'" aria-label="Sửa '+esc(c)+' của '+esc(r.title)+'" title="Click để sửa">'+markup+'</button></td>';
 };
 d("table-body").innerHTML=rows.map(r=>'<tr data-id="'+r.id+'" class="'+(state.selected===r.id?'selected':'')+'" tabindex="0" aria-label="Bản ghi '+esc(r.title)+'; click vùng trống để xem Quick View"><td class="name-cell"><button type="button" class="editable-cell identity-name" data-field="title" aria-label="Sửa tên '+esc(r.title)+'">'+esc(r.title)+'</button></td><td class="id-cell"><button type="button" class="copy-id" title="Copy ID" aria-label="Copy ID '+esc(r.id)+'">'+esc(r.id)+'</button></td>'+cols.map(c=>cell(r,c)).join("")+'<td class="action-cell"><button type="button" class="open-quick" aria-label="Quick View '+esc(r.title)+'" title="Quick View">↗</button></td></tr>').join("")||'<tr><td colspan="'+(cols.length+3)+'"><div class="empty-state"><strong>Không tìm thấy bản ghi</strong>Thử thay đổi bộ lọc hoặc tìm kiếm.</div></td></tr>';
 d("table-body").querySelectorAll("tr[data-id]").forEach(tr=>{
  const r=rowById(tr.dataset.id);
  tr.onclick=event=>{if(!event.target.closest('button,input,select,textarea'))openDrawer(r.id)};
  tr.onkeydown=event=>{if(event.target===tr&&(event.key==="Enter"||event.key===" ")){event.preventDefault();openDrawer(r.id)}};
  tr.querySelectorAll("[data-field]").forEach(btn=>btn.onclick=event=>{event.stopPropagation();startInlineEdit(btn,r,btn.dataset.field)});
  tr.querySelector(".open-quick").onclick=event=>{event.stopPropagation();openDrawer(r.id)};
  tr.querySelector(".copy-id").onclick=async event=>{event.stopPropagation();try{await navigator.clipboard.writeText(r.id);toast("Đã copy ID")}catch{toast("ID: "+r.id)}};
 });
 d("table-meta").textContent=total+" bản ghi";d("result-label").textContent=total+" bản ghi";
 d("page-counter").textContent=total?((state.page-1)*per+1)+"–"+Math.min(total,state.page*per)+" / "+total:"0 / 0";
 d("prev-btn").disabled=state.page===1;d("next-btn").disabled=state.page>=pages;d("page-size").value=String(state.pageSize);
 document.querySelectorAll(".view-tab").forEach(t=>t.classList.toggle("active",t.dataset.view===state.view));
 d("filter-count").classList.toggle("hidden",state.filter==="all");d("filter-chips").classList.toggle("active",state.filter!=="all");
 d("filter-chips").innerHTML=state.filter==="all"?"":'<button type="button" class="chip" id="clear-chip">Status: '+({active:"Đang hoạt động",attention:"Cần xử lý",draft:"Bản nháp",done:"Hoàn thành"}[state.filter]||"")+' <span>×</span></button>';
 if(d("clear-chip"))d("clear-chip").onclick=()=>{state.filter="all";state.page=1;saveUrl();renderTable()};
}
const STATUS_VALUES=["Đang hoạt động","Chờ duyệt","Bản nháp","Cần xử lý","Hoàn thành","Đang học"];
function makeFieldEditor(field,current){
 if(/trạng thái|kết quả|đồng bộ|kết nối/i.test(field)){
  const select=document.createElement("select");select.className="inline-editor";
  [...new Set([...STATUS_VALUES,current])].forEach(v=>{const option=document.createElement("option");option.value=v;option.textContent=v;select.append(option)});
  select.value=current;return select;
 }
 const input=document.createElement("input");input.className="inline-editor";input.maxLength=120;input.value=current;return input;
}
function startInlineEdit(button,row,field){
 const current=field==="title"?row.title:String(row.values[field]??""),parent=button.parentElement,scroll=d("table-scroll").scrollLeft;
 const input=makeFieldEditor(field,current);button.replaceWith(input);let finished=false;
 const end=save=>{
  if(finished)return;finished=true;
  const value=input.value.trim();
  if(save&&value!==current){
   if(field==="title"){if(value)row.title=value;else toast("Tên không được để trống");}
   else{row.values[field]=value;if(field==="Trạng thái")row.status=value;}
   toast("Đã cập nhật giá trị · mock data");
  }
  renderTable();d("table-scroll").scrollLeft=scroll;
  if(state.selected===row.id&&d("drawer").classList.contains("open"))drawDrawer();
 };
 input.addEventListener("keydown",e=>{e.stopPropagation();if(e.key==="Escape"){e.preventDefault();end(false)}if(e.key==="Enter"){e.preventDefault();end(true)}});
 input.addEventListener("blur",()=>end(true));input.addEventListener("click",e=>e.stopPropagation());
 if(input.tagName==="SELECT")input.addEventListener("change",()=>end(true));
 input.focus();if(input.select)input.select();
}
function navigate(id){
 if(!MODULES[id])return;closeCommand();closeDrawer(true);state.module=id;state.view="all";state.query="";state.filter="all";state.sort=null;state.sortDesc=false;state.page=1;state.detail=null;state.compact=false;renderHeader();renderTable();saveUrl(true);window.scrollTo({top:0});d("sidebar").classList.remove("show");d("mobile-shade").classList.remove("show");}
function rowById(id){return records(getMod()).find(r=>r.id===id)||null}
function openDrawer(id,mode="view"){
 state.previousFocus=document.activeElement;state.selected=id||null;state.mode=mode==="create"?"create":"view";state.dirty=false;state.detail=null;
 if(state.mode==="create")state.draft={title:"",values:Object.fromEntries(getMod().cols.map(c=>[c,""]))};
 saveUrl(true);
 d("drawer").classList.add("open");d("drawer").setAttribute("aria-hidden","false");d("drawer-scrim").classList.add("visible");
 document.body.style.overflow="hidden";drawDrawer();d("drawer-close").focus();renderTable();
}
function closeDrawer(force=false){
 if(!d("drawer").classList.contains("open"))return true;
 if(!force&&state.mode==="create"&&state.dirty&&!confirm("Bỏ bản ghi chưa tạo?"))return false;
 state.selected=null;state.mode="view";state.dirty=false;state.draft=null;
 d("drawer").classList.remove("open");d("drawer").setAttribute("aria-hidden","true");d("drawer-scrim").classList.remove("visible");
 document.body.style.overflow="";saveUrl();renderTable();
 if(state.previousFocus&&state.previousFocus.isConnected)state.previousFocus.focus();
 return true;
}
function drawDrawer(){
 const m=getMod(),isCreate=state.mode==="create",r=isCreate?state.draft:rowById(state.selected);
 d("drawer-path").textContent=m.group+" / "+(isCreate?"CREATE":"QUICK VIEW");
 const title=r?.title||("Chưa đặt tên "+m.noun);
 d("drawer-content").innerHTML=
  '<div class="drawer-heading plain-heading"><div class="drawer-heading-main"><div class="drawer-small-caption">'+esc(m.noun)+' · '+(isCreate?"Tạo mới":"Thuộc tính chỉnh sửa trực tiếp")+'</div>'+
  '<button type="button" class="drawer-title-edit" data-prop="title" title="Click để sửa tên" aria-label="Sửa tên"><h2 id="drawer-title">'+esc(title)+'</h2><span class="property-pencil">✎</span></button>'+
  '<p>'+esc(isCreate?"Bản ghi mới · mock":r?.id||"")+'</p></div></div>'+
  '<section class="drawer-section compact-properties"><h3>Thuộc tính <small>Click giá trị để sửa</small></h3><dl class="drawer-fields">'+
  m.cols.map(c=>'<div class="drawer-field"><dt>'+esc(c)+'</dt><dd><button type="button" class="property-edit" data-prop="'+esc(c)+'" title="Click để sửa '+esc(c)+'">'+(r?.values[c]?(/trạng thái|kết quả|đồng bộ|kết nối/i.test(c)?badge(r.values[c]):'<span>'+esc(r.values[c])+'</span>'):'<span class="property-placeholder">Chưa có</span>')+'<span class="property-pencil">✎</span></button></dd></div>').join("")+
  '<div class="drawer-field"><dt>ID</dt><dd class="id-tag">'+esc(isCreate?"Tự tạo khi lưu":r?.id||"")+'</dd></div></dl></section>'+
  '<section class="drawer-section"><h3>Hoạt động</h3><div class="drawer-audit"><span class="drawer-audit-point">↗</span><div><strong>Mock interaction only</strong><small>'+esc(isCreate?"Chưa lưu vào danh sách":"Sửa từng giá trị sẽ cập nhật mock table")+'</small></div></div></section>';
 d("drawer-footer").innerHTML=isCreate?
  '<button type="button" class="secondary-btn left-action" id="drawer-cancel">Hủy</button><button type="button" class="primary-btn" id="drawer-create">＋ Tạo bản ghi</button>':
  '<button type="button" class="secondary-btn left-action" id="close-quick">Đóng</button>'+(m.kind!=="optional"?'<button type="button" class="primary-btn" id="open-detail">↗ Full Detail</button>':'');
 d("drawer-content").querySelectorAll("[data-prop]").forEach(btn=>btn.onclick=()=>startPropertyEdit(btn,r,btn.dataset.prop,isCreate));
 if(d("drawer-cancel"))d("drawer-cancel").onclick=()=>closeDrawer();
 if(d("drawer-create"))d("drawer-create").onclick=createRecord;
 if(d("close-quick"))d("close-quick").onclick=()=>closeDrawer();
 if(d("open-detail"))d("open-detail").onclick=()=>openDetail(r.id);
}
function startPropertyEdit(button,row,field,isCreate){
 const current=field==="title"?row?.title||"":row?.values[field]||"",editor=makeFieldEditor(field,current);
 button.replaceWith(editor);editor.classList.add("property-input");let saved=false;
 function finish(commit){
  if(saved)return;saved=true;
  const next=editor.value.trim();
  if(commit&&next!==current){
   if(field==="title"){if(next)row.title=next;else toast("Tên không được để trống");}
   else{row.values[field]=next;if(field==="Trạng thái"&&!isCreate)row.status=next;}
   state.dirty=isCreate;
   if(!isCreate){renderTable();toast("Đã cập nhật · mock data");}
  }
  drawDrawer();
 }
 editor.addEventListener("keydown",event=>{
  event.stopPropagation();
  if(event.key==="Escape"){event.preventDefault();finish(false);}
  if(event.key==="Enter"){event.preventDefault();finish(true);}
 });
 editor.addEventListener("blur",()=>finish(true));
 if(editor.tagName==="SELECT")editor.addEventListener("change",()=>finish(true));
 editor.focus();if(editor.select)editor.select();
}
function createRecord(){
 const m=getMod(),draft=state.draft;
 if(!draft?.title?.trim()){toast("Click tên phía trên để nhập tên bản ghi");return;}
 const list=records(m),id=idFor(m,list.length+20),values={...draft.values};
 const row={id,title:draft.title.trim(),values,status:values["Trạng thái"]||"Bản nháp",index:list.length};
 list.unshift(row);state.selected=id;state.mode="view";state.draft=null;state.dirty=false;
 state.view="all";state.filter="all";state.query="";state.page=1;d("table-search").value="";
 renderTable();drawDrawer();saveUrl(true);toast("Đã tạo trong mock · không ghi Core");
}
function openDetail(id){
 const m=getMod();if(m.kind==="optional"&&id!=="architecture")return;
 state.detail=id;state.detailTab="Tổng quan";d("drawer").classList.remove("open");d("drawer-scrim").classList.remove("visible");d("drawer").setAttribute("aria-hidden","true");document.body.style.overflow="";state.selected=null;state.dirty=false;saveUrl(true);renderHeader();renderDetail();window.scrollTo(0,0);
}
function detailGraphic(m){
 if(m.kind==="world")return '<div class="mock-canvas"><div class="canvas-orbit"></div><div class="canvas-island"></div><span class="canvas-label">◈ &nbsp; PINORIA STUDIO · Region preview<br/><small>Canvas / assets / variants cần Full Detail</small></span></div>';
 if(m.kind==="calendar")return '<div class="calendar-grid">'+["THỨ 2","THỨ 3","THỨ 4","THỨ 5","THỨ 6"].map((s,i)=>'<div class="calendar-day"><strong>'+s+'</strong><span>18:00 – 19:30<br/>'+PROGRAMS[i%4]+'</span>'+(i%2===0?'<span>19:30 – 21:00<br/>Workshop</span>':"")+'</div>').join("")+'</div>';
 if(m.kind==="editor")return '<div class="editor-mock"><div class="editor-mock-bar">▤ &nbsp; STRUCTURED EDITOR &nbsp; / &nbsp; MOCK STATE</div><div class="editor-mock-body"><b>Section 01 · Tổng quan</b><p>Trình chỉnh sửa nội dung, cấu hình hoặc asset phức tạp. Các trường được nhóm thành các tab rõ ràng, không nhồi vào drawer.</p><p>＋ Thêm section &nbsp;&nbsp; ✦ Preview &nbsp;&nbsp; ◷ Version history</p></div></div>';
 if(m.kind==="payroll")return '<div class="editor-mock"><div class="editor-mock-bar">PAY PERIOD / STAFF SETTLEMENT</div><div class="editor-mock-body"><b>Chốt theo từng nhân viên, kỳ là tổng hợp</b><p>Nhân viên: Hằng Nguyễn &nbsp; • &nbsp; 48 giờ &nbsp; • &nbsp; Chờ duyệt</p><p>Nhân viên: Vy Trần &nbsp; • &nbsp; 26 giờ &nbsp; • &nbsp; Đang xử lý</p><p>Nhân viên: Trang Lê &nbsp; • &nbsp; 30 giờ &nbsp; • &nbsp; Hoàn thành</p></div></div>';
 return '<div class="editor-mock"><div class="editor-mock-bar">WORKFLOW / STEP-BASED FULL DETAIL</div><div class="editor-mock-body"><b>Bước 1 · Xác nhận thông tin</b><p>Bước 2 · Kiểm tra điều kiện và chính sách</p><p>Bước 3 · Duyệt hoặc ghi nhận kết quả</p><p>Full Detail là lựa chọn theo nghiệp vụ, không thay thế Quick View.</p></div></div>';
}
function renderDetail(){
 const m=getMod(),isArch=state.detail==="architecture",r=rowById(state.detail);
 const title=isArch?"Level 1 Architecture — Table First":r?.title||m.label;
 d("detail-crumb").textContent=title;
 const subt=isArch?"Quy chuẩn toàn BO":m.kind==="world"?"Studio / Visual":m.kind==="calendar"?"Calendar / Matrix":m.kind==="payroll"?"Financial Workflow":"Full Detail / Workflow";
 let tabs=isArch?["Nguyên tắc","Ranh giới","Rollout"]:window.PinoBODesignSystem.detailTabs();
 if(!tabs.includes(state.detailTab))state.detailTab=tabs[0];
 d("detail-content").innerHTML='<div class="detail-cover"><div class="detail-hero"><div><div class="eyebrow">'+esc(m.group)+' / LEVEL 2</div><h1>'+esc(title)+'</h1><p>Đến từ bảng '+esc(m.label)+' → Quick View → Full Detail · '+esc(subt)+'</p></div><span class="full-badge">↗ FULL DETAIL PAGE</span></div><div class="detail-tabs">'+tabs.map(x=>'<button class="detail-tab '+(x===state.detailTab?"selected":"")+'" data-tab="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div><div class="detail-main"><div class="detail-panel"><h3>'+esc(state.detailTab)+'</h3><p>'+(isArch?"Mọi module cấp 1 mở tại bảng; mọi dòng mở Quick View trước. Full Detail chỉ xuất hiện khi công việc dài, có nhiều tab, lịch hoặc canvas.":"Cùng một context và ID, nhưng nội dung chuyên sâu theo bản chất nghiệp vụ.")+'</p>'+(isArch?'<div class="editor-mock"><div class="editor-mock-bar">PINO BO · UNIVERSAL LEVEL-1 CONTRACT</div><div class="editor-mock-body"><p><b>Level 1:</b> Module → Table (search, sort, filter, paging, states)</p><p><b>Quick View:</b> Drawer từ row → xem, sửa nhanh, điều hướng</p><p><b>Full Detail:</b> Optional · Calendar, studio, workflow, multitab editor</p><p><b>Quyền dữ liệu:</b> Logic Core vẫn thuộc domain services</p></div></div>':detailGraphic(m))+'</div><div class="detail-panel detail-explain"><h3>Context bảo toàn</h3><p>Người dùng biết mình đang ở module nào, bản ghi nào và quay về đúng bảng cũ. Không bị mất tìm kiếm hoặc bộ lọc.</p><dl class="drawer-fields">'+(isArch?[["Platform","PINO BO"],["Pattern","Table → Drawer → Page"],["Owner","Shared UI components"],["Data","Mock only"]]:[["Bản ghi",r?.id],["Module",m.label],["Kiểu trang",subt],["Trạng thái",r?.status]]).map(x=>'<div class="drawer-field"><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>').join("")+'</dl><div class="detail-tile"><div><strong>01</strong><small>Table gốc</small></div><div><strong>02</strong><small>Quick View</small></div><div><strong>03</strong><small>Full Detail</small></div></div></div></div></div>';
 d("detail-content").querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.detailTab=b.dataset.tab;renderDetail()});
}
function toast(msg){const t=d("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2500)}
function closeCommand(){state.commandOpen=false;d("cmd-scrim").classList.remove("show")}
function openCommand(){state.commandOpen=true;state.commandIndex=0;d("cmd-scrim").classList.add("show");d("command-search-input").value="";renderCommand();d("command-search-input").focus()}
function commandMatches(){const q=d("command-search-input").value.trim().toLocaleLowerCase("vi");return Object.values(MODULES).filter(m=>!q||((m.label+" "+m.group+" "+m.description).toLocaleLowerCase("vi").includes(q)))}
function renderCommand(){
 const matches=commandMatches();state.commandIndex=Math.min(state.commandIndex,matches.length-1);
 d("command-results").innerHTML=matches.map((m,i)=>'<button type="button" class="command-result '+(state.commandIndex===i?"current":"")+'" data-cmd="'+m.id+'"><span class="command-result-glyph">'+m.icon+'</span><b>'+esc(m.label)+'</b><small>'+esc(m.group)+'</small></button>').join("")||'<div class="empty-state">Không có module phù hợp</div>';
 d("command-results").querySelectorAll("[data-cmd]").forEach(b=>b.onclick=()=>navigate(b.dataset.cmd));
}
function bind(){
 d("mobile-menu").onclick=()=>{d("sidebar").classList.add("show");d("mobile-shade").classList.add("show")};d("sidebar-close").onclick=()=>{d("sidebar").classList.remove("show");d("mobile-shade").classList.remove("show")};d("mobile-shade").onclick=d("sidebar-close").onclick;
 d("table-search").oninput=e=>{state.query=e.target.value;state.page=1;renderTable();saveUrl()};
 document.querySelectorAll(".view-tab").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.page=1;renderTable();saveUrl()});
 d("filter-btn").onclick=()=>{state.filter=({all:"active",active:"attention",attention:"draft",draft:"done",done:"all"})[state.filter];state.page=1;renderTable();saveUrl();toast("Filter: "+state.filter)};
 d("sort-btn").onclick=()=>{state.sort=state.sort==="title"?null:"title";state.sortDesc=false;renderTable();saveUrl();toast(state.sort?"Sắp xếp theo tên":"Bỏ sắp xếp")};
 d("refresh-btn").onclick=()=>{state.filter="all";state.query="";state.view="all";state.page=1;state.sort=null;d("table-search").value="";renderTable();saveUrl();toast("Đã đặt lại bộ lọc")};
 d("columns-btn").onclick=()=>{state.compact=!state.compact;renderTable();toast(state.compact?"Hiển thị cột ưu tiên":"Hiển thị mọi cột")};
 d("page-size").onchange=e=>{state.pageSize=Number(e.target.value);state.page=1;renderTable();saveUrl()};
 d("prev-btn").onclick=()=>{state.page=Math.max(1,state.page-1);renderTable();saveUrl()};
 d("next-btn").onclick=()=>{state.page++;renderTable();saveUrl()};
 d("create-btn").onclick=()=>openDrawer(null,"create");
 d("drawer-close").onclick=()=>closeDrawer();d("drawer-scrim").onclick=()=>closeDrawer();
 d("back-to-table").onclick=()=>{state.detail=null;saveUrl(true);renderHeader();renderTable();window.scrollTo(0,0)};
 d("cmd-btn").onclick=openCommand;
 d("sidebar-module-search").oninput=e=>{state.navQuery=e.target.value;renderNav()};
 d("sidebar-module-search").onkeydown=e=>{if(e.key==="Escape"){e.target.value="";state.navQuery="";renderNav();e.stopPropagation();}};
 d("nav-collapse-all").onclick=()=>{GROUPS.forEach(g=>navCollapsed.add(g.title));renderNav()};
 d("nav-expand-all").onclick=()=>{navCollapsed.clear();renderNav()};
 d("command-search-input").oninput=()=>{state.commandIndex=0;renderCommand()};
 d("cmd-scrim").onclick=e=>{if(e.target===d("cmd-scrim"))closeCommand()};
 document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openCommand();return;}
  if(e.key==="Escape"){if(state.commandOpen){closeCommand();return;}if(d("drawer").classList.contains("open")){closeDrawer();return;}}
  if(state.commandOpen){const a=commandMatches();if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();state.commandIndex=(state.commandIndex+(e.key==="ArrowDown"?1:-1)+a.length)%Math.max(1,a.length);renderCommand();}if(e.key==="Enter"&&a[state.commandIndex]){e.preventDefault();navigate(a[state.commandIndex].id);}return;}
  if(e.key==="/"&&document.activeElement.tagName!=="INPUT"&&document.activeElement.tagName!=="TEXTAREA"&&!state.detail){e.preventDefault();d("table-search").focus();}
 });
 window.addEventListener("popstate",()=>{
  d("drawer").classList.remove("open");d("drawer").setAttribute("aria-hidden","true");d("drawer-scrim").classList.remove("visible");document.body.style.overflow="";
  state.dirty=false;loadUrl();renderHeader();renderTable();
  if(state.detail)renderDetail();
  else if(state.selected){state.previousFocus=d("table-search");d("drawer").classList.add("open");d("drawer").setAttribute("aria-hidden","false");d("drawer-scrim").classList.add("visible");document.body.style.overflow="hidden";drawDrawer();renderTable();}
 });
}
/* PAP-885 main visual: all BO sample modules use the same compact row entry */
const originalMainRenderTable=renderTable;
renderTable=function(){
 originalMainRenderTable();
 const head=d("table-head").querySelector("tr");
 if(head&&head.children.length>1){const last=head.lastElementChild;last.classList.add("compact-open-th");head.prepend(last);}
 d("table-body").querySelectorAll("tr[data-id]").forEach(row=>{const last=row.lastElementChild;last.classList.add("compact-open-cell");row.prepend(last);});
};
loadUrl();bind();renderHeader();renderTable();if(state.detail)renderDetail();if(state.selected)openDrawer(state.selected);
})();
