import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const boCss = readFileSync(resolve(process.cwd(), "app/bo/bo.module.css"), "utf8");
const rows = [
  { id:"training-01", staff:"Nguyễn Hằng", staffId:"staff-01", training:"Classroom Diary", module:"classroom-diary", version:2, status:"COMPLETION_PENDING", assessment:"Passed · 92", signoff:"Pending", assigned:"10/10/2026", updated:"11/10/2026" },
  { id:"training-02", staff:"Vy Phạm", staffId:"staff-02", training:"Studio Safety", module:"studio-safety", version:1, status:"IN_PROGRESS", assessment:"Not attempted", signoff:"Required", assigned:"08/10/2026", updated:"10/10/2026" },
  { id:"training-03", staff:"Bảo Nguyễn", staffId:"staff-03", training:"Piano Closing", module:"piano-closing", version:3, status:"COMPLETED", assessment:"Passed · 88", signoff:"Signed off", assigned:"01/10/2026", updated:"09/10/2026" },
];

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${boCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1360px;margin:0 auto}.heading{margin-bottom:18px}.surface{margin-top:14px}</style></head><body><main class="frame">
<header class="heading"><span>PINO TEAM · WORKFORCE</span><h1>Training assignments</h1><p>Grid-first assignment/sign-off browse. Module authoring remains a separate workflow; Core remains the only Training mutation authority.</p><a id="builder" href="/bo/training/builder">Open Training Builder</a></header>
<section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Search Staff, training, module key or Assignment ID…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><label class="gridToolbarFilter">Status<select id="status" aria-label="Filter Training assignments by status"><option value="">All</option><option value="ASSIGNED">Assigned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETION_PENDING">Completion pending</option><option value="COMPLETED">Completed</option></select></label></div>
<div class="tableViewport"><table><caption>Training assignments and sign-off records</caption><thead><tr><th data-sticky="true">Staff</th><th>Training / version</th><th>Assignment</th><th>Assessment</th><th>Sign-off</th><th>Assigned</th><th>Updated</th></tr></thead><tbody id="rows"></tbody></table></div><footer class="pagination"><label>Rows per page<select><option>10</option><option selected>25</option></select></label><div class="paginationNav"><span id="range"></span><button disabled>‹</button><button disabled>›</button></div></footer></section><div id="peek"></div></main><script>
const DATA=${JSON.stringify(rows)};const search=document.querySelector('#search'),status=document.querySelector('#status'),body=document.querySelector('#rows'),peek=document.querySelector('#peek');
function params(){return new URLSearchParams(location.search)}function commit(n,push){history[push?'pushState':'replaceState']({},'',location.pathname+(n.toString()?'?'+n.toString():''));render()}
function pill(v,t){return '<span class="statusPill" data-tone="'+t+'"><i></i>'+v.replaceAll('_',' ')+'</span>'}function tone(v){return v==='COMPLETED'?'success':v==='COMPLETION_PENDING'?'warning':v==='IN_PROGRESS'?'info':'neutral'}
function render(){const p=params();search.value=p.get('q')||'';status.value=p.get('f_status')||'';const term=search.value.toLowerCase();const filtered=DATA.filter(r=>(!status.value||r.status===status.value)&&(!term||(r.staff+' '+r.training+' '+r.module+' '+r.id).toLowerCase().includes(term)));document.querySelector('#result').textContent=filtered.length+' assignments';document.querySelector('#range').textContent=filtered.length?'1–'+filtered.length+' of '+filtered.length:'0–0 of 0';body.innerHTML=filtered.map(r=>'<tr tabindex="0" data-id="'+r.id+'" data-interactive="true"><td data-sticky="true"><strong>'+r.staff+'</strong><br><code>'+r.staffId+'</code></td><td><strong>'+r.training+'</strong><br><small>'+r.module+' · v'+r.version+'</small></td><td>'+pill(r.status,tone(r.status))+'</td><td>'+r.assessment+'</td><td>'+pill(r.signoff,r.signoff==='Signed off'?'success':r.signoff==='Pending'?'warning':'neutral')+'</td><td>'+r.assigned+'</td><td>'+r.updated+'</td></tr>').join('');body.querySelectorAll('tr').forEach(tr=>tr.onclick=()=>{const n=params();n.set('trainingAssignment',tr.dataset.id);commit(n,true)});const r=DATA.find(x=>x.id===p.get('trainingAssignment'));peek.innerHTML=r?'<button class="peekBackdrop" aria-label="Close detail"></button><aside class="peek" role="dialog" aria-label="'+r.staff+' detail"><header class="peekHeader"><div><span>Workforce · Training assignment</span><h2>'+r.staff+'</h2></div><button id="close" aria-label="Close detail">×</button></header><div class="peekBody"><section class="panel"><h2>'+r.training+'</h2><p>'+r.module+' · version '+r.version+'</p>'+pill(r.status,tone(r.status))+'<dl class="auditDetailList"><div><dt>Assignment ID</dt><dd>'+r.id+'</dd></div><div><dt>Assessment</dt><dd>'+r.assessment+'</dd></div><div><dt>Sign-off</dt><dd>'+r.signoff+'</dd></div></dl></section><section class="panel"><h2>Authority boundary</h2><p>Browse state is presentation only. Assignment and sign-off commands remain Core-authorized and idempotent.</p></section></div>'+(r.status==='COMPLETION_PENDING'?'<footer class="peekFooter"><button id="signoff">Sign off</button></footer>':'')+'</aside>':'';const close=document.querySelector('#close');if(close)close.onclick=()=>{const n=params();n.delete('trainingAssignment');commit(n,false)};const signoff=document.querySelector('#signoff');if(signoff)signoff.onclick=()=>{signoff.textContent='Signing off…';signoff.disabled=true}}
search.oninput=()=>{const n=params();search.value?n.set('q',search.value):n.delete('q');n.delete('page');commit(n,false)};status.onchange=()=>{const n=params();status.value?n.set('f_status',status.value):n.delete('f_status');n.delete('page');commit(n,false)};window.addEventListener('popstate',render);render();
</script></body></html>`;
}

test("PAP-409 Founder/Manager Training grid preserves bounded browse, detail and separate authoring", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap409.test/bo/training**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap409.test/bo/training?f_status=COMPLETION_PENDING");
  for (const header of ["Staff","Training / version","Assignment","Assessment","Sign-off","Assigned","Updated"]) await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  await expect(page.getByLabel("Filter Training assignments by status")).toHaveValue("COMPLETION_PENDING");
  await expect(page.getByText("1 assignments")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Training Builder" })).toHaveAttribute("href", "/bo/training/builder");
  await page.getByRole("row", { name: /Nguyễn Hằng/ }).click();
  await expect(page).toHaveURL(/trainingAssignment=training-01/);
  await expect(page.getByRole("dialog", { name: "Nguyễn Hằng detail" })).toBeVisible();
  await expect(page.getByText("Browse state is presentation only. Assignment and sign-off commands remain Core-authorized and idempotent.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign off" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Nguyễn Hằng detail" })).toBeVisible();
  await page.locator("#close").click();
  await expect(page).not.toHaveURL(/trainingAssignment=/);
  await expect(page).toHaveURL(/f_status=COMPLETION_PENDING/);
  await page.getByLabel("Filter Training assignments by status").selectOption("");
  await page.getByLabel("Search Staff, training, module key or Assignment ID…").fill("piano");
  await expect(page).toHaveURL(/q=piano/);
  await expect(page.getByRole("row", { name: /Bảo Nguyễn/ })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap409-training-grid.png");
});
