import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss=readFileSync(resolve(process.cwd(),"app/bo/components/data-grid/bo-data-grid.module.css"),"utf8");
const boCss=readFileSync(resolve(process.cwd(),"app/bo/bo.module.css"),"utf8");
const rows=[
  {id:"11111111-1111-4111-8111-111111111111",purpose:"Create October operating term",status:"PENDING_APPROVAL",ops:2,destructive:0,targets:"terms ×1, term_weeks ×1",submitted:"11/10/2026 18:10",updated:"11/10/2026 18:12",hash:"aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000"},
  {id:"22222222-2222-4222-8222-222222222222",purpose:"Reconcile November term",status:"OUTCOME_UNKNOWN",ops:1,destructive:0,targets:"terms ×1",submitted:"11/10/2026 17:10",updated:"11/10/2026 18:01",hash:"bbbbccccddddeeeeffff1111222233334444555566667777888899990000aaaa"},
  {id:"33333333-3333-4333-8333-333333333333",purpose:"Applied September term",status:"APPLIED",ops:1,destructive:0,targets:"terms ×1",submitted:"10/10/2026 09:00",updated:"10/10/2026 09:05",hash:"ccccddddeeeeffff1111222233334444555566667777888899990000aaaabbbb"},
];

function fixture(){return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${boCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1380px;margin:0 auto}.toolbar{margin-top:18px}.peek pre{white-space:pre-wrap}</style></head><body><main class="frame"><header><span>PINO TEAM · SYSTEM</span><h1>AI Data Inbox</h1><p>Founder exact-plan review · create-only proposals.</p></header><section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Search purpose, Change Set ID, plan hash or destination…"></label><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><label class="gridToolbarFilter">Review state<select id="status" aria-label="Filter AI Data Change Sets by review state"><option value="">All</option><option value="PENDING_APPROVAL">Pending approval</option><option value="NEEDS_RECONCILE">Needs reconcile</option><option value="APPLIED">Applied</option><option value="REJECTED">Rejected</option></select></label></div><div class="tableViewport"><table><caption>AI Data Change Set review inbox</caption><thead><tr><th>Change Set</th><th>Status</th><th>Operations</th><th>Destructive</th><th>Submitted</th><th>Updated</th><th>Plan hash</th></tr></thead><tbody id="rows"></tbody></table></div></section><div id="peek"></div></main><script>
const DATA=${JSON.stringify(rows)};const search=document.querySelector('#search'),status=document.querySelector('#status'),tbody=document.querySelector('#rows'),peek=document.querySelector('#peek');
function params(){return new URLSearchParams(location.search)}function commit(n,push){history[push?'pushState':'replaceState']({},'',location.pathname+(n.toString()?'?'+n.toString():''));render()}
function reviewMatch(r,v){return !v||(v==='NEEDS_RECONCILE'?(r.status==='APPLYING'||r.status==='OUTCOME_UNKNOWN'):r.status===v)}
function render(){const p=params();search.value=p.get('q')||'';status.value=p.get('f_status')||'';const q=search.value.toLowerCase();const filtered=DATA.filter(r=>reviewMatch(r,status.value)&&(!q||(r.id+' '+r.purpose+' '+r.hash+' '+r.targets).toLowerCase().includes(q)));document.querySelector('#result').textContent=filtered.length+' Change Sets';tbody.innerHTML=filtered.map(r=>'<tr tabindex="0" data-id="'+r.id+'"><td><strong>'+r.purpose+'</strong><br><code>'+r.id+'</code></td><td>'+r.status.replaceAll('_',' ')+'</td><td>'+r.ops+' creates<br><small>'+r.targets+'</small></td><td>CREATE ONLY</td><td>'+r.submitted+'</td><td>'+r.updated+'</td><td><code>'+r.hash.slice(0,16)+'…</code></td></tr>').join('');tbody.querySelectorAll('tr').forEach(tr=>tr.onclick=()=>{const n=params();n.set('changeSet',tr.dataset.id);commit(n,true)});const r=DATA.find(x=>x.id===p.get('changeSet'));peek.innerHTML=r?'<button class="peekBackdrop" aria-label="Close detail"></button><aside class="peek" role="dialog" aria-label="'+r.purpose+' detail"><header class="peekHeader"><div><span>System · Founder review</span><h2>'+r.purpose+'</h2></div><button id="close">×</button></header><div class="peekBody"><div><strong>Plan hash — approval binds to this exact payload</strong><code>'+r.hash+'</code></div><pre>{"op":"create","target":"terms"}</pre></div>'+(r.status==='PENDING_APPROVAL'?'<footer class="peekFooter"><button id="approve">Approve & Apply</button></footer>':'')+'</aside>':'';const close=document.querySelector('#close');if(close)close.onclick=()=>{const n=params();n.delete('changeSet');commit(n,false)}}
search.oninput=()=>{const n=params();search.value?n.set('q',search.value):n.delete('q');commit(n,false)};status.onchange=()=>{const n=params();status.value?n.set('f_status',status.value):n.delete('f_status');commit(n,false)};window.addEventListener('popstate',render);render();
</script></body></html>`}

test("PAP-410 Founder AI Data grid supports browse, review filter and exact-plan detail",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.route("https://pap410.test/bo/system/ai-data**",route=>route.fulfill({status:200,contentType:"text/html",body:fixture()}));
  await page.goto("https://pap410.test/bo/system/ai-data?f_status=PENDING_APPROVAL");
  await expect(page.getByLabel("Filter AI Data Change Sets by review state")).toHaveValue("PENDING_APPROVAL");
  await expect(page.getByText("1 Change Sets")).toBeVisible();
  await page.getByRole("row",{name:/Create October operating term/}).click();
  await expect(page).toHaveURL(/changeSet=11111111/);
  await expect(page.getByRole("dialog",{name:/Create October operating term detail/})).toContainText("Plan hash — approval binds to this exact payload");
  await expect(page.getByRole("button",{name:"Approve & Apply"})).toBeVisible();
  await page.locator('#close').click();
  await page.getByLabel("Filter AI Data Change Sets by review state").selectOption("NEEDS_RECONCILE");
  await expect(page.getByRole("row",{name:/Reconcile November term/})).toBeVisible();
  await expect(page.getByText("1 Change Sets")).toBeVisible();
  await page.getByLabel("Search purpose, Change Set ID, plan hash or destination…").fill("november");
  await expect(page.getByRole("row",{name:/Reconcile November term/})).toBeVisible();
});
