import type { BoModule, BoRecord, BoFieldType } from "./bo-registration";
import { hoModules } from "./ho-system";

export const PROTOTYPE_KEYS = [
  "centers","users","roles","audits","syllabi","missions","worlds",
  "wardrobe","wardrobeSets","effects","tvPolicy","cms","wish","activities"
] as const;
export type PrototypeModule = (typeof PROTOTYPE_KEYS)[number];

const field=(key:string,label:string,type:BoFieldType="text",w=168)=>({
 key,label,type,icon:type==="number"?"#":type==="id"?"⌘":"Aa",w,readonly:true
});
const extra: Record<"tvPolicy"|"cms"|"wish"|"activities",BoModule> = {
 tvPolicy:{label:"TV Projection Policy",group:"Pinoria",fields:[
  field("name","Policy", "text",260),field("id","ID","id"),field("scope","Scope","select"),
  field("center","Center","text",200),field("resolution","Effective State","select",190),
  field("active","Active Revision","text"),field("latest","Head Revision","text"),
  field("inherited","Inherited From","text"),field("config","Projection Configuration","multiselect",300),
  field("history","Version History","multiselect",320),field("updated","Updated At","date"),
 ]},
 cms:{label:"Website CMS",group:"Content",fields:[
  field("name","Content Slot","text",280),field("id","ID","id"),field("site","Website","select"),
  field("page","Page","text"),field("slot","Slot Key","text"),field("kind","Content Type","select"),
  field("status","State","select"),field("published","Published","text"),
  field("draft","Draft","text"),field("locale","Locale","select"),
  field("preview","Content Preview","textarea",320),field("history","Revision History","multiselect",320),
  field("updated","Updated At","date"),
 ]},
 wish:{label:"Wish",group:"Pinoria",fields:[
  field("name","Configuration","text",260),field("id","ID","id"),field("section","Section","select"),
  field("code","Key / Code","text"),field("status","Status","select"),
  field("family","Family","text"),field("region","Region","text"),field("phase","Release Phase","text"),
  field("rules","Rule Reference","text"),field("period","Availability","text"),
  field("pool","Banner / Reward Pool","multiselect",290),field("details","Description","textarea",300),
 ]},
 activities:{label:"Pinoria Activities",group:"Pinoria",fields:[
  field("name","Activity","text",260),field("id","ID","id"),field("code","Activity Key","text"),
  field("center","Center","text",220),field("scope","Scope","select"),
  field("handler","Handler","select"),field("status","Lifecycle","select"),
  field("starts","Starts","date"),field("ends","Ends","date"),
  field("conditions","Conditions","multiselect",300),field("rewards","Rewards","text"),
  field("description","Description","textarea",300),
 ]},
};
export const prototypeModules:Record<PrototypeModule,BoModule> = Object.fromEntries(
 PROTOTYPE_KEYS.map(key=>{
  const source=key in extra ? extra[key as keyof typeof extra] : hoModules[key as keyof typeof hoModules];
  return [key,{...source, fields:[
   ...source.fields.slice(0,1),
   field("dataset","Nguồn dữ liệu","select",150),
   ...source.fields.slice(1),
   field("note","Ghi chú mô phỏng","textarea",290),
  ]}];
 })
) as Record<PrototypeModule,BoModule>;

export const prototypeRoute=(key:string,section?:string)=>"/prototype?module="+encodeURIComponent(key)+(section?"&section="+encodeURIComponent(section):"");
export const PROTOTYPE_SECTIONS:Partial<Record<PrototypeModule,{value:string,label:string}[]>>={
 tvPolicy:[{value:"all",label:"Tất cả scope"},{value:"default",label:"DEFAULT"},{value:"center",label:"Center overrides"}],
 cms:[{value:"all",label:"Tất cả website"},{value:"PINOHOUSE",label:"PINO House"},{value:"TOPPI",label:"Toppi"},{value:"AFTERWORK",label:"Afterwork"}],
 wish:[{value:"catalog",label:"Catalog"},{value:"banners",label:"Banners"},{value:"rules",label:"Rules"},{value:"phases",label:"Release Phases"}],
 activities:[{value:"all",label:"Tất cả"},{value:"global",label:"GLOBAL"},{value:"center",label:"Theo Center"}],
};
const REAL="Staging · QA";
const DEMO="Mô phỏng";
const row=(id:string,name:string,values:Record<string,string|number|boolean|null|string[]>,real=false,note="Dữ liệu minh họa; không phải bản ghi vận hành.") =>
 ({id,name,...values,dataset:real?REAL:DEMO,note:real?"Cấu trúc và giá trị mẫu có trong PINO Core staging. Có thể là QA fixture.":note}) as BoRecord;
const pick=<T,>(items:readonly T[],i:number)=>items[i % items.length];
const centerNames=["Cần Thơ","Ninh Kiều · Demo","Cái Răng · Demo","Bình Thủy · Demo","Phong Điền · Demo"];
const centerKeys=["can-tho","demo-ninh-kieu","demo-cai-rang","demo-binh-thuy","demo-phong-dien"];
const paths=["Art Foundation","Piano Foundation","Anime","Design","Advanced Art"];
const dates=["2026-10-07","2026-10-09","2026-10-13","2026-10-17","2026-10-22"];
const demoKey=(key:string,i:number)=>"demo-"+key+"-"+String(i+1).padStart(3,"0");

const centerRows:BoRecord[]=centerNames.map((name,i)=>row(demoKey("center",i),name,{
 centerKey:centerKeys[i],timeZone:"Asia/Ho_Chi_Minh",status:i===4?"planned":"active",
},i===0,"Mẫu mô phỏng trạm vệ tinh để duyệt góc nhìn network; không tồn tại trong Core staging."));

const roleNames=["Founder","General Manager","Center Manager","Shift Leader","Reception","Teaching Assistant","Teaching Expert","Academic Operations","Sales","Marketing"];
const roleRows:BoRecord[]=roleNames.map((name,i)=>row(demoKey("role",i),name,{
 roleKey:name.toUpperCase().replaceAll(" ","_"),roleType:i<3?"GLOBAL":"CENTER",
 status:"ACTIVE",permissionCount:[48,36,29,19,13,11,17,24,16,9][i],
 assignmentCount:[1,2,3,6,9,12,8,2,3,2][i],
 permissionKeys:[i<3?"catalog.learning.view":"classroom.diary.view",i<5?"workforce.shift.view":"learning.mission.view"],
 description:"Vai trò minh họa cho UI và quyền được hiển thị chỉ đọc.",
}));
const firstNames=["An","Bình","Chi","Dương","Giang","Hà","Hân","Hương","Khánh","Lan","Mai","Minh","Ngọc","Phúc","Quỳnh","Trang","Trúc","Tú","Vy","Yến"];
const userRows:BoRecord[]=firstNames.map((n,i)=>row(demoKey("user",i),"Nhân sự Demo "+n,{
 status:i%7===0?"INVITED":"ACTIVE",staffMemberId:"DEMO-STAFF-"+String(i+1).padStart(3,"0"),
 roleAssignments:[pick(roleNames,i)+" · "+pick(centerNames,i)],
}));
const auditRows:BoRecord[]=Array.from({length:36},(_,i)=>row(demoKey("audit",i),
 pick(["Đăng nhập","Xem thông tin Role","Xem Center","Đổi phân quyền","Xem dữ liệu TV"],i),{
 action:pick(["ACCESS_LOGIN","ACCESS_ROLE_READ","ACCESS_CENTER_READ","ACCESS_ROLE_ASSIGN","ACCESS_POLICY_READ"],i),
 result:i%11===0?"DENIED":"SUCCESS",scope:pick(centerNames,i),occurred:pick(dates,i),
 actor:"USER-DEMO-"+String((i%20)+1).padStart(3,"0")
}));
const syllabusNames=["Art Foundation — Level 1","Piano Basics — Level 1","Anime Character Design","Color & Composition","Piano Sight Reading","Digital Design","Advanced Art"];
const syllabusRows:BoRecord[]=syllabusNames.map((name,i)=>row(demoKey("syllabus",i),name,{
 code:pick(["ACA-ART-F1","ACA-PNO-F1","ACA-ANI-02","ACA-ART-03","ACA-PNO-02","ACA-DES-01","ACA-ART-05"],i),
 owner:pick(paths,i),ownerType:i%3===0?"HOUSE_CURRICULUM":"HOUSE_PATH",
 lifecycle:i===5?"DRAFT":"ACTIVE",publishedVersion:i===5?null:"v"+(i+1),
 draftVersion:"v"+(i+2),versions:["v1 · PUBLISHED","v2 · DRAFT"],
 createdAt:pick(dates,i)
}));
const missionReal=[
 ["QA-TOS-ART-01","[QA TOS] Pha màu cơ bản",1,10,"A4"],
 ["QA-TOS-ART-02","[QA TOS] Bố cục hình khối",2,20,"A3"],
 ["QA-TOS-PIANO-01","[QA TOS] Chép nốt Đô–Rê–Mi",1,15,"B5"],
 ["QA-TOS-XART-01","[QA TOS] Nhận diện màu cơ bản",1,5,"B5"],
 ["QA-TOS-XART-02","[QA TOS] Hòa sắc nóng lạnh",1,10,"A4"],
 ["QA-TOS-XART-03","[QA TOS] Vẽ vật thể 3D",1,15,"A3"],
 ["QA-TOS-XART-05","[QA TOS] Thiết kế nhân vật",2,25,"A4"],
 ["QA-TOS-XART-06","[QA TOS] Tranh chủ đề biển",2,30,"A3"],
] as const;
const missionRows:BoRecord[]=[
 ...missionReal.map(([code,name,level,plsValue,paperSize],i)=>row(code,name,{code,level,plsValue,paperSize,
 status:"ACTIVE",path:i===2?"Piano Foundation":"Art Foundation",prerequisite:i>2?"QA-TOS-XART-01":null,
 reconciliation:"READY",description:"Bản ghi kiểm thử thật từ staging; không phản ánh giáo trình đã phát hành.",
 guideline:"Quan sát mẫu → thực hành → mentor phản hồi.",diagnostics:[]},true)),
 ...Array.from({length:12},(_,i)=>row(demoKey("mission",i),pick([
  "Vẽ hải đăng Prism","Bảng màu Chroma Sea","Thiết kế Mori","Bố cục tranh phong cảnh",
  "Đọc nốt nhạc khóa Sol","Chép giai điệu 4 ô nhịp","Nhân vật biểu cảm","Hòa âm tiết tấu"
 ],i)+" · "+(i+1),{code:"ACA-DEMO-"+String(i+1).padStart(3,"0"),
 level:i%5+1,plsValue:10+(i%5)*5,paperSize:pick(["B5","A4","A3"],i),
 status:i%6===0?"DRAFT":"ACTIVE",path:pick(paths,i),
 prerequisite:i<2?null:"ACA-DEMO-"+String(i-1).padStart(3,"0"),
 reconciliation:"READY",description:"Nhiệm vụ mô phỏng theo cấu trúc Mission Catalog.",
 guideline:"Đọc giáo án, thực hành và lưu nhật ký lớp.",diagnostics:[]}))
];
const worldRows:BoRecord[]=[
 ...["OTHER","SUMMER","SPECIAL"].map((type,i)=>row("pap979-ext-20261025-world-"+i,
 "[UI TEST] PAP979 World "+(i+1),{key:"pap979-ext-20261025-world-"+i,
 status:"DRAFT",worldType:type,sceneCount:0,layerCount:0,scenes:[],layers:[],thumbnail:null,
 description:"World giả lập phục vụ kiểm thử UI trên staging."},true)),
 ...["Chroma Sea","Whispering Forest","Crystal Highlands","Summer: Skybound Isles"].map((name,i)=>row(demoKey("world",i),
 name,{key:name.toLowerCase().replaceAll(" ","-"),status:i===0?"ACTIVE":"DRAFT",
 worldType:i===3?"SUMMER":"CORE",sceneCount:3+i,layerCount:10+i*3,
 scenes:["Prism Lighthouse","Reef Garden","Moonlit Shore"],
 layers:["Background · 16:9","Ground · PNG","Foreground · Parallax"],
 thumbnail:"demo/world/"+i+".webp",description:"Region Pinoria được mô phỏng cho đánh giá UI."}))
];
const slots=["HEAD/HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"];
const wearableRows:BoRecord[]=[
 ...slots.map((slot,i)=>row("fixture-v1-"+slot.toLowerCase().replace("/","-"),"Fixture v1 "+slot,{
 key:"fixture-v1-"+slot.toLowerCase().replace("/","-"),itemType:"WEARABLE",slot,status:"ACTIVE",
 rarity:1,gender:"ALL",collection:"fixture-v1",season:"QA",tags:["Fixture","V1"],
 variants:["Default · PNG · ACTIVE"],description:"Item mẫu có thật trong D1 staging."},true)),
 ...["Mũ Thủy Triều","Áo Prism","Tóc Gió Biển","Vệt Sóng Bạc","Hào Quang Mori","Huy Hiệu Chroma","Áo San Hô","Ánh Sáng Hải Đăng"]
 .map((name,i)=>row(demoKey("wearable",i),name,{key:"chroma-demo-"+i,itemType:"WEARABLE",slot:pick(slots,i),
 status:i===7?"DRAFT":"ACTIVE",rarity:i%5+1,gender:"ALL",collection:"CHROMA_SEA",season:"2026",
 tags:["Chroma Sea",pick(["Common","Rare","Epic"],i)],variants:["Blue · PNG · ACTIVE","Gold · PNG · DRAFT"],
 description:"Item minh họa theo Ward slot và độ hiếm."}))
];
const wardrobeSetRows:BoRecord[]=[
 ...Array.from({length:3},(_,i)=>row("pap979-ext-20261025-set-"+i,"[UI TEST] PAP979 Set "+(i+1),{
 key:"pap979-ext-20261025-set-"+i,status:"DRAFT",memberCount:0,members:[],webmAssetKey:null},true)),
 ...["Mori Starter Set","Chroma Explorer","Prism Lighthouse","Coral Collector","Sea Guardian"].map((name,i)=>
 row(demoKey("set",i),name,{key:"ward-set-chroma-"+i,status:i===3?"DRAFT":"ACTIVE",
 memberCount:3+i,members:["OUTFIT · Chroma","HEADWEAR · Blue","AURA_BACK · Sea"],
 webmAssetKey:i<2?"demo/pinoria/set-"+i+".webm":null}))
];
const effectRows:BoRecord[]=["Soft Glow","Bubble Trail","Prism Pulse","Stardust","Coral Aura","Sky Ripple"].map((name,i)=>row(demoKey("effect",i),name,{
 rarity:pick(["COMMON","RARE","EPIC"],i),implementationVersion:1+i%2,
 capabilities:["AVATAR_FULL","HOUSE_MINI"],description:"Hiệu ứng mô phỏng theo catalog Core.",
 fullAvatarDescription:"Hiển thị particle chuyển động quanh avatar.",houseMiniDescription:"Glow nhẹ trong TV House Mini."
}));
const tvPolicyRows:BoRecord[]=[
 row("demo-policy-default","PINO TV — Global Projection",{
 scope:"DEFAULT",center:"Tất cả Centers",resolution:"ACTIVE",active:"v3",latest:"v4 · DRAFT",
 inherited:null,config:["Scene: HOUSE_DEFAULT","Frame: 16:9","Ambient: ENABLED","Overlay: COMPACT"],
 history:["v1 · 2026-06-01","v2 · 2026-08-12","v3 · ACTIVE","v4 · DRAFT"],updated:"2026-10-21"}),
 ...centerNames.map((center,i)=>row(demoKey("policy",i),"TV — "+center,{
 scope:"CENTER",center,resolution:i%2===0?"Override":"Inherited",
 active:i%2===0?"v"+(i+1):"v3 · DEFAULT",latest:i%2===0?"v"+(i+2)+" · DRAFT":"—",
 inherited:i%2===0?null:"DEFAULT v3",
 config:i%2===0?["Scene: PINORIA_TV","Mode: REGION","Frame: 16:9"]:["Inherits all DEFAULT settings"],
 history:i%2===0?["v1 · PUBLISHED","v2 · ACTIVE"]:["No local override"],
 updated:pick(dates,i)
 }))
];
const websites=["PINOHOUSE","TOPPI","AFTERWORK"] as const;
const websitePages=[
 ["Home","home.hero.title","TEXT","Câu lạc bộ sáng tạo PINO House"],
 ["Home","home.hero.visual","IMAGE","Khám phá thế giới sáng tạo cùng PINO"],
 ["Academy","aca.paths.intro","RICH_TEXT","Khám phá lộ trình nghệ thuật và âm nhạc"],
 ["House","house.member.benefits","RICH_TEXT","Mỗi tuần thêm một câu chuyện mới"],
 ["Home","hero.headline","TEXT","TOPPI – Những khám phá đầu tiên"],
 ["Home","toppi.programs","CARDS","Khóa học nghệ thuật đầu đời"],
 ["About","toppi.story","RICH_TEXT","Khơi mở tò mò qua trải nghiệm"],
 ["Home","afterwork.hero","TEXT","Afterwork – Tái tạo năng lượng"],
 ["Activities","afterwork.calendar","CARDS","Lịch hoạt động sáng tạo"],
 ["Home","afterwork.gallery","IMAGE","Không gian sáng tạo buổi tối"],
 ["FAQ","common.faq","RICH_TEXT","Những câu hỏi thường gặp"],
 ["Contact","footer.contact","TEXT","Liên hệ PINO House"]
] as const;
const cmsRows:BoRecord[]=websitePages.map(([page,slot,kind,preview],i)=>{
 const site= i<4?"PINOHOUSE":i<7?"TOPPI":i<10?"AFTERWORK":i===10?"PINOHOUSE":"AFTERWORK";
 return row(demoKey("cms",i),slot,{site,page,slot,kind,status:i%4===0?"DRAFT":"PUBLISHED",
 published:i%4===0?null:"r"+(1+i%5),draft:"r"+(2+i%5),
 locale:"vi-VN",preview,history:["r1 · DRAFT","r2 · REVIEW","r3 · PUBLISHED"],
 updated:pick(dates,i)});
});
const wishCatalog=["Mori Water Sigil","Doro Earth Sigil","Suna Earth Sigil","Kora Earth Sigil","Chroma Sea Aura","Prism Lighthouse Set"];
const wishRows:BoRecord[]=[
 ...wishCatalog.map((name,i)=>row(demoKey("wish-item",i),name,{
 section:"catalog",code:"WISH-CHROMA-"+String(i+1).padStart(2,"0"),
 status:i===5?"DRAFT":"ACTIVE",family:i<4?"COMPANION":"WARDROBE",
 region:"CHROMA_SEA",phase:pick(["Phase 1","Phase 2"],i),
 rules:"WISH_RULES_V2",period:"2026 Q4",pool:["COMMON 70%","RARE 25%","EPIC 5%"],
 details:"Cấu hình item trong Wish Catalog được mô phỏng."})),
 ...["Chroma Sea — Opening","Prism Beacon","Mori Awakening","Coral Radiance","Summer Memories"].map((name,i)=>
 row(demoKey("wish-banner",i),name,{section:"banners",code:"BANNER-"+(i+1),
 status:i===4?"SCHEDULED":"ACTIVE",family:"CHROMA",region:"CHROMA_SEA",
 phase:i<3?"Phase 1":"Phase 2",rules:"WISH_RULES_V2",
 period:pick(["2026-10-01 → 2026-11-30","2026-12-01 → 2027-01-10"],i),
 pool:["Mori","Wardrobe Set","Aura"],details:"Banner có liên kết Catalog/Release Phase (mô phỏng)."})),
 ...["Wish Pity Rule","Banner Eligibility","Featured Pool Distribution","Reward Conversion"].map((name,i)=>
 row(demoKey("wish-rule",i),name,{section:"rules",code:"WISH-RULE-"+(i+1),
 status:"ACTIVE",family:"CHROMA",region:"GLOBAL",phase:"Any",
 rules:"v"+(i+1),period:"Ongoing",pool:["COMMON / RARE / EPIC"],
 details:"Quy tắc mô phỏng chỉ để duyệt cấu trúc hiển thị."})),
 ...["Phase 1 · Discovery","Phase 2 · Resonance","Phase 3 · Awakening"].map((name,i)=>
 row(demoKey("wish-phase",i),name,{section:"phases",code:"CHROMA-PHASE-"+(i+1),
 status:i===2?"DRAFT":"PUBLISHED",family:"CHROMA",region:"CHROMA_SEA",
 phase:"Phase "+(i+1),rules:"WISH_RULES_V2",period:pick(["2026-10-01 → 2026-11-01","2026-11-02 → 2026-12-01","2026-12-02 → 2027-01-05"],i),
 pool:["Featured 2 slots"],details:"Phase mô phỏng không kích hoạt lịch phát hành."}))
];
const activityRows:BoRecord[]=[
 row("pinoria-readiness-staging-ritual-v1","Mori Readiness Staging",{
 code:"pinoria-readiness-staging-ritual-v1",center:"Center ID: 019d1000…001",
 scope:"CENTER",handler:"COMPANION_RITUAL",status:"ACTIVE",
 starts:"2026-01-01",ends:"2030-01-01",
 conditions:["Companion: Mori"],rewards:"Staging ritual",description:"Activity QA staging có thật; center ID là fixture."},true),
 ...["Khám phá hải đăng","Vòng xoáy sắc màu","Đánh thức Mori","Mảnh ghép Chroma","Prism Workshop","Tuần lễ hội họa","Bữa tiệc âm nhạc",
 "Ritual ánh sáng","Trạm cát kỳ diệu","Thử thách sáng tạo","Hành trình ký ức"].map((name,i)=>row(demoKey("activity",i),name,{
 code:"PINORIA-ACT-"+(i+1),center:i%3===0?"GLOBAL":pick(centerNames,i),
 scope:i%3===0?"GLOBAL":"CENTER",handler:pick(["COMPANION_RITUAL","MISSION_SHOWCASE","WORLD_EVENT"],i),
 status:i%7===0?"DRAFT":i%9===0?"RETIRED":"ACTIVE",starts:pick(dates,i),ends:"2026-12-31",
 conditions:["Region: CHROMA_SEA",i%2===0?"Min level: 2":"Member only"],
 rewards:(5+i*5)+" PLS",description:"Hoạt động Pinoria theo Center/scope, dữ liệu mô phỏng."
 }))
];
const prototypeData:Record<PrototypeModule,BoRecord[]>={centers:centerRows,users:userRows,roles:roleRows,audits:auditRows,
 syllabi:syllabusRows,missions:missionRows,worlds:worldRows,wardrobe:wearableRows,wardrobeSets:wardrobeSetRows,
 effects:effectRows,tvPolicy:tvPolicyRows,cms:cmsRows,wish:wishRows,activities:activityRows};

export function prototypeRows(key:PrototypeModule,section=""):BoRecord[]{
 const rows=prototypeData[key];
 if(key==="tvPolicy"&&section==="default")return rows.filter(r=>r.scope==="DEFAULT");
 if(key==="tvPolicy"&&section==="center")return rows.filter(r=>r.scope==="CENTER");
 if(key==="cms"&&websites.some(s=>s===section))return rows.filter(r=>r.site===section);
 if(key==="wish")return rows.filter(r=>r.section===(["catalog","banners","rules","phases"].includes(section)?section:"catalog"));
 if(key==="activities"&&section==="global")return rows.filter(r=>r.scope==="GLOBAL");
 if(key==="activities"&&section==="center")return rows.filter(r=>r.scope==="CENTER");
 return rows;
}
export function prototypeCounts(key:PrototypeModule,section=""){
 const rows=prototypeRows(key,section);return {
 shown:rows.length,real:rows.filter(x=>x.dataset===REAL).length,
 mock:rows.filter(x=>x.dataset===DEMO).length
 };
}
