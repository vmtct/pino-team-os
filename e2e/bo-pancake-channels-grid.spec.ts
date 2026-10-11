import { expect, test } from "@playwright/test";

const rows=[
  {id:"11111111-1111-4111-8111-111111111111",pageId:"fb-page-main",name:"PINO Main",provider:"FACEBOOK",enabled:true,discovery:"Auto-discovered",lastSeen:"11/10/2026 20:00"},
  {id:"22222222-2222-4222-8222-222222222222",pageId:"fb-page-camp",name:"PINO Camp",provider:"FACEBOOK",enabled:false,discovery:"Manual",lastSeen:"11/10/2026 19:00"},
];
function fixture(){return `<!doctype html><html><head><meta charset="utf-8"></head><body><main><h1>Pancake</h1><label>Status<select id="status" aria-label="Filter Pancake Channels by operational status"><option value="">All</option><option value="ENABLED">Enabled</option><option value="DISABLED">Disabled</option></select></label><input id="search" aria-label="Search page_id, display name or provider…"><div id="result"></div><table><caption>Pancake Channels inventory</caption><tbody id="rows"></tbody></table><div id="peek"></div></main><script>
const DATA=${JSON.stringify(rows)};const status=document.querySelector('#status'),search=document.querySelector('#search'),tbody=document.querySelector('#rows'),peek=document.querySelector('#peek');
function params(){return new URLSearchParams(location.search)}function commit(p,push=false){history[push?'pushState':'replaceState']({},'',location.pathname+(p.toString()?'?'+p.toString():''));render()}
function render(){const p=params();status.value=p.get('f_status')||'';search.value=p.get('q')||'';const q=search.value.toLowerCase();const filtered=DATA.filter(r=>(!status.value||(status.value==='ENABLED'?r.enabled:!r.enabled))&&(!q||(r.pageId+' '+r.name+' '+r.provider).toLowerCase().includes(q)));document.querySelector('#result').textContent=filtered.length+' channels';tbody.innerHTML=filtered.map(r=>'<tr tabindex="0" data-id="'+r.id+'"><td><strong>'+r.name+'</strong><br><code>'+r.pageId+'</code></td><td>'+(r.enabled?'ENABLED':'DISABLED')+'</td><td>'+r.provider+'</td><td>'+r.discovery+'</td><td>'+r.lastSeen+'</td></tr>').join('');tbody.querySelectorAll('tr').forEach(tr=>tr.onclick=()=>{const n=params();n.set('pancakeChannel',tr.dataset.id);commit(n,true)});const selected=DATA.find(r=>r.id===p.get('pancakeChannel'));peek.innerHTML=selected?'<aside role="dialog" aria-label="'+selected.name+' detail"><h2>'+selected.name+'</h2><div>Provider page_id <code>'+selected.pageId+'</code></div><label>Display name<input value="'+selected.name+'"></label><label><input type="checkbox" '+(selected.enabled?'checked':'')+'> Enabled</label><button>Save channel</button><button id="close">Close</button></aside>':'';const close=document.querySelector('#close');if(close)close.onclick=()=>{const n=params();n.delete('pancakeChannel');commit(n)}}
status.onchange=()=>{const n=params();status.value?n.set('f_status',status.value):n.delete('f_status');commit(n)};search.oninput=()=>{const n=params();search.value?n.set('q',search.value):n.delete('q');commit(n)};window.addEventListener('popstate',render);render();
</script></body></html>`}

test("PAP-411 Pancake Channels grid preserves provider page_id and bounded detail",async({page})=>{
  await page.route("https://pap411.test/bo/system/pancake**",route=>route.fulfill({status:200,contentType:"text/html",body:fixture()}));
  await page.goto("https://pap411.test/bo/system/pancake?f_status=DISABLED");
  await expect(page.getByLabel("Filter Pancake Channels by operational status")).toHaveValue("DISABLED");
  await expect(page.getByText("1 channels")).toBeVisible();
  await page.getByRole("row",{name:/PINO Camp/}).click();
  await expect(page).toHaveURL(/pancakeChannel=22222222/);
  const dialog=page.getByRole("dialog",{name:"PINO Camp detail"});
  await expect(dialog).toContainText("fb-page-camp");
  await expect(dialog.getByRole("button",{name:"Save channel"})).toBeVisible();
  await dialog.getByRole("button",{name:"Close"}).click();
  await page.getByLabel("Filter Pancake Channels by operational status").selectOption("");
  await page.getByLabel("Search page_id, display name or provider…").fill("fb-page-main");
  await expect(page.getByRole("row",{name:/PINO Main/})).toBeVisible();
  await expect(page.getByRole("row",{name:/PINO Camp/})).toHaveCount(0);
});
