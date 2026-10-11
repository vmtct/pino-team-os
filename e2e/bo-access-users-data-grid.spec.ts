import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const boCss = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");
const users = [
  { id: "user-01", email: "founder@pino.test", staff: "staff-01", status: "active", roles: ["Founder · GLOBAL"], authority: "Current actor" },
  { id: "user-02", email: "mentor@pino.test", staff: "staff-02", status: "active", roles: ["Teacher · CENTER"], authority: "Standard" },
  { id: "user-03", email: "ops@pino.test", staff: "staff-03", status: "suspended", roles: ["Manager · GLOBAL"], authority: "Standard" },
  { id: "user-04", email: "invite@pino.test", staff: "", status: "active", roles: [], authority: "Standard" },
];

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${boCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1280px;margin:0 auto}.surface{margin-top:14px}</style></head><body><main class="frame">
  <header class="heading"><span>PINO TEAM · SYSTEM</span><h1>Users</h1><p>Canonical Access Users directory.</p></header>
  <section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Tìm email, User ID, Staff ID, role hoặc scope…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><label class="gridToolbarFilter">Status<select id="status" aria-label="Filter Access Users by status"><option value="all">All</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label></div>
  <div class="tableViewport"><table><caption>Access Users directory</caption><thead><tr><th>Account</th><th>Staff link</th><th>Account state</th><th>Roles / scopes</th><th>Authority</th></tr></thead><tbody id="rows"></tbody></table></div><footer class="pagination"><label>Rows per page<select><option selected>25</option></select></label><div class="paginationNav"><span id="range"></span></div></footer></section><div id="peek"></div></main><script>
  const USERS=${JSON.stringify(users)}; const search=document.querySelector('#search'), status=document.querySelector('#status'), rows=document.querySelector('#rows'), peek=document.querySelector('#peek');
  function params(){return new URLSearchParams(location.search)}
  function commit(next,push){const u=location.pathname+(next.toString()?'?'+next.toString():'');history[push?'pushState':'replaceState']({},'',u);render()}
  function rowHtml(u){return '<tr tabindex="0" data-id="'+u.id+'" data-interactive="true"><td><strong>'+u.email+'</strong><br><code>'+u.id+'</code></td><td>'+(u.staff||'Not linked')+'</td><td><span class="statusPill" data-tone="'+(u.status==='active'?'success':'warning')+'"><i></i>'+u.status+'</span></td><td>'+((u.roles||[]).join(', ')||'No assignments')+'</td><td>'+u.authority+'</td></tr>'}
  function detailHtml(u){if(!u)return '';const self=u.id==='user-01';return '<button class="peekBackdrop" aria-label="Close detail"></button><aside class="peek" role="dialog" aria-label="'+u.email+' detail"><header class="peekHeader"><div><span>System · Access User</span><h2>'+u.email+'</h2></div><button id="close" aria-label="Close detail">×</button></header><div class="peekBody"><section class="panel"><h2>Account</h2><p>'+u.status+' · Staff '+(u.staff||'Not linked')+'</p>'+(self?'<p class="staffWarning">Self-management is blocked.</p>':'<button id="statusAction" class="secondaryButton">'+(u.status==='active'?'Suspend':'Reactivate')+'</button>')+'</section><section class="panel"><h2>Role assignments</h2><div id="assignments">'+((u.roles||[]).map((r,i)=>'<div class="staffAssignmentCard"><strong>'+r+'</strong>'+(self?'':'<button class="secondaryButton remove" data-index="'+i+'">Remove</button>')+'</div>').join('')||'<p>No assignments</p>')+'</div></section><section class="panel"><h2>Assign role</h2><label class="field">Role<select id="role"><option value="">Select role…</option><option value="manager">Manager</option><option value="teacher">Teacher</option></select></label><label class="field">Scope<select id="scope"><option>GLOBAL</option><option>CENTER</option></select></label><button id="assign" class="primaryButton" '+(self?'disabled':'disabled')+'>Assign</button></section></div></aside>'}
  function render(){const p=params();search.value=p.get('q')||'';status.value=p.get('f_status')||'all';const term=search.value.toLowerCase();const filtered=USERS.filter(u=>(status.value==='all'||u.status===status.value)&&(!term||(u.email+' '+u.id+' '+u.staff+' '+u.roles.join(' ')).toLowerCase().includes(term)));document.querySelector('#result').textContent=filtered.length+' / '+USERS.length+' users';document.querySelector('#range').textContent=filtered.length?'1–'+filtered.length+' of '+filtered.length:'0–0 of 0';rows.innerHTML=filtered.map(rowHtml).join('');rows.querySelectorAll('tr').forEach(row=>row.addEventListener('click',()=>{const n=params();n.set('accessUser',row.dataset.id);commit(n,true)}));const selected=USERS.find(u=>u.id===p.get('accessUser'));peek.innerHTML=detailHtml(selected);const close=document.querySelector('#close');if(close)close.addEventListener('click',()=>{const n=params();n.delete('accessUser');commit(n,false)});const role=document.querySelector('#role'),assign=document.querySelector('#assign');if(role&&assign){role.addEventListener('change',()=>{assign.disabled=!role.value||selected?.id==='user-01'});assign.addEventListener('click',()=>{document.querySelector('#assignments').insertAdjacentHTML('beforeend','<div class="staffAssignmentCard"><strong>Manager · GLOBAL</strong><button class="secondaryButton remove">Remove</button></div>')})}}
  search.addEventListener('input',()=>{const n=params();if(search.value)n.set('q',search.value);else n.delete('q');commit(n,false)});status.addEventListener('change',()=>{const n=params();if(status.value==='all')n.delete('f_status');else n.set('f_status',status.value);commit(n,false)});window.addEventListener('popstate',render);render();
  </script></body></html>`;
}

test("PAP-389 Founder Access Users grid preserves browse context and bounded role controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap389.test/bo/system/users**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap389.test/bo/system/users?q=mentor%40pino.test&f_status=active");
  for (const header of ["Account", "Staff link", "Account state", "Roles / scopes", "Authority"]) await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  await expect(page.getByText("1 / 4 users")).toBeVisible();
  await page.getByRole("row", { name: /mentor@pino.test/ }).click();
  await expect(page).toHaveURL(/accessUser=user-02/);
  await expect(page.getByRole("dialog", { name: "mentor@pino.test detail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend" })).toBeVisible();
  await page.locator("#role").selectOption("manager");
  await expect(page.getByRole("button", { name: "Assign" })).toBeEnabled();
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByText("Manager · GLOBAL")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "mentor@pino.test detail" })).toBeVisible();
  await expect(page.getByLabel("Tìm email, User ID, Staff ID, role hoặc scope…")).toHaveValue("mentor@pino.test");
  await page.locator("#close").click();
  await expect(page).not.toHaveURL(/accessUser=/);
  await expect(page).toHaveURL(/q=mentor%40pino.test/);
  await page.getByLabel("Tìm email, User ID, Staff ID, role hoặc scope…").fill("");
  await page.getByLabel("Filter Access Users by status").selectOption("suspended");
  await expect(page.getByText("1 / 4 users")).toBeVisible();
  await expect(page.getByRole("row", { name: /ops@pino.test/ })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap389-access-users-grid.png");
});
