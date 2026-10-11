import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const dutyCss = readFileSync(resolve(process.cwd(), "app/bo/workforce/duty-exceptions/duty-exceptions.module.css"), "utf8");
const rows = [
  { id:"duty-01", staff:"Minh Trần", staffId:"staff-01", center:"PINO House", centerId:"house", session:"sess-01", workDate:"2026-10-11", shift:"Ca tối", reason:"Hoàn tất diary sau giờ", requested:"11/10/2026 20:55", status:"REQUESTED", version:1, duties:["LEARNING::CLASSROOM_DIARY_COMPLETION::class-01"] },
  { id:"duty-02", staff:"Lan Nguyễn", staffId:"staff-02", center:"PINO House", centerId:"house", session:"sess-02", workDate:"2026-10-10", shift:"Ca tối", reason:"Attendance đang reconciliation", requested:"10/10/2026 20:50", status:"APPROVED", version:2, duties:["LEARNING::LEARNING_SESSION_ATTENDANCE_SETTLEMENT::session-02"] },
];
function fixture(){return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${dutyCss}\nbody{margin:0;background:#f6f5f1;font-family:Arial,sans-serif}.frame{padding:32px;max-width:1280px;margin:auto}.surface{margin-top:16px}.peekBackdrop{z-index:40}.peek{z-index:41}</style></head><body><main class="frame"><header class="header"><div><span>Back Office · Workforce</span><h1>Duty Exceptions</h1><p>Manager review cho checkout exception.</p></div></header><div id="notice"></div><section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Staff, reason, session, request ID…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><label>Status<select id="status" aria-label="Filter Duty Exceptions by status"><option value="REQUESTED">Requested</option><option value="APPROVED">Approved</option><option value="ALL">All</option></select></label></div><div class="tableViewport"><table><caption>Duty exception requests</caption><thead><tr><th>Staff</th><th>Shift / Session</th><th>Reason</th><th>Requested</th><th>Status</th></tr></thead><tbody id="body"></tbody></table></div></section><div id="peek"></div><script>
const ROWS=${JSON.stringify(rows)},search=document.querySelector('#search'),status=document.querySelector('#status'),body=document.querySelector('#body'),peek=document.querySelector('#peek'),notice=document.querySelector('#notice');
function params(){return new URLSearchParams(location.search)}function commit(p,push){history[push?'pushState':'replaceState']({},'',location.pathname+(p.toString()?'?'+p:''));render()}
function row(r){return '<tr data-id="'+r.id+'" tabindex="0"><td><strong>'+r.staff+'</strong><br><code>'+r.staffId+'</code></td><td><strong>'+r.shift+'</strong><br>'+r.workDate+'<br><code>'+r.session+'</code></td><td>'+r.reason+'</td><td>'+r.requested+'</td><td>'+r.status+'</td></tr>'}
function detail(r){if(!r)return '';return '<button class="peekBackdrop" aria-label="Close Duty Exception detail backdrop"></button><aside class="peek" role="dialog" aria-label="'+r.staff+' detail"><header class="peekHeader"><div><span>Workforce · Duty Exception</span><h2>'+r.staff+'</h2></div><button id="close" aria-label="Close Duty Exception detail">×</button></header><div class="peekBody"><section class="detailSection"><h3>Unresolved duties at request</h3><code>'+r.duties[0]+'</code></section><section class="detailSection"><h3>Manager decision</h3>'+(r.status==='REQUESTED'?'<label>Current password<input id="password" aria-label="Current password" type="password"></label><button id="approve">Approve exception</button>':'<strong>Approved</strong>')+'</section></div></aside>'}
function render(){const p=params();search.value=p.get('q')||'';status.value=p.get('f_status')||'REQUESTED';const term=search.value.toLowerCase();const visible=ROWS.filter(r=>(status.value==='ALL'||r.status===status.value)&&(!term||(r.staff+' '+r.reason+' '+r.session+' '+r.id).toLowerCase().includes(term)));document.querySelector('#result').textContent=visible.length+' / '+ROWS.length+' exceptions';body.innerHTML=visible.map(row).join('');body.querySelectorAll('tr').forEach(tr=>tr.onclick=()=>{const n=params();n.set('dutyException',tr.dataset.id);commit(n,true)});const selected=ROWS.find(r=>r.id===p.get('dutyException'));peek.innerHTML=detail(selected);const close=document.querySelector('#close');if(close)close.onclick=()=>{const n=params();n.delete('dutyException');commit(n,false)};const approve=document.querySelector('#approve');if(approve)approve.onclick=()=>{if(!document.querySelector('#password').value)return;selected.status='APPROVED';notice.textContent='Exception đã được Core approve trên exact TimekeepingSession/unresolved set.';render()}}
search.oninput=()=>{const p=params();if(search.value)p.set('q',search.value);else p.delete('q');commit(p,false)};status.onchange=()=>{const p=params();if(status.value==='REQUESTED')p.delete('f_status');else p.set('f_status',status.value);commit(p,false)};window.onpopstate=render;render();
</script></main></body></html>`}

test("PAP-407 Duty Exceptions shared grid preserves browse context and fresh-password approval",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.route("https://pap407.test/bo/workforce/duty-exceptions**",async route=>route.fulfill({status:200,contentType:"text/html",body:fixture()}));
 await page.goto("https://pap407.test/bo/workforce/duty-exceptions?q=Minh");
 for(const h of ["Staff","Shift / Session","Reason","Requested","Status"]) await expect(page.getByRole("columnheader",{name:h,exact:true})).toBeVisible();
 await expect(page.getByText("1 / 2 exceptions")).toBeVisible();
 await page.getByRole("row",{name:/Minh Trần/}).click();
 await expect(page).toHaveURL(/dutyException=duty-01/);
 await expect(page.getByRole("dialog",{name:"Minh Trần detail"})).toBeVisible();
 await expect(page.getByText("LEARNING::CLASSROOM_DIARY_COMPLETION::class-01")).toBeVisible();
 await page.getByLabel("Current password").fill("manager-password");
 await page.getByRole("button",{name:"Approve exception"}).click();
 await expect(page.getByText("Exception đã được Core approve trên exact TimekeepingSession/unresolved set.")).toBeVisible();
 await page.getByRole("button",{name:"Close Duty Exception detail",exact:true}).click();
 await expect(page).toHaveURL(/q=Minh/); await expect(page).not.toHaveURL(/dutyException=/);
 await page.getByLabel("Staff, reason, session, request ID…").fill("");
 await page.getByLabel("Filter Duty Exceptions by status").selectOption("APPROVED");
 await expect(page.getByRole("row",{name:/Lan Nguyễn/})).toBeVisible();
});
