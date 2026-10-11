import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const boCss = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");
const staff = [
  { id: "staff-01", name: "Nguyễn Hằng", org: "Operations · School", staffStatus: "active", access: "active", email: "hang@example.test", roles: "Manager", attention: "Aligned" },
  { id: "staff-02", name: "Trần Hân", org: "Marketing · Growth", staffStatus: "active", access: "suspended", email: "han@example.test", roles: "Staff", attention: "Access suspended" },
  { id: "staff-03", name: "Bảo Nguyễn", org: "Music · Academic", staffStatus: "inactive", access: "active", email: "bao@example.test", roles: "Teacher", attention: "Access still active" },
  { id: "staff-04", name: "Vy Phạm", org: "Art · Academic", staffStatus: "active", access: "none", email: "", roles: "", attention: "No Access" },
];
function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${boCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1280px;margin:0 auto}.heading{margin-bottom:18px}.surface{margin-top:14px}</style></head><body><main class="frame">
<header class="heading"><span>PINO TEAM · BACK OFFICE</span><h1>Nhân viên & phân quyền</h1><p>Grid-first Staff directory with bounded detail actions.</p></header>
<section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Tìm Staff, department, role, email…" placeholder="Tìm Staff, department, role, email…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><div class="staffGridToolbar"><label class="gridToolbarFilter">Staff<select id="staffStatus" aria-label="Filter Staff by status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select></label><label class="gridToolbarFilter">Access<select id="accessStatus" aria-label="Filter Staff by access"><option value="all">All</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="none">Not provisioned</option></select></label></div></div>
<div class="tableViewport"><table><caption>Staff directory</caption><thead><tr><th data-sticky="true">Staff</th><th>Organization</th><th>Staff status</th><th>Access</th><th>Roles / scopes</th><th>Attention</th></tr></thead><tbody id="rows"></tbody></table></div><footer class="pagination"><label>Rows per page<select aria-label="Rows per page"><option>10</option><option selected>25</option></select></label><div class="paginationNav"><span id="range"></span><button disabled aria-label="Previous page">‹</button><button disabled aria-label="Next page">›</button></div></footer></section><div id="peek"></div></main><script>
const STAFF=${JSON.stringify(staff)};
const search=document.querySelector('#search'), staffStatus=document.querySelector('#staffStatus'), accessStatus=document.querySelector('#accessStatus'), rows=document.querySelector('#rows'), peek=document.querySelector('#peek');
function params(){return new URLSearchParams(location.search)}
function commit(next,push){const u=location.pathname+(next.toString()?'?'+next.toString():'');history[push?'pushState':'replaceState']({},'',u);render()}
function rowHtml(s){const accessTone=s.access==='active'?'success':s.access==='suspended'?'warning':'neutral';const attentionTone=s.attention==='Aligned'?'success':s.attention==='Access still active'?'danger':'warning';return '<tr tabindex="0" data-id="'+s.id+'" data-interactive="true"><td data-sticky="true"><div class="staffGridIdentity"><div><strong>'+s.name+'</strong><span class="canonicalId"><code>'+s.id+'</code><button aria-label="Copy Staff ID">⧉</button></span></div></div></td><td>'+s.org+'</td><td><span class="statusPill" data-tone="'+(s.staffStatus==='active'?'success':'neutral')+'"><i></i>'+s.staffStatus+'</span></td><td><span class="statusPill" data-tone="'+accessTone+'"><i></i>'+(s.access==='none'?'not provisioned':s.access)+'</span><br><small>'+s.email+'</small></td><td>'+(s.roles||'No assignments')+'</td><td><span class="statusPill" data-tone="'+attentionTone+'"><i></i>'+s.attention+'</span></td></tr>'}
function detailHtml(s){if(!s)return '';return '<button class="peekBackdrop" aria-label="Close Staff detail backdrop"></button><aside class="peek" role="dialog" aria-label="'+s.name+' detail"><header class="peekHeader"><div><span>Workforce · Staff detail</span><h2>'+s.name+'</h2></div><button id="close" aria-label="Close Staff detail">×</button></header><div class="peekBody"><div class="staffGridPeek"><section class="panel"><div class="panelHeading"><div><h2>Operational profile</h2><p>'+s.org+'</p></div></div><div class="staffActions"><button class="primaryButton">Lưu hồ sơ</button><button class="secondaryButton">Deactivate Staff only</button></div></section><section class="panel" data-testid="staff-private-data-panel"><div class="panelHeading"><div><h2>Thông tin riêng tư</h2><p>CCCD & Bank · data loads only after explicit reveal.</p></div></div><div id="private"><span>•••• •••• ••••</span><button id="reveal" class="secondaryButton">Hiện thông tin riêng tư</button></div></section><section class="panel"><div class="panelHeading"><div><h2>Access</h2></div></div><button class="secondaryButton">Reset password</button><button class="secondaryButton">Mở TOS như Staff</button></section></div></div></aside>'}
function render(){const p=params();search.value=p.get('q')||'';staffStatus.value=p.get('f_staffStatus')||'active';accessStatus.value=p.get('f_accessStatus')||'all';const term=search.value.toLowerCase();const filtered=STAFF.filter(s=>(staffStatus.value==='all'||s.staffStatus===staffStatus.value)&&(accessStatus.value==='all'||s.access===accessStatus.value)&&(!term||(s.name+' '+s.org+' '+s.email+' '+s.roles).toLowerCase().includes(term)));document.querySelector('#result').textContent=filtered.length+' / '+STAFF.length+' staff';document.querySelector('#range').textContent=filtered.length?'1–'+filtered.length+' of '+filtered.length:'0–0 of 0';rows.innerHTML=filtered.map(rowHtml).join('');rows.querySelectorAll('tr').forEach(row=>row.addEventListener('click',e=>{if(e.target.closest('button'))return;const n=params();n.set('staff',row.dataset.id);commit(n,true)}));const selected=STAFF.find(s=>s.id===p.get('staff'));peek.innerHTML=detailHtml(selected);const close=document.querySelector('#close');if(close)close.addEventListener('click',()=>{const n=params();n.delete('staff');commit(n,false)});const reveal=document.querySelector('#reveal');if(reveal)reveal.addEventListener('click',()=>{document.querySelector('#private').innerHTML='<strong>Private data requested through bounded reveal</strong>'})}
search.addEventListener('input',()=>{const n=params();if(search.value)n.set('q',search.value);else n.delete('q');n.delete('page');commit(n,false)});staffStatus.addEventListener('change',()=>{const n=params();n.set('f_staffStatus',staffStatus.value);n.delete('page');commit(n,false)});accessStatus.addEventListener('change',()=>{const n=params();n.set('f_accessStatus',accessStatus.value);n.delete('page');commit(n,false)});window.addEventListener('popstate',render);render();
</script></body></html>`;
}

test("PAP-388 Founder/Manager Staff grid preserves browse context and bounded detail actions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap388.test/bo/staff**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap388.test/bo/staff?q=han%40example.test&f_staffStatus=active&f_accessStatus=all");
  for (const header of ["Staff", "Organization", "Staff status", "Access", "Roles / scopes", "Attention"]) await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  await expect(page.getByLabel("Tìm Staff, department, role, email…")).toHaveValue("han@example.test");
  await expect(page.getByText("1 / 4 staff")).toBeVisible();
  await page.getByRole("row", { name: /Trần Hân/ }).click();
  await expect(page).toHaveURL(/staff=staff-02/);
  await expect(page.getByRole("dialog", { name: "Trần Hân detail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu hồ sơ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset password" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở TOS như Staff" })).toBeVisible();
  await expect(page.getByText("•••• •••• ••••")).toBeVisible();
  await page.getByRole("button", { name: "Hiện thông tin riêng tư" }).click();
  await expect(page.getByText("Private data requested through bounded reveal")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Trần Hân detail" })).toBeVisible();
  await expect(page.getByText("•••• •••• ••••")).toBeVisible();
  await page.getByRole("button", { name: "Close Staff detail", exact: true }).click();
  await expect(page).not.toHaveURL(/staff=/);
  await expect(page).toHaveURL(/q=han%40example\.test/);
  await page.getByLabel("Tìm Staff, department, role, email…").fill("");
  await page.getByLabel("Filter Staff by access").selectOption("none");
  await expect(page).toHaveURL(/f_accessStatus=none/);
  await expect(page.getByText("1 / 4 staff")).toBeVisible();
  await expect(page.getByRole("row", { name: /Vy Phạm/ })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap388-staff-grid.png");
});
