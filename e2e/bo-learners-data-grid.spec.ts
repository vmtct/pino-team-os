import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const gridCss = readFileSync(resolve(process.cwd(), "app/bo/components/data-grid/bo-data-grid.module.css"), "utf8");
const learnerCss = readFileSync(resolve(process.cwd(), "app/bo/learners/bo-learners.module.css"), "utf8");

const students = [
  { id: "student-01", name: "Nguyễn Minh Anh", birth: "2020 · ~6 tuổi", path: "Art Foundation", active: true, member: true, attention: "Ổn" },
  { id: "student-02", name: "Trần Gia Hân", birth: "2019 · ~7 tuổi", path: "Piano Foundation", active: true, member: false, attention: "Ổn" },
  { id: "student-03", name: "Lê An", birth: "2021 · ~5 tuổi", path: "—", active: false, member: false, attention: "Cần setup" },
  { id: "student-04", name: "Phạm Minh Khang", birth: "2018 · ~8 tuổi", path: "Art Foundation · Piano Foundation", active: true, member: true, attention: "Ổn" },
];

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${gridCss}\n${learnerCss}\nbody{margin:0;background:#f5f4f7;font-family:Arial,sans-serif}.frame{padding:36px;max-width:1280px;margin:0 auto}.heading{margin-bottom:18px}.surface{margin-top:14px}</style></head><body><main class="frame">
  <header class="heading"><div><span>School · Student management</span><h1>Học viên</h1><p>Grid-first canonical Student directory.</p></div></header>
  <section class="surface">
    <div class="toolbar"><label class="searchBox"><span>⌕</span><input id="search" aria-label="Tìm học viên, chương trình, Student ID…" placeholder="Tìm học viên, chương trình, Student ID…"></label><span class="sortHint">↕ Sort</span><div class="toolbarSpacer"></div><span class="resultLabel" id="result"></span><label class="gridToolbarFilter">Learning<select id="learning" aria-label="Lọc học viên theo trạng thái học"><option value="active">Đang học</option><option value="inactive">Chưa active</option><option value="all">Tất cả</option></select></label></div>
    <div class="tableViewport"><table><caption>School Students directory</caption><thead><tr><th data-sticky="true">Học viên</th><th>Tuổi / sinh</th><th>Active Paths</th><th>Subscription / Class</th><th>House</th><th>Attention</th></tr></thead><tbody id="rows"></tbody></table></div>
    <footer class="pagination"><label>Rows per page<select aria-label="Rows per page"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></label><div class="paginationNav"><span id="range"></span><button disabled aria-label="Previous page">‹</button><button disabled aria-label="Next page">›</button></div></footer>
  </section>
  <div id="peek-root"></div>
</main><script>
const STUDENTS=${JSON.stringify(students)};
const search=document.querySelector('#search');
const learning=document.querySelector('#learning');
const rows=document.querySelector('#rows');
const peekRoot=document.querySelector('#peek-root');
function params(){return new URLSearchParams(location.search)}
function commit(next,push){const url=location.pathname+(next.toString()?'?'+next.toString():'');history[push?'pushState':'replaceState']({},'',url);render()}
function rowHtml(s){
  const initials=s.name.split(' ').slice(-2).map(x=>x[0]).join('');
  return '<tr tabindex="0" data-id="'+s.id+'" data-interactive="true"><td data-sticky="true"><div class="gridIdentity"><span class="avatarSmall">'+initials+'</span><div><strong>'+s.name+'</strong><span class="canonicalId"><code>'+s.id+'</code><button aria-label="Copy Student ID">⧉</button></span></div></div></td><td>'+s.birth+'</td><td>'+s.path+'</td><td><span class="statusPill" data-tone="'+(s.active?'success':'warning')+'"><i></i>'+(s.active?'Đang học':'Chưa active')+'</span></td><td><span class="statusPill" data-tone="'+(s.member?'info':'neutral')+'"><i></i>'+(s.member?'Member':'Non-member')+'</span></td><td><span class="statusPill" data-tone="'+(s.attention==='Ổn'?'success':'warning')+'"><i></i>'+s.attention+'</span></td></tr>';
}
function peekHtml(s){
  if(!s)return '';
  const initials=s.name.split(' ').slice(-2).map(x=>x[0]).join('');
  return '<button class="peekBackdrop" aria-label="Close detail backdrop"></button><aside class="peek" role="dialog" aria-label="'+s.name+' detail"><header class="peekHeader"><div><span>School · Student detail</span><h2>'+s.name+'</h2></div><button id="close" aria-label="Close detail">×</button></header><div class="peekBody"><div class="peekDetail"><section class="heroCard"><div class="heroIdentity"><span class="avatarLarge">'+initials+'</span><div><span class="eyebrow">Student profile</span><h2>'+s.name+'</h2><p>'+s.birth+'</p></div></div><div class="heroStatus"><span class="statusActive">'+(s.active?'Đang học':'Chưa active')+'</span></div></section><section class="sectionCard"><div class="sectionHeading"><div><span class="eyebrow">Current learning</span><h3>Chương trình đang học</h3></div></div><div>'+s.path+'</div></section></div></div></aside>';
}
function render(){
  const p=params();
  search.value=p.get('q')||'';
  learning.value=p.get('f_learning')||'active';
  const term=search.value.trim().toLowerCase();
  const mode=learning.value;
  const filtered=STUDENTS.filter(s=>(mode==='all'||(mode==='active'?s.active:!s.active))&&(!term||(s.name+' '+s.id+' '+s.path).toLowerCase().includes(term)));
  document.querySelector('#result').textContent=filtered.length+' / '+STUDENTS.length+' học viên';
  document.querySelector('#range').textContent=filtered.length?'1–'+filtered.length+' of '+filtered.length:'0–0 of 0';
  rows.innerHTML=filtered.map(rowHtml).join('');
  rows.querySelectorAll('tr').forEach(row=>row.addEventListener('click',e=>{if(e.target.closest('button'))return;const n=params();n.set('student',row.dataset.id);commit(n,true)}));
  const selected=STUDENTS.find(s=>s.id===p.get('student'));
  peekRoot.innerHTML=peekHtml(selected);
  const close=document.querySelector('#close');
  if(close)close.addEventListener('click',()=>{const n=params();n.delete('student');commit(n,false)});
}
search.addEventListener('input',()=>{const n=params();if(search.value)n.set('q',search.value);else n.delete('q');n.delete('page');commit(n,false)});
learning.addEventListener('change',()=>{const n=params();n.set('f_learning',learning.value);n.delete('page');commit(n,false)});
window.addEventListener('popstate',render);
render();
</script></body></html>`;
}

test("PAP-387 Students grid preserves browse/filter and side-peek URL context", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("https://pap387.test/bo/learners**", async (route) => route.fulfill({ status: 200, contentType: "text/html", body: fixture() }));
  await page.goto("https://pap387.test/bo/learners?q=minh&f_learning=active");
  for (const header of ["Học viên", "Tuổi / sinh", "Active Paths", "Subscription / Class", "House", "Attention"]) await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
  await expect(page.getByLabel("Tìm học viên, chương trình, Student ID…")).toHaveValue("minh");
  await expect(page.getByLabel("Lọc học viên theo trạng thái học")).toHaveValue("active");
  await expect(page.getByText("2 / 4 học viên")).toBeVisible();

  await page.getByRole("row", { name: /Nguyễn Minh Anh/ }).click();
  await expect(page).toHaveURL(/student=student-01/);
  await expect(page.getByRole("dialog", { name: "Nguyễn Minh Anh detail" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Nguyễn Minh Anh detail" })).toBeVisible();
  await expect(page.getByLabel("Tìm học viên, chương trình, Student ID…")).toHaveValue("minh");

  await page.getByRole("button", { name: "Close detail", exact: true }).click();
  await expect(page).not.toHaveURL(/student=/);
  await expect(page).toHaveURL(/q=minh/);
  await expect(page).toHaveURL(/f_learning=active/);

  await page.getByRole("row", { name: /Phạm Minh Khang/ }).click();
  await expect(page).toHaveURL(/student=student-04/);
  await page.goBack();
  await expect(page).not.toHaveURL(/student=/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByLabel("Tìm học viên, chương trình, Student ID…").fill("");
  await expect(page).not.toHaveURL(/q=/);
  await page.getByLabel("Lọc học viên theo trạng thái học").selectOption("inactive");
  await expect(page).toHaveURL(/f_learning=inactive/);
  await expect(page.getByText("1 / 4 học viên")).toBeVisible();
  await expect(page.locator(".surface")).toHaveScreenshot("pap387-students-grid.png");
});
