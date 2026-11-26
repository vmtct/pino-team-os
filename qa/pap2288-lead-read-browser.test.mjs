/** PAP-2288 / PLT-LEAD — mounted native Lead TDD, synthetic read API only. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {chromium} from "@playwright/test";
const a="01a03c6e-cc58-7d81-ac8e-123456789abc",b="01a03c6e-cc58-7d81-ac8e-123456789abd",c="01a03c6e-cc58-7d81-ac8e-123456789abe";
const navigation=`
import {useSyncExternalStore} from "react";
const event="lead-test-nav";
function subscribe(fn){window.addEventListener(event,fn);window.addEventListener("popstate",fn);return()=>{window.removeEventListener(event,fn);window.removeEventListener("popstate",fn)}}
const snapshot=()=>location.search;
export const usePathname=()=>location.pathname;
export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,snapshot,snapshot))}
function change(href,replace){const u=new URL(href,location.href);if(u.origin!==location.origin||u.pathname!=="/bo/sales/leads")throw Error("fixture route only");history[replace?"replaceState":"pushState"]({},"",u.pathname+u.search);window.dispatchEvent(new Event(event))}
export const useRouter=()=>({push:href=>change(href,false),replace:href=>change(href,true),back:()=>history.back(),refresh:()=>window.dispatchEvent(new Event(event))});
export const redirect=()=>{throw Error("unexpected redirect")};
`;
const shims={"next/navigation":navigation,"next/link":`import {useRouter} from "next/navigation";export default function Link({href,children,prefetch,...p}){const r=useRouter();return <a {...p} href={href} onClick={e=>{p.onClick?.(e);if(!e.defaultPrevented){e.preventDefault();r.push(href)}}}>{children}</a>}`,"next/image":`export default function Image({alt}){return <span>{alt}</span>}`,"next/dynamic":`export default function dynamic(){return ()=>null}`};
const code=await build({stdin:{contents:`
import {createRoot} from "react-dom/client";
import {LeadHouseholdM1Preview} from "./app/bo/sales/leads/LeadHouseholdM1Preview";
import {LeadApiError} from "./lib/bo-lead-household-client";
import {LeadRecoveryJournal} from "./app/bo/sales/leads/lead-recovery-journal";
const a="${a}",b="${b}",c="${c}";
const rows=[a,b].map((id,i)=>({id,phone:"090000000"+i,contactDisplayName:"Synthetic Lead "+(i+1),status:"ACTIVE",primaryContactMemberId:null,version:1,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:01:00Z",createdBy:null,updatedBy:null,centerId:null,memberCount:i+1,intentCount:1}));
const member={id:c,status:"ACTIVE",version:1,displayName:"Synthetic Student",intendedRoles:["STUDENT"],gender:null,birthPrecision:"YEAR",birthYear:2018,birthMonth:null,birthDay:null,reportedAge:null,ageObservedAt:null,interestKinds:["MYTIME_PIANO"]};
const intent={id:c,kind:"GENERAL_INQUIRY",sourceBrand:"PINO_HOUSE",sourceSurface:"STAFF",status:"SUBMITTED",createdAt:"2026-11-25T00:00:00Z",version:1};
window.syntheticCommandCalls=[];
const household=[member];const newMemberId="01a03c6e-cc58-7d81-ac8e-123456789abf";
const createdLeadId="01a03c6e-cc58-7d81-ac8e-123456789ac2";let createdMembers=[];let createdKey=null;let createdIntakeOpen=true;window.closeSyntheticIntake=()=>{createdIntakeOpen=false;};
const relationships=[];const relationshipId="01a03c6e-cc58-7d81-ac8e-123456789ac1";
if(new URLSearchParams(location.search).has("relations")){const parent={...member,id:"01a03c6e-cc58-7d81-ac8e-123456789ac0",displayName:"Synthetic Parent",intendedRoles:["PARENT"],birthPrecision:"UNKNOWN",birthYear:null,interestKinds:[]};household.push(parent);rows[0].primaryContactMemberId=parent.id;rows[0].memberCount=2;}
function relationReceipt(row){row.version++;return {leadId:row.id,version:row.version,relationshipId};}
function target(id,version){const row=rows.find(r=>r.id===id);if(!row||row.version!==version)throw new LeadApiError(409,"CONFLICT",null);return row;}
function childReceipt(row,memberId){row.version++;row.memberCount=household.length;return {leadId:row.id,version:row.version,memberId};}
const api={
 async search(input){if(input.q==="deny")throw new LeadApiError(403,"DENIED",null);if(input.q==="empty")return {items:[],hasMore:false,nextCursor:null};return input.cursor?{items:[rows[1]],hasMore:false,nextCursor:null}:{items:[rows[0]],hasMore:true,nextCursor:"next"}},
 async detail(id){const row=rows.find(r=>r.id===id);if(!row)throw new LeadApiError(404,"NOT_FOUND",null);return {...row,members:structuredClone(id===createdLeadId?createdMembers:household),relationships:structuredClone(id===createdLeadId?[]:relationships),intents:[],intentHistoryHasMore:false}},
 async history(id){return {items:id===createdLeadId?[{...intent,status:createdIntakeOpen?"SUBMITTED":"CLOSED"}]:[intent],hasMore:false,nextCursor:null}},
 async create(input,key){window.syntheticCommandCalls.push({kind:"create",input,key});const existing=rows.find(r=>r.phone===input.contact.phone&&r.id!==createdLeadId);if(existing){if((input.members??[]).length||input.contact.contactDisplayName!==null&&input.contact.contactDisplayName!==existing.contactDisplayName)throw new LeadApiError(409,"CONFLICT",null);return {leadId:existing.id,version:existing.version,created:false};}if(createdKey===key)return {leadId:createdLeadId,version:1,created:true};if(createdKey)throw new LeadApiError(409,"CONFLICT",null);createdKey=key;createdMembers=(input.members??[]).map(m=>({...m,id:newMemberId,status:"ACTIVE",version:1,ageObservedAt:null}));rows.push({...rows[0],...input.contact,id:createdLeadId,version:1,memberCount:createdMembers.length,intentCount:1,primaryContactMemberId:null});throw new LeadApiError(503,"UNAVAILABLE",null)},
 async archive(id,version,reason,key){const row=target(id,version);window.syntheticCommandCalls.push({kind:"archive",id,version,reason,key});if(id===createdLeadId?createdIntakeOpen:row.intentCount>0)throw new LeadApiError(409,"ARCHIVE_BLOCKED",null);row.status="ARCHIVED";row.version++;return {leadId:id,version:row.version}},
 async addRelation(id,version,relationship,key){const row=target(id,version);window.syntheticCommandCalls.push({kind:"addRelation",id,version,relationship,key});relationships.push({...relationship,id:relationshipId,status:"DECLARED",version:1});return relationReceipt(row)},
 async updateRelation(id,relationshipId,version,relationship,key){const row=target(id,version);window.syntheticCommandCalls.push({kind:"updateRelation",id,relationshipId,version,relationship,key});const r=relationships.find(r=>r.id===relationshipId&&r.status==="DECLARED");if(!r)throw new LeadApiError(409,"CONFLICT",null);Object.assign(r,relationship,{version:r.version+1});return relationReceipt(row)},
 async confirmRelation(id,relationshipId,version,key){const row=target(id,version);window.syntheticCommandCalls.push({kind:"confirmRelation",id,relationshipId,version,key});const r=relationships.find(r=>r.id===relationshipId&&r.status==="DECLARED");if(!r)throw new LeadApiError(409,"CONFLICT",null);r.status="CONFIRMED";r.version++;return relationReceipt(row)},
 async retireRelation(id,relationshipId,version,key){const row=target(id,version);window.syntheticCommandCalls.push({kind:"retireRelation",id,relationshipId,version,key});const i=relationships.findIndex(r=>r.id===relationshipId);if(i<0)throw new LeadApiError(404,"NOT_FOUND",null);relationships.splice(i,1);return relationReceipt(row)},
 async updateMember(id,memberId,version,member,key){const row=target(id,version);window.syntheticCommandCalls.push({id,memberId,version,member,key});const child=household.find(m=>m.id===memberId);if(!child)throw new LeadApiError(404,"NOT_FOUND",null);Object.assign(child,member,{version:child.version+1});return childReceipt(row,memberId)},
 async primary(id,version,memberId,key){const row=target(id,version);window.syntheticCommandCalls.push({id,memberId,version,key});row.primaryContactMemberId=memberId;return childReceipt(row,memberId)},
 async addMember(id,version,member,key){const row=target(id,version);window.syntheticCommandCalls.push({id,version,member,key});household.push({...member,id:newMemberId,status:"ACTIVE",version:1,ageObservedAt:null});return childReceipt(row,newMemberId)},
 async retireMember(id,memberId,version,key){const row=target(id,version);window.syntheticCommandCalls.push({id,memberId,version,key});const index=household.findIndex(m=>m.id===memberId);if(index<0||row.primaryContactMemberId===memberId)throw new LeadApiError(409,"CONFLICT",null);household.splice(index,1);return childReceipt(row,memberId)},
 async contact(id,version,contact,key){const call={id,version,contact,key};window.syntheticCommandCalls.push(call);const row=rows.find(r=>r.id===id);if(!row||row.version!==version)throw new LeadApiError(409,"CONFLICT",null);if(contact.contactDisplayName==="Conflict"){row.contactDisplayName="Concurrent name";row.version++;throw new LeadApiError(409,"CONFLICT",null)}if(contact.contactDisplayName==="Uncertain"&&window.syntheticCommandCalls.filter(c=>c.key===key).length===1)throw new LeadApiError(503,"UNAVAILABLE",null);Object.assign(row,contact,{version:version+1});return {leadId:id,version:row.version}}
};
createRoot(document.querySelector("main")).render(<LeadHouseholdM1Preview readApi={new URLSearchParams(location.search).has("fixture")?undefined:api} commandApi={new URLSearchParams(location.search).has("commands")?api:undefined} recoveryJournal={new URLSearchParams(location.search).has("journal")?new LeadRecoveryJournal(sessionStorage,a):undefined}/>);
`,resolveDir:process.cwd(),loader:"tsx"},jsx:"automatic",bundle:true,write:false,outdir:"out",loader:{".css":"empty"},define:{"process.env.NODE_ENV":'"production"'},plugins:[{name:"isolated-next-navigation",setup(p){p.onResolve({filter:/^next\/(navigation|link|image|dynamic)$/},args=>({path:args.path,namespace:"lead-test"}));p.onLoad({filter:/.*/,namespace:"lead-test"},args=>({contents:shims[args.path],loader:"jsx",resolveDir:process.cwd()}));}}]});
const js=code.outputFiles.find(f=>f.path.endsWith(".js")).text;
test("PAP-2288 mounted native Lead table, cursor, drawer, detail, history and failure states",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  const open=async(search="")=>{await page.goto("http://fixture.invalid/bo/sales/leads"+search);await page.addScriptTag({content:js});};
  await open();
  await page.getByText("Synthetic Lead 1",{exact:true}).waitFor();
  assert.equal(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count(),0);
  await page.getByRole("button",{name:"Tải thêm",exact:true}).click();
  await page.getByText("Synthetic Lead 2",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Open Quick View for "+a}).click();
  await page.getByText("Synthetic Student",{exact:true}).waitFor();
  await page.getByText("MyTime · Piano",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Mở chi tiết đầy đủ →"}).click();
  await page.getByText("25/11/2026 · 07:00",{exact:true}).first().waitFor();
  await page.getByText("Lịch sử",{exact:true}).click();
  await page.getByText("Tư vấn chung",{exact:true}).waitFor();
  await open("?lead="+c);
  await page.getByText("Không tìm thấy Lead",{exact:true}).waitFor();
  assert.equal(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count(),0);
  await open();
  await page.getByText("Synthetic Lead 1",{exact:true}).waitFor();
  const search=page.getByPlaceholder("Tìm tên, số điện thoại, thành viên, chương trình…");
  await search.fill("empty");await page.getByText("Không có Lead phù hợp",{exact:true}).waitFor();
  await search.fill("deny");await page.waitForTimeout(350);
  assert.equal(await page.getByText("Synthetic Lead 1",{exact:true}).count(),0);
  assert.equal(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count(),0);
  await open("?fixture=1");
  await page.getByText("Nguyễn Thị Minh Anh",{exact:true}).first().waitFor();
  assert.ok(await page.getByText("DỮ LIỆU MẪU",{exact:true}).count()>0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test("PAP-2288 mounted contact success, conflict reload and exact uncertain replay",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  await page.goto("https://fixture.invalid/bo/sales/leads?lead="+a+"&commands=1");
  await page.addScriptTag({content:js});
  const name=page.getByRole("textbox",{name:"Người liên hệ",exact:true});
  assert.equal(await page.evaluate(()=>window.isSecureContext&&typeof crypto.randomUUID==="function"),true);
  const calls=()=>page.evaluate(()=>window.syntheticCommandCalls);
  await name.waitFor();assert.equal(await name.inputValue(),"Synthetic Lead 1");
  await name.fill("Changed name");await name.press("Enter");
  try{await page.getByText("Đã tải lại thông tin Lead.",{exact:true}).waitFor();}catch(error){console.error("Synthetic contact diagnostic",{calls:await calls(),statuses:await page.getByRole("status").allTextContents(),errors});throw error;}
  assert.equal(await name.inputValue(),"Changed name");
  assert.equal((await calls())[0].version,1);assert.equal((await calls())[0].id,a);
  await name.fill("Conflict");await name.press("Enter");
  await page.getByRole("button",{name:"Tải lại Lead",exact:true}).click();
  await page.getByText("Đã tải lại thông tin Lead.",{exact:true}).waitFor();
  assert.equal(await name.inputValue(),"Concurrent name");
  await name.fill("Uncertain");await name.press("Enter");
  const retry=page.getByRole("button",{name:"Thử lại cùng yêu cầu",exact:true});
  await retry.waitFor();
  assert.equal(await name.isDisabled(),true);
  await retry.click();
  await page.getByText("Đã tải lại thông tin Lead.",{exact:true}).waitFor();
  assert.equal(await name.inputValue(),"Uncertain");
  const log=await calls();
  assert.equal(log.length,4);assert.deepEqual(log[2],log[3]);assert.equal(log[2].version,3);
  assert.equal(log[0].contact.phone,"0900000000");assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test("PAP-2288 mounted member commands preserve declaration precision and acquisition history",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  await page.goto("https://fixture.invalid/bo/sales/leads?lead="+a+"&tab=members&commands=1");await page.addScriptTag({content:js});
  const calls=()=>page.evaluate(()=>window.syntheticCommandCalls);
  const updated=page.getByText("Đã tải lại thông tin Lead.",{exact:true});
  const name=page.getByRole("textbox",{name:"Họ tên "+c,exact:true});
  await name.waitFor();assert.equal(await name.inputValue(),"Synthetic Student");
  assert.equal(await page.getByRole("textbox",{name:"Tuổi "+c,exact:true}).count(),0);
  await name.fill("Student Updated");await name.press("Enter");await updated.waitFor();
  assert.equal(await name.inputValue(),"Student Updated");
  let log=await calls();assert.equal(log[0].member.birthPrecision,"YEAR");assert.equal(log[0].member.birthYear,2018);assert.deepEqual(log[0].member.interestKinds,["MYTIME_PIANO"]);
  const primary=page.getByRole("checkbox",{name:"Liên hệ chính "+c,exact:true});
  await primary.check();await updated.waitFor();assert.equal(await primary.isChecked(),true);
  assert.equal(await page.getByRole("button",{name:"Gỡ Student Updated",exact:true}).isDisabled(),true);
  await primary.uncheck();await updated.waitFor();assert.equal(await primary.isChecked(),false);
  await page.getByRole("combobox",{name:"Giới tính "+c,exact:true}).selectOption("FEMALE");await updated.waitFor();
  assert.equal(await page.getByRole("combobox",{name:"Giới tính "+c,exact:true}).inputValue(),"FEMALE");
  await page.getByRole("checkbox",{name:"Afterschool · Piano",exact:true}).check();await updated.waitFor();
  log=await calls();assert.deepEqual(log[4].member.interestKinds,["MYTIME_PIANO","AFTERSCHOOL_PIANO"]);assert.equal(log[4].member.gender,"FEMALE");
  await page.getByRole("textbox",{name:"Tên thành viên mới",exact:true}).fill("New Guest");
  await page.getByRole("combobox",{name:"Vai trò thành viên mới",exact:true}).selectOption("GUEST");
  await page.getByRole("button",{name:"＋ Thêm thành viên",exact:true}).click();await updated.waitFor();
  const remove=page.getByRole("button",{name:"Gỡ New Guest",exact:true});await remove.waitFor();await remove.click();await updated.waitFor();assert.equal(await remove.count(),0);
  log=await calls();assert.equal(log.length,7);assert.deepEqual(log.map(x=>x.version),[1,2,3,4,5,6,7]);assert.ok(log.every(x=>x.id===a));assert.equal(log[1].memberId,c);assert.equal(log[2].memberId,null);assert.deepEqual(log[5].member.intendedRoles,["GUEST"]);assert.equal(log[5].member.birthPrecision,"UNKNOWN");
  await page.getByText("Lịch sử",{exact:true}).click();await page.getByText("Tư vấn chung",{exact:true}).waitFor();assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test("PAP-2288 mounted directed relationship declaration lifecycle",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  await page.goto("https://fixture.invalid/bo/sales/leads?lead="+a+"&tab=relationships&commands=1&relations=1");await page.addScriptTag({content:js});
  const parent="01a03c6e-cc58-7d81-ac8e-123456789ac0",relation="01a03c6e-cc58-7d81-ac8e-123456789ac1";
  const updated=page.getByText("Đã tải lại thông tin Lead.",{exact:true});
  await page.getByRole("combobox",{name:"Parent mới",exact:true}).selectOption(parent);
  await page.getByRole("combobox",{name:"Thành viên liên kết mới",exact:true}).selectOption(c);
  await page.getByRole("combobox",{name:"Quan hệ mới",exact:true}).selectOption("Mẹ");
  await page.getByRole("button",{name:"＋ Thêm quan hệ",exact:true}).click();await updated.waitFor();
  const label=page.getByRole("combobox",{name:"Quan hệ "+relation,exact:true});await label.waitFor();assert.equal(await label.inputValue(),"Mẹ");
  await label.selectOption("Người giám hộ");await updated.waitFor();assert.equal(await label.inputValue(),"Người giám hộ");
  await page.getByRole("button",{name:"Xác nhận khai báo "+relation,exact:true}).click();await updated.waitFor();
  await page.getByText("Đã xác nhận khai báo",{exact:true}).waitFor();assert.equal(await label.isDisabled(),true);
  await page.getByText("Thành viên",{exact:true}).first().click();
  const retireChild=page.getByRole("button",{name:"Gỡ Synthetic Student",exact:true});await retireChild.waitFor();assert.equal(await retireChild.isDisabled(),true);
  await page.getByText("Quan hệ",{exact:true}).first().click();
  const retire=page.getByRole("button",{name:"Gỡ quan hệ "+relation,exact:true});await retire.click();await updated.waitFor();assert.equal(await retire.count(),0);
  const log=await page.evaluate(()=>window.syntheticCommandCalls);
  assert.deepEqual(log.map(x=>x.version),[1,2,3,4]);assert.ok(log.every(x=>x.id===a));assert.deepEqual(log[0].relationship,{fromMemberId:parent,toMemberId:c,relationLabel:"Mẹ"});assert.equal(log[1].relationship.relationLabel,"Người giám hộ");assert.ok(log.slice(1).every(x=>x.relationshipId===relation));assert.deepEqual(log.map(x=>x.kind),["addRelation","updateRelation","confirmRelation","retireRelation"]);
  await page.getByText("Lịch sử",{exact:true}).click();await page.getByText("Tư vấn chung",{exact:true}).waitFor();assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test("PAP-2288 mounted Create exact replay and Archive reason/intent guard",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  await page.goto("https://fixture.invalid/bo/sales/leads?commands=1");await page.addScriptTag({content:js});
  await page.getByRole("button",{name:"＋ Tạo Lead",exact:true}).click();
  await page.getByRole("textbox",{name:"Người liên hệ",exact:true}).fill("Synthetic New Lead");
  await page.getByRole("textbox",{name:"Số điện thoại",exact:true}).fill("0900000008");
  await page.getByRole("checkbox",{name:"Piano",exact:true}).first().check();
  await page.getByRole("button",{name:"Tiếp tục: Thành viên →",exact:true}).click();
  await page.getByRole("button",{name:"＋ Thêm thành viên",exact:true}).click();
  await page.getByRole("textbox",{name:"Họ và tên",exact:true}).fill("Synthetic Guest");
  await page.getByRole("checkbox",{name:"Guest",exact:true}).check();
  await page.getByRole("button",{name:"Tạo Lead",exact:true}).click();
  const retry=page.getByRole("button",{name:"Thử lại cùng yêu cầu",exact:true});await retry.waitFor();
  assert.equal(await page.getByRole("textbox",{name:"Họ và tên",exact:true}).isDisabled(),true);
  await retry.click();
  const name=page.getByRole("textbox",{name:"Người liên hệ",exact:true});await name.waitFor();assert.equal(await name.inputValue(),"Synthetic New Lead");
  const calls=()=>page.evaluate(()=>window.syntheticCommandCalls);
  let log=await calls();assert.equal(log.length,2);assert.deepEqual(log[0],log[1]);assert.equal(log[0].input.members[0].displayName,"Synthetic Guest");assert.deepEqual(log[0].input.members[0].intendedRoles,["GUEST"]);assert.deepEqual(log[0].input.members[0].interestKinds,["AFTERSCHOOL_PIANO"]);assert.equal(log[0].input.primaryMemberIndex,null);
  await page.getByRole("button",{name:"Lưu trữ Lead",exact:true}).click();
  const reason=page.getByRole("textbox",{name:"Lý do lưu trữ",exact:true}),confirm=page.getByRole("button",{name:"Xác nhận lưu trữ",exact:true});
  assert.equal(await confirm.isDisabled(),true);
  await reason.fill("Blocked active intent");await confirm.click();
  await page.getByRole("button",{name:"Tải lại Lead",exact:true}).click();
  await page.getByText("Đã tải lại thông tin Lead.",{exact:true}).waitFor();
  await page.evaluate(()=>window.closeSyntheticIntake());
  await reason.fill("  Closed synthetic intake  ");await confirm.click();
  await page.getByText("Đã lưu trữ",{exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Lưu trữ Lead",exact:true}).count(),0);assert.equal(await name.count(),0);
  log=await calls();assert.equal(log.length,4);assert.equal(log[2].version,1);assert.equal(log[3].version,1);assert.equal(log[3].reason,"Closed synthetic intake");assert.equal(log[2].id,log[3].id);assert.notEqual(log[2].key,log[3].key);
  await page.getByText("Thành viên",{exact:true}).first().click();
  try{await page.waitForURL(u=>u.searchParams.get("tab")==="members");const row=page.getByRole("row").filter({hasText:"Synthetic Guest"});await row.waitFor();assert.equal(await row.getByRole("button",{name:"Gỡ Synthetic Guest",exact:true}).isDisabled(),true);}catch(e){console.log("Archived member diagnostics",page.url(),await page.locator("body").innerText());throw e;}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test("PAP-2288 mounted reload known receipt readback and unknown outcome lock",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  await page.goto("https://fixture.invalid/bo/sales/leads?lead="+a+"&commands=1&journal=1");await page.addScriptTag({content:js});
  const name=page.getByRole("textbox",{name:"Người liên hệ",exact:true});await name.waitFor();
  await name.fill("Uncertain");await name.press("Enter");await page.getByRole("button",{name:"Thử lại cùng yêu cầu",exact:true}).waitFor();
  const raw=await page.evaluate(()=>sessionStorage.getItem("pino.leads.pending.v1"));assert.ok(raw);assert.ok(!raw.includes("Uncertain"));assert.ok(!raw.includes("0900000000"));
  await page.reload();await page.addScriptTag({content:js});await page.getByRole("alert").filter({hasText:"Chưa xác định kết quả yêu cầu trước"}).waitFor();await name.waitFor();assert.equal(await name.isDisabled(),true);assert.equal(await page.getByRole("button",{name:"Thử lại cùng yêu cầu",exact:true}).count(),0);assert.equal(await page.getByRole("button",{name:"Lưu trữ Lead",exact:true}).isDisabled(),true);assert.deepEqual(await page.evaluate(()=>window.syntheticCommandCalls),[]);
  // Isolated synthetic setup of a known committed receipt, never a runtime unlock of unknown state.
  await page.evaluate(({id,key})=>sessionStorage.setItem("pino.leads.pending.v1",JSON.stringify({schema:1,scope:id,key,kind:"create",target:null,expectedVersion:null,receipt:{leadId:id,version:1}})),{id:a,key:"8fbaea47-bcdc-4c50-8ca5-2b6335e4ebee"});
  await page.reload();await page.addScriptTag({content:js});await page.getByRole("button",{name:"Tải lại Lead",exact:true}).waitFor();await name.waitFor();assert.equal(await name.isDisabled(),true);
  await page.getByRole("button",{name:"Tải lại Lead",exact:true}).click();await page.getByText("Đã tải lại thông tin Lead.",{exact:true}).waitFor();await name.waitFor();assert.equal(await name.isDisabled(),false);assert.equal(await page.evaluate(()=>sessionStorage.getItem("pino.leads.pending.v1")),null);assert.deepEqual(await page.evaluate(()=>window.syntheticCommandCalls),[]);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test("PAP-2288 mounted contact-only duplicate opens existing Lead without mutation",async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>r.request().isNavigationRequest()&&new URL(r.request().url()).hostname==="fixture.invalid"?r.fulfill({contentType:"text/html",body:"<main></main>"}):r.abort());
  await page.goto("https://fixture.invalid/bo/sales/leads?commands=1");await page.addScriptTag({content:js});
  await page.getByRole("button",{name:"＋ Tạo Lead",exact:true}).click();
  await page.getByRole("textbox",{name:"Số điện thoại",exact:true}).fill("0900000000");
  await page.getByRole("button",{name:"Tiếp tục: Thành viên →",exact:true}).click();
  await page.getByText("Sau khi tạo Lead, mở tab Quan hệ để khai báo liên kết giữa các thành viên.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Tạo Lead",exact:true}).click();
  await page.getByText("Lead đã tồn tại. Đã mở Lead hiện có; chưa thêm thành viên hoặc thay đổi thông tin.",{exact:true}).waitFor();
  await page.waitForURL(u=>u.searchParams.get("lead")===a);
  const name=page.getByRole("textbox",{name:"Người liên hệ",exact:true});await name.waitFor();assert.equal(await name.inputValue(),"Synthetic Lead 1");
  const calls=await page.evaluate(()=>window.syntheticCommandCalls);assert.equal(calls.length,1);assert.equal(calls[0].input.contact.contactDisplayName,null);assert.deepEqual(calls[0].input.members,[]);
  await page.getByText("Thành viên",{exact:true}).first().click();try{await page.waitForURL(u=>u.searchParams.get("tab")==="members");const memberName=page.getByRole("textbox",{name:"Họ tên "+c,exact:true});await memberName.waitFor();assert.equal(await memberName.inputValue(),"Synthetic Student");assert.equal(await page.getByRole("checkbox",{name:"MyTime · Piano",exact:true}).isChecked(),true);assert.equal((await page.evaluate(()=>window.syntheticCommandCalls)).length,1);}catch(e){console.error("Duplicate member readback diagnostic",page.url(),await page.locator("body").innerText());throw e;}assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
