import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const boCss = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");
const requests = [
  { id: "req-01", staffMemberId: "staff-01", staff: "Minh Trần", centerId: "house", center: "PINO House", date: "2026-10-11", reason: "Hỗ trợ lớp thay ca", requested: "11/10/2026 08:15", status: "REQUESTED", version: 1, assignmentId: null },
  { id: "req-02", staffMemberId: "staff-02", staff: "Lan Nguyễn", centerId: "house", center: "PINO House", date: "2026-10-10", reason: "Hỗ trợ workshop", requested: "10/10/2026 17:20", status: "APPROVED", version: 2, assignmentId: "shift-02" },
  { id: "req-03", staffMemberId: "staff-03", staff: "Huy Lê", centerId: "satellite", center: "PINO Satellite", date: "2026-10-09", reason: "Đến hỗ trợ setup", requested: "09/10/2026 13:05", status: "DECLINED", version: 2, assignmentId: null },
];
const labels = { REQUESTED: "Chờ duyệt", APPROVED: "Đã duyệt", DECLINED: "Đã từ chối", CANCELLED: "Đã hủy" };

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${boCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:34px;max-width:1280px;margin:0 auto}.surface{margin-top:16px}.peekBody{overflow:auto}</style></head><body><main class="frame">
  <header class="heading"><span>Workforce · WFM-EXC</span><h1>Check-in Exceptions</h1><p>Review yêu cầu check-in ngoài lịch.</p></header><div id="notice"></div>
  <section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Tìm staff, reason, request ID…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><div class="exceptionFilters"><label class="field">Center<select id="center" aria-label="Filter check-in exceptions by center"><option value="ALL">Tất cả</option><option value="house">PINO House</option><option value="satellite">PINO Satellite</option></select></label><label class="field">Status<select id="status" aria-label="Filter check-in exceptions by status"><option value="ALL">Tất cả</option><option value="REQUESTED">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="DECLINED">Đã từ chối</option></select></label></div></div>
  <div class="tableViewport"><table><caption>Check-in exception requests</caption><thead><tr><th>Staff</th><th>Center / date</th><th>Reason</th><th>Requested</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div><footer class="pagination"><label>Rows per page<select><option selected>25</option></select></label><div class="paginationNav"><span id="range"></span></div></footer></section><div id="peek"></div></main><script>
  const REQS=${JSON.stringify(requests)}, LABEL=${JSON.stringify(labels)}; const search=document.querySelector('#search'), center=document.querySelector('#center'), status=document.querySelector('#status'), rows=document.querySelector('#rows'), peek=document.querySelector('#peek'), notice=document.querySelector('#notice');
  function params(){return new URLSearchParams(location.search)}
  function commit(next,push){const u=location.pathname+(next.toString()?'?'+next.toString():'');history[push?'pushState':'replaceState']({},'',u);render()}
  function tone(s){return s==='APPROVED'?'success':s==='REQUESTED'?'warning':s==='DECLINED'?'danger':'neutral'}
  function rowHtml(r){return '<tr tabindex="0" data-id="'+r.id+'" data-interactive="true"><td><strong>'+r.staff+'</strong><br><code>'+r.staffMemberId+'</code></td><td><strong>'+r.center+'</strong><br>'+r.date+'</td><td>'+r.reason+'</td><td>'+r.requested+'</td><td><span class="statusPill" data-tone="'+tone(r.status)+'"><i></i>'+LABEL[r.status]+'</span></td></tr>'}
  function detailHtml(r){if(!r)return '';return '<button class="peekBackdrop" aria-label="Close exception detail backdrop"></button><aside class="peek" role="dialog" aria-label="'+r.staff+' detail"><header class="peekHeader"><div><span>Workforce · Check-in exception</span><h2>'+r.staff+'</h2></div><button id="close" aria-label="Close exception detail">×</button></header><div class="peekBody"><div class="exceptionSide"><span id="detailStatus" class="statusPill" data-tone="'+tone(r.status)+'"><i></i>'+LABEL[r.status]+'</span><h2>'+r.staff+'</h2><p>'+r.center+' · '+r.date+'</p><dl class="exceptionFacts"><div><dt>Lý do</dt><dd>'+r.reason+'</dd></div><div><dt>Requested</dt><dd>'+r.requested+'</dd></div><div><dt>Version</dt><dd>'+r.version+'</dd></div><div><dt>Request ID</dt><dd><code>'+r.id+'</code></dd></div><div><dt>Assignment</dt><dd id="assignment">'+(r.assignmentId||'Chưa tạo')+'</dd></div></dl><div class="exceptionNotice">Approval tạo một StaffShiftAssignment canonical có provenance từ request này.</div><div class="exceptionActions">'+(r.status==='REQUESTED'?'<button id="approve" class="primaryButton">Approve & tạo assignment</button><button class="secondaryButton">Decline</button>':'')+'</div></div></div></aside>'}
  function render(){const p=params();search.value=p.get('q')||'';center.value=p.get('f_center')||'ALL';status.value=p.get('f_status')||'ALL';const term=search.value.toLowerCase();const filtered=REQS.filter(r=>(center.value==='ALL'||r.centerId===center.value)&&(status.value==='ALL'||r.status===status.value)&&(!term||(r.staff+' '+r.reason+' '+r.id+' '+r.staffMemberId).toLowerCase().includes(term)));document.querySelector('#result').textContent=filtered.length+' / '+REQS.length+' requests';document.querySelector('#range').textContent=filtered.length?'1–'+filtered.length+' of '+filtered.length:'0–0 of 0';rows.innerHTML=filtered.map(rowHtml).join('');rows.querySelectorAll('tr').forEach(row=>row.addEventListener('click',()=>{const n=params();n.set('checkInException',row.dataset.id);commit(n,true)}));const selected=REQS.find(r=>r.id===p.get('checkInException'));peek.innerHTML=detailHtml(selected);const close=document.querySelector('#close');if(close)close.addEventListener('click',()=>{const n=params();n.delete('checkInException');commit(n,false)});const approve=document.querySelector('#approve');if(approve)approve.addEventListener('click',()=>{selected.status='APPROVED';selected.version+=1;selected.assignmentId='shift-generated-01';notice.innerHTML='<div class="successCard"><strong>Đã duyệt. Core đã tạo assignment canonical cho nhân sự này.</strong></div>';render()})}
  search.addEventListener('input',()=>{const n=params();if(search.value)n.set('q',search.value);else n.delete('q');commit(n,false)});center.addEventListener('change',()=>{const n=params();if(center.value==='ALL')n.delete('f_center');else n.set('f_center',center.value);commit(n,false)});status.addEventListener('change',()=>{const n=params();if(status.value==='ALL')n.delete('f_status');else n.set('f_status',status.value);commit(n,false)});window.addEventListener('popstate',render);render();
  </script></body></html>`;
}

test("PAP-406 Founder/Manager check-in exception grid preserves browse context and bounded review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap406.test/bo/workforce/check-in-exceptions**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap406.test/bo/workforce/check-in-exceptions?q=Minh&f_status=REQUESTED");
  for (const header of ["Staff", "Center / date", "Reason", "Requested", "Status"]) await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  await expect(page.getByText("1 / 3 requests")).toBeVisible();
  await page.getByRole("row", { name: /Minh Trần/ }).click();
  await expect(page).toHaveURL(/checkInException=req-01/);
  await expect(page.getByRole("dialog", { name: "Minh Trần detail" })).toBeVisible();
  await expect(page.getByText("req-01", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve & tạo assignment" }).click();
  await expect(page.getByText("Đã duyệt. Core đã tạo assignment canonical cho nhân sự này.")).toBeVisible();
  await expect(page.locator("#assignment")).toHaveText("shift-generated-01");
  await page.getByRole("button", { name: "Close exception detail", exact: true }).click();
  await expect(page).not.toHaveURL(/checkInException=/);
  await expect(page).toHaveURL(/q=Minh/);
  await expect(page).toHaveURL(/f_status=REQUESTED/);
  await page.getByLabel("Tìm staff, reason, request ID…").fill("");
  await page.getByLabel("Filter check-in exceptions by status").selectOption("APPROVED");
  await expect(page.getByRole("row", { name: /Lan Nguyễn/ })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap406-check-in-exceptions-grid.png");
});
