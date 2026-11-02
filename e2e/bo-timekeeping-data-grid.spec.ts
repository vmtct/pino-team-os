import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const pageCss = readFileSync(resolve(process.cwd(), "app/bo/workforce/timekeeping/timekeeping.module.css"), "utf8");

type Session = { id: string; staff: string; date: string; checkIn: string; checkOut: string; duration: string; assignment: string; status: "OPEN" | "CLOSED"; corrected?: boolean };
const sessions: Session[] = [
  { id: "tk-01", staff: "Hằng Nguyễn", date: "2026-10-11", checkIn: "08:03", checkOut: "—", duration: "—", assignment: "Ops AM", status: "OPEN" },
  { id: "tk-02", staff: "Bảo Trần", date: "2026-10-11", checkIn: "09:02", checkOut: "12:04", duration: "3h 02m", assignment: "Music AM", status: "CLOSED", corrected: true },
  { id: "tk-03", staff: "Trang Lê", date: "2026-10-10", checkIn: "13:30", checkOut: "17:35", duration: "4h 05m", assignment: "Art PM", status: "CLOSED" },
  { id: "tk-04", staff: "Hằng Nguyễn", date: "2026-10-09", checkIn: "08:01", checkOut: "12:01", duration: "4h 00m", assignment: "Ops AM", status: "CLOSED" },
  { id: "tk-05", staff: "Bảo Trần", date: "2026-10-08", checkIn: "14:00", checkOut: "18:10", duration: "4h 10m", assignment: "Music PM", status: "CLOSED" },
];

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${pageCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1320px;margin:0 auto}.heading{margin-bottom:18px}.surface{margin-top:14px}.metrics{margin-bottom:14px}.peekDetail{padding:2px}</style></head><body><main class="frame">
  <header class="heading"><span>Back Office · Workforce</span><h1>Timekeeping</h1><p>Recorded attendance stays immutable. Authorized corrections are appended as provenance and shown separately.</p></header>
  <section class="metrics" id="metrics"><div class="metric"><span>Currently checked in</span><strong>1</strong></div><div class="metric"><span>Checked out today</span><strong>1</strong></div><div class="metric"><span>Total sessions</span><strong>2</strong></div></section>
  <section class="surface">
    <div class="toolbar"><div class="toolbarSpacer"></div><span class="resultLabel" id="result"></span><div class="gridToolbarActions"><div class="tabs"><button id="today">Today</button><button id="history">History</button></div><label>Center<select aria-label="Filter Timekeeping by center"><option>Can Tho</option></select></label><span class="today" id="today-label">2026-10-11</span><span id="dates"></span><label>Status<select id="status" aria-label="Filter Timekeeping by status"><option value="">All</option><option>OPEN</option><option>CLOSED</option></select></label><label>Staff<select id="staff" aria-label="Filter Timekeeping by staff"><option value="">All</option><option value="Hằng Nguyễn">Hằng Nguyễn</option><option value="Bảo Trần">Bảo Trần</option><option value="Trang Lê">Trang Lê</option></select></label></div></div>
    <div class="filterBar" id="chips" aria-label="Active filters"></div>
    <div class="tableViewport"><table><caption id="caption"></caption><thead><tr><th data-sticky="true">Staff</th><th>Date</th><th>Check-in</th><th>Check-out</th><th>Duration</th><th>Assignment</th><th>Provenance</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
    <footer class="pagination"><label>Rows per page<select id="page-size" aria-label="Rows per page"><option selected>2</option><option>25</option><option>50</option></select></label><div class="paginationNav"><span id="range"></span><button id="prev" aria-label="Previous page">‹</button><button id="next" aria-label="Next page">›</button></div></footer>
  </section><div id="peek-root"></div>
</main><script>
const DATA=${JSON.stringify(sessions)};
const q=()=>new URLSearchParams(location.search);
const rows=document.querySelector('#rows'), result=document.querySelector('#result'), range=document.querySelector('#range'), chips=document.querySelector('#chips'), peek=document.querySelector('#peek-root');
const status=document.querySelector('#status'), staff=document.querySelector('#staff'), metrics=document.querySelector('#metrics'), dates=document.querySelector('#dates'), todayLabel=document.querySelector('#today-label');
function commit(p){history.replaceState({},'',location.pathname+(p.toString()?'?'+p.toString():''));render()}
function render(){const p=q();const mode=p.get('f_mode')==='history'?'history':'today';const page=Math.max(1,Number(p.get('page')||1));status.value=p.get('f_status')||'';staff.value=p.get('f_staff')||'';metrics.style.display=mode==='today'?'grid':'none';todayLabel.style.display=mode==='today'?'inline-block':'none';dates.innerHTML=mode==='history'?'<label>From<input aria-label="Timekeeping history from" type="date" value="2026-10-01"></label><label>To<input aria-label="Timekeeping history to" type="date" value="2026-10-11"></label>':'';document.querySelector('#caption').textContent=mode==='today'?'Today timekeeping sessions':'Timekeeping history';document.querySelector('#today').className=mode==='today'?'activeTab':'';document.querySelector('#history').className=mode==='history'?'activeTab':'';
let data=DATA.filter(x=>mode==='history'||x.date==='2026-10-11');if(status.value)data=data.filter(x=>x.status===status.value);if(staff.value)data=data.filter(x=>x.staff===staff.value);const size=2, pages=Math.max(1,Math.ceil(data.length/size)), canonical=Math.min(page,pages);if(canonical!==page){p.set('page',String(canonical));history.replaceState({},'',location.pathname+'?'+p.toString())}const slice=data.slice((canonical-1)*size,canonical*size);result.textContent=data.length+' sessions · effective view';range.textContent=data.length?((canonical-1)*size+1)+'–'+Math.min(canonical*size,data.length)+' of '+data.length:'0–0 of 0';document.querySelector('#prev').disabled=canonical<=1;document.querySelector('#next').disabled=canonical>=pages;rows.innerHTML=slice.map(x=>'<tr tabindex="0" data-id="'+x.id+'"><td data-sticky="true"><strong>'+x.staff+'</strong><br><span class="canonicalId"><code>'+x.id+'</code><button>⧉</button></span></td><td>'+x.date+'</td><td>'+x.checkIn+'</td><td>'+x.checkOut+'</td><td>'+x.duration+'</td><td>'+x.assignment+'</td><td>'+(x.corrected?'<span class="statusPill" data-tone="info"><i></i>CORRECTED</span>':'Recorded')+'</td><td><span class="statusPill" data-tone="'+(x.status==='OPEN'?'warning':'success')+'"><i></i>'+x.status+'</span></td></tr>').join('');chips.innerHTML=(mode==='history'?'<span class="filterChip">View is History</span>':'')+(status.value?'<span class="filterChip">Status is '+status.value+'</span>':'')+(staff.value?'<span class="filterChip">Staff is '+staff.value+'</span>':'');rows.querySelectorAll('tr').forEach(r=>r.onclick=()=>openPeek(r.dataset.id));}
function openPeek(id){const x=DATA.find(v=>v.id===id);peek.innerHTML='<button class="peekBackdrop" aria-label="Close detail backdrop"></button><aside class="peek" role="dialog" aria-label="'+x.staff+' detail"><header class="peekHeader"><div><span>TimekeepingSession · '+x.date+'</span><h2>'+x.staff+'</h2></div><button id="close" aria-label="Close detail">×</button></header><div class="peekBody"><div class="peekDetail"><section><h3>Recorded</h3><div class="fact"><span>Check-in</span><strong>'+x.checkIn+'</strong></div><div class="fact"><span>Check-out</span><strong>'+x.checkOut+'</strong></div></section>'+(x.corrected?'<section class="correctedBlock"><div class="sectionTitle"><h3>Corrected</h3><span>Effective</span></div><div class="correctionMeta"><strong>CHECK_IN_AT</strong><span>Manager verified source evidence</span></div></section>':'')+'<section><h3>Assignment linkage</h3><div class="fact"><span>Shift</span><strong>'+x.assignment+'</strong></div></section></div></div></aside>';document.querySelector('#close').onclick=()=>peek.innerHTML='';}
document.querySelector('#today').onclick=()=>{const p=q();p.delete('f_mode');p.delete('page');commit(p)};document.querySelector('#history').onclick=()=>{const p=q();p.set('f_mode','history');p.delete('page');commit(p)};status.onchange=()=>{const p=q();status.value?p.set('f_status',status.value):p.delete('f_status');p.delete('page');commit(p)};staff.onchange=()=>{const p=q();staff.value?p.set('f_staff',staff.value):p.delete('f_staff');p.delete('page');commit(p)};document.querySelector('#next').onclick=()=>{const p=q();p.set('page',String(Number(p.get('page')||1)+1));commit(p)};document.querySelector('#prev').onclick=()=>{const p=q();p.set('page',String(Math.max(1,Number(p.get('page')||1)-1)));commit(p)};render();
</script></body></html>`;
}

test("PAP-408 Timekeeping shared grid covers Today, History, filters and bounded pagination", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap408.test/bo/workforce/timekeeping**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap408.test/bo/workforce/timekeeping");
  for (const header of ["Staff", "Date", "Check-in", "Check-out", "Duration", "Assignment", "Provenance", "Status"]) await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
  await expect(page.getByText("2 sessions · effective view")).toBeVisible();
  await expect(page.getByText("1–2 of 2")).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByLabel("Timekeeping history from")).toBeVisible();
  await expect(page.getByText("5 sessions · effective view")).toBeVisible();
  await expect(page.getByText("1–2 of 5")).toBeVisible();
  await page.getByLabel("Next page").click();
  await expect(page.getByText("3–4 of 5")).toBeVisible();

  await page.getByLabel("Filter Timekeeping by status").selectOption("CLOSED");
  await expect(page.getByText("4 sessions · effective view")).toBeVisible();
  await page.getByLabel("Filter Timekeeping by staff").selectOption("Bảo Trần");
  await expect(page.getByText("2 sessions · effective view")).toBeVisible();
  await expect(page.getByText("Status is CLOSED")).toBeVisible();
  await expect(page.getByText("Staff is Bảo Trần")).toBeVisible();

  await page.getByRole("row", { name: /Bảo Trần/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Bảo Trần detail" })).toBeVisible();
  await expect(page.getByText("Corrected", { exact: true })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap408-timekeeping-grid.png");
});
