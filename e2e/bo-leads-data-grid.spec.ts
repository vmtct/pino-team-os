import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const leadCss = readFileSync(resolve(process.cwd(), "app/bo/sales/leads/sales-leads.module.css"), "utf8");
const leads = [
  { id: "intent-01", leadId: "lead-01", phone: "0901000001", source: "PINO House", surface: "STAFF", intent: "Tư vấn chung", age: 8, status: "SUBMITTED", updated: "11/10/2026 09:00" },
  { id: "intent-02", leadId: "lead-02", phone: "0902000002", source: "Toppi", surface: "TOPPI_WEB", intent: "Quan tâm chương trình", age: 10, status: "CONTACTED", updated: "11/10/2026 08:30" },
  { id: "intent-03", leadId: "lead-03", phone: "0903000003", source: "PINO House", surface: "PINO_HOUSE_WEB", intent: "Open Studio", age: 7, status: "CONTACT_VERIFIED", updated: "11/10/2026 08:00" },
  { id: "intent-04", leadId: "lead-04", phone: "0904000004", source: "PINO House", surface: "STAFF", intent: "Tư vấn chung", age: null, status: "CLOSED", updated: "10/10/2026 20:00" },
];
const label = { SUBMITTED: "Mới", CONTACTED: "Đã liên hệ", CONTACT_VERIFIED: "Đã xác minh", CLOSED: "Đã đóng" };

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${leadCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1280px;margin:0 auto}.surface{margin-top:14px}</style></head><body><main class="frame">
  <header class="heading"><div><span>Sales · PLT-LEAD F1</span><h1>Lead pipeline</h1><p>Canonical Acquisition Lead/Intent.</p></div></header>
  <section class="surface"><div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Tìm số điện thoại, nguồn, nhu cầu, ID…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span id="result" class="resultLabel"></span><label class="leadGridFilter">Lifecycle<select id="status" aria-label="Filter Leads by lifecycle"><option value="ALL">Tất cả</option><option value="SUBMITTED">Mới</option><option value="CONTACTED">Đã liên hệ</option><option value="CONTACT_VERIFIED">Đã xác minh</option><option value="CLOSED">Đã đóng</option></select></label></div>
  <div class="tableViewport"><table><caption>Lead intents</caption><thead><tr><th>Lead / contact</th><th>Source</th><th>Intent / age</th><th>Lifecycle</th><th>Updated</th></tr></thead><tbody id="rows"></tbody></table></div><footer class="pagination"><label>Rows per page<select><option selected>25</option></select></label><div class="paginationNav"><span id="range"></span></div></footer></section><div id="peek"></div></main><script>
  const LEADS=${JSON.stringify(leads)}, LABEL=${JSON.stringify(label)}; const search=document.querySelector('#search'), status=document.querySelector('#status'), rows=document.querySelector('#rows'), peek=document.querySelector('#peek');
  function params(){return new URLSearchParams(location.search)}
  function commit(next,push){const u=location.pathname+(next.toString()?'?'+next.toString():'');history[push?'pushState':'replaceState']({},'',u);render()}
  function tone(s){return s==='SUBMITTED'?'warning':s==='CONTACTED'?'info':s==='CONTACT_VERIFIED'?'success':'neutral'}
  function rowHtml(l){return '<tr tabindex="0" data-id="'+l.id+'" data-interactive="true"><td><strong>'+l.phone+'</strong><br><code>'+l.id+'</code></td><td><strong>'+l.source+'</strong><br><small>'+l.surface+'</small></td><td><strong>'+l.intent+'</strong><br><small>'+(l.age===null?'Age —':'Age '+l.age)+'</small></td><td><span class="statusPill" data-tone="'+tone(l.status)+'"><i></i>'+LABEL[l.status]+'</span></td><td>'+l.updated+'</td></tr>'}
  function detailHtml(l){if(!l)return '';return '<button class="peekBackdrop" aria-label="Close Lead detail backdrop"></button><aside class="peek" role="dialog" aria-label="'+l.phone+' detail"><header class="peekHeader"><div><span>Sales · Lead Intent</span><h2>'+l.phone+'</h2></div><button id="close" aria-label="Close Lead detail">×</button></header><div class="peekBody"><div class="detail"><div class="detailHead"><div><span>Lead</span><h2>'+l.phone+'</h2></div><span id="detailStatus" class="status">'+LABEL[l.status]+'</span></div><div class="facts"><div><span>Nguồn</span><strong>'+l.source+' · '+l.surface+'</strong></div><div><span>Nhu cầu</span><strong>'+l.intent+'</strong></div><div><span>Tuổi bé</span><strong>'+(l.age??'—')+'</strong></div><div><span>Lead ID</span><strong>'+l.leadId+'</strong></div></div><div class="pancakePanel"><div><strong>Pancake</strong><span>Provider reference + deep link only.</span></div><div class="pancakeConversation"><div><strong>PINO Facebook</strong><span>FACEBOOK · conv-01</span></div><a href="https://pancake.vn/conv-01" target="_blank" rel="noopener noreferrer">Chat trên Pancake ↗</a></div></div><div class="actions"><div><strong>Lifecycle actions</strong><span>expectedVersion và transition rules do Core quyết định.</span></div><div class="actionButtons">'+(l.status==='SUBMITTED'?'<button id="contacted">Đã liên hệ</button>':'')+((l.status==='SUBMITTED'||l.status==='CONTACTED')?'<button id="verify">Xác minh Zalo</button>':'')+'</div><div id="notice"></div></div></div></div></aside>'}
  function render(){const p=params();search.value=p.get('q')||'';status.value=p.get('f_status')||'ALL';const term=search.value.toLowerCase();const filtered=LEADS.filter(l=>(status.value==='ALL'||l.status===status.value)&&(!term||(l.phone+' '+l.id+' '+l.leadId+' '+l.source+' '+l.intent).toLowerCase().includes(term)));document.querySelector('#result').textContent=filtered.length+' / '+LEADS.length+' intents';document.querySelector('#range').textContent=filtered.length?'1–'+filtered.length+' of '+filtered.length:'0–0 of 0';rows.innerHTML=filtered.map(rowHtml).join('');rows.querySelectorAll('tr').forEach(row=>row.addEventListener('click',()=>{const n=params();n.set('leadIntent',row.dataset.id);commit(n,true)}));const selected=LEADS.find(l=>l.id===p.get('leadIntent'));peek.innerHTML=detailHtml(selected);const close=document.querySelector('#close');if(close)close.addEventListener('click',()=>{const n=params();n.delete('leadIntent');commit(n,false)});const contacted=document.querySelector('#contacted');if(contacted)contacted.addEventListener('click',()=>{document.querySelector('#detailStatus').textContent='Đã liên hệ';document.querySelector('#notice').textContent='Đã đánh dấu liên hệ.'})}
  search.addEventListener('input',()=>{const n=params();if(search.value)n.set('q',search.value);else n.delete('q');commit(n,false)});status.addEventListener('change',()=>{const n=params();if(status.value==='ALL')n.delete('f_status');else n.set('f_status',status.value);commit(n,false)});window.addEventListener('popstate',render);render();
  </script></body></html>`;
}

test("PAP-390 Founder/Manager Lead grid preserves browse context and bounded lifecycle detail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap390.test/bo/sales/leads**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap390.test/bo/sales/leads?q=0901000001&f_status=SUBMITTED");
  for (const header of ["Lead / contact", "Source", "Intent / age", "Lifecycle", "Updated"]) await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  await expect(page.getByText("1 / 4 intents")).toBeVisible();
  await page.getByRole("row", { name: /0901000001/ }).click();
  await expect(page).toHaveURL(/leadIntent=intent-01/);
  await expect(page.getByRole("dialog", { name: "0901000001 detail" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chat trên Pancake/ })).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Đã liên hệ" }).click();
  await expect(page.getByText("Đã đánh dấu liên hệ.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "0901000001 detail" })).toBeVisible();
  await expect(page.getByLabel("Tìm số điện thoại, nguồn, nhu cầu, ID…")).toHaveValue("0901000001");
  await page.locator("#close").click();
  await expect(page).not.toHaveURL(/leadIntent=/);
  await expect(page).toHaveURL(/q=0901000001/);
  await page.getByLabel("Tìm số điện thoại, nguồn, nhu cầu, ID…").fill("");
  await page.getByLabel("Filter Leads by lifecycle").selectOption("CONTACTED");
  await expect(page.getByText("1 / 4 intents")).toBeVisible();
  await expect(page.getByRole("row", { name: /0902000002/ })).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap390-leads-grid.png");
});
