import {expect,test,type Page} from "@playwright/test";
import {buildSync} from "esbuild";
import {readFileSync,mkdirSync} from "node:fs";
const bundle=buildSync({outfile:"fixture.js",entryPoints:["e2e/fixtures/pap1080-tdd-reference.tsx"],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",loader:{".css":"empty"},define:{"process.env.NODE_ENV":'"production"'},banner:{js:"var process = { env: { NODE_ENV: 'production' } };"},logLevel:"silent"}).outputFiles[0].text;
const css=readFileSync("public/ho-authority-source/ho-scoped.css","utf8");
test.use({launchOptions:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{}});
const apiRequests=new WeakMap<Page,string[]>();
test.afterEach(async({page})=>{expect(apiRequests.get(page)??[]).toEqual([]);expect(await page.evaluate(()=>(window as unknown as {__atlasSideEffects:{storage:number}}).__atlasSideEffects.storage)).toBe(0);});
async function fixture(page:Page){
 const requests:string[]=[];apiRequests.set(page,requests);page.on("request",request=>{if(new URL(request.url()).pathname.startsWith("/api/"))requests.push(request.method()+" "+new URL(request.url()).pathname);});
 await page.addInitScript(()=>{Object.defineProperty(window,"__atlasSideEffects",{value:{storage:0}});for(const name of ["getItem","setItem","removeItem","clear"]){Object.defineProperty(Storage.prototype,name,{value:()=>{(window as unknown as {__atlasSideEffects:{storage:number}}).__atlasSideEffects.storage++;throw Error("Atlas storage forbidden");}});}});
 await page.route("**/*",route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith("/api/"))return route.fulfill({status:403,body:"Atlas API network forbidden"});if(route.request().isNavigationRequest())return route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="vi" data-surface="ho" data-bo-ui-authority="v25"><head><style>*{box-sizing:border-box}body{margin:0}${css}</style></head><body><div id="root"></div><script>${bundle}</script></body></html>`});return route.fulfill({status:404,body:""});});
 await page.goto("https://ho.staging.pinohouse.art/ho/system/tdd-reference");
 await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeVisible();
}
async function detail(page:Page,captureDir?:string){await page.getByRole("button",{name:"Quick View DEMO 001",exact:true}).click();const widths=await page.locator('[data-tdd-properties="drawer"] .property-control').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));expect(widths.length).toBeGreaterThan(3);expect(Math.min(...widths)).toBeGreaterThanOrEqual(105);if(captureDir)await page.screenshot({path:captureDir+"/drawer.png"});await page.getByRole("button",{name:/Full Detail/}).click();await expect(page.getByRole("tab",{name:"Tổng quan"})).toBeVisible();}
for(const width of [1440,1024,768,390,320])test(`PAP1080 Atlas ${width}: shared journey, all fields and no side effects`,async({page})=>{
 await page.setViewportSize({width,height:900});await fixture(page);const captureDir="artifacts/pap1080-atlas/"+width;mkdirSync(captureDir,{recursive:true});await page.screenshot({path:captureDir+"/table.png"});await detail(page,captureDir);await page.screenshot({path:captureDir+"/detail.png"});
 for(const label of ["Tiền VND","Boolean","Ngày giờ Việt Nam","Nhiều liên kết","Công thức chỉ đọc","Dữ liệu đã che (giả lập)"])await expect(page.getByRole("tabpanel")).toContainText(label);
 await page.getByRole("tab",{name:"Tổng quan"}).focus();await page.keyboard.press("End");await expect(page.getByRole("tab",{name:"Lịch sử"})).toBeFocused();await expect(page.getByRole("tabpanel")).toContainText("SYNTHETIC DEMO");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.getByRole("button",{name:"Quay lại bảng"}).click();await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeFocused();
 expect(await page.evaluate(()=>(window as unknown as {__atlasSideEffects:{storage:number}}).__atlasSideEffects)).toEqual({storage:0});
});
test("PAP1080 local form re-read/reset and typed business tabs",async({page})=>{
 await fixture(page);await detail(page);await page.getByRole("tab",{name:"Biểu mẫu demo"}).click();
 await page.getByLabel("Tên mô phỏng").fill("Edited only in RAM");await page.getByRole("button",{name:"Lưu",exact:true}).click();await expect(page.getByRole("tabpanel")).toContainText("Đã lưu thành công.");
 for(const name of ["Quan hệ demo","Timeline demo","Chỉ số demo","Media demo","Quyền demo"]){await page.getByRole("tab",{name,exact:true}).click();await expect(page.getByRole("tabpanel")).toContainText(/demo|mô phỏng/i);}
 await page.getByRole("button",{name:"Reset demo"}).click();await detail(page);await page.getByRole("tab",{name:"Biểu mẫu demo"}).click();await expect(page.getByLabel("Tên mô phỏng")).toHaveValue("Demo form");
});
for(const scenario of ["empty","401","403","error","null","long-unicode","high-volume","loading"]){test(`PAP1080 scenario ${scenario} is synthetic and resettable`,async({page})=>{
 await fixture(page);await page.getByLabel("Kịch bản mô phỏng").selectOption(scenario);
 if(scenario==="empty")await expect(page.getByRole("button",{name:/^Quick View DEMO/})).toHaveCount(0);
 else if(["401","403"].includes(scenario))await expect(page.getByRole("status").last()).toContainText("Không có quyền");
 else if(scenario==="error"){await expect(page.getByRole("alert")).toBeVisible();await page.getByRole("button",{name:"Thử lại",exact:true}).click();await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeVisible();}
 else await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Reset demo"}).click();await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeVisible();
 });}
for(const scenario of ["readonly","invalid","conflict"]){test(`PAP1080 form ${scenario} cannot claim a successful write`,async({page})=>{await fixture(page);await page.getByLabel("Kịch bản mô phỏng").selectOption(scenario);await detail(page);await page.getByRole("tab",{name:"Biểu mẫu demo"}).click();if(scenario==="readonly")await expect(page.getByRole("button",{name:"Lưu",exact:true})).toHaveCount(0);else {await page.getByRole("button",{name:"Lưu",exact:true}).click();await expect(page.getByRole("alert")).toBeVisible();await expect(page.getByRole("tabpanel")).not.toContainText("Đã lưu thành công.");}});}

test("PAP1080 missing record and long Unicode remain truthful at 320",async({page})=>{await page.setViewportSize({width:320,height:900});await fixture(page);await page.getByLabel("Kịch bản mô phỏng").selectOption("404");await page.getByRole("button",{name:"Quick View DEMO 001",exact:true}).click();await expect(page.locator('[data-tdd-shell="drawer"]')).toContainText("Không tìm thấy bản ghi.");await expect(page.getByRole("button",{name:/Full Detail/})).toBeDisabled();await page.getByRole("button",{name:"Đóng",exact:true}).click();await page.getByLabel("Kịch bản mô phỏng").selectOption("long-unicode");await detail(page);await expect(page.getByRole("tabpanel")).toContainText("Tiếng Việt");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);});

test("PAP1080 Table search, sort, pagination and optional built-in View",async({page})=>{
 await fixture(page);await page.locator("#search").fill("DEMO 003");await expect(page.getByRole("button",{name:/^Quick View DEMO/})).toHaveCount(1);await expect(page.getByRole("button",{name:"Quick View DEMO 003",exact:true})).toBeVisible();
 await page.locator("#search").fill("");await page.locator('button[data-sort="quantity"]').click();await page.locator('button[data-sort="quantity"]').click();await expect(page.getByRole("button",{name:/^Quick View DEMO/}).first()).toHaveAttribute("aria-label","Quick View DEMO 024");
 await page.getByRole("button",{name:"Trang sau",exact:true}).click();await expect(page.getByRole("button",{name:/^Quick View DEMO/}).first()).toHaveAttribute("aria-label","Quick View DEMO 016");
 await page.getByRole("button",{name:"Pending (demo)",exact:true}).click();await expect(page.getByRole("button",{name:/^Quick View DEMO/}).first()).toHaveAttribute("aria-label","Quick View DEMO 002");await page.locator('[data-view="all"]').click();await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeVisible();
});
test("PAP1080 typed filter, protected identity, visibility and grouping",async({page})=>{
 await fixture(page);await page.locator("#filter-toggle").click();await page.locator("#add-rule").click();await page.getByLabel("Trường dữ liệu điều kiện 1").selectOption("quantity");await page.getByLabel("Toán tử",{exact:true}).selectOption("gt");await page.getByLabel("Giá trị",{exact:true}).fill("20");await expect(page.getByRole("button",{name:/^Quick View DEMO/})).toHaveCount(4);await page.locator("#clear-rules").click();
 await page.locator("#visible-columns").click();await expect(page.getByRole("button",{name:"Ẩn Tên demo",exact:true})).toBeDisabled();await page.getByRole("button",{name:"Ẩn Tiền VND",exact:true}).click();await page.getByRole("button",{name:"Đóng cài đặt",exact:true}).click();await expect(page.locator('th[data-column="amount"]')).toHaveCount(0);
 await page.locator("#group-shortcut").click();await page.locator("#group-by").selectOption("status");await page.locator("#group-collapse-all").click();await page.getByRole("button",{name:"Đóng cài đặt",exact:true}).click();await expect(page.getByRole("button",{name:/^Quick View DEMO/})).toHaveCount(0);
 await page.locator("#group-shortcut").click();await page.locator("#group-expand-all").click();await page.locator("#remove-group").click();await page.getByRole("button",{name:"Đóng cài đặt",exact:true}).click();await expect(page.getByRole("button",{name:"Quick View DEMO 001",exact:true})).toBeVisible();
});
test("PAP1080 Custom View create, rename and delete stay in memory",async({page})=>{
 await fixture(page);await page.getByRole("button",{name:"Thêm Quick View",exact:true}).click();await page.locator("#view-name").fill("Atlas local");await page.locator("#save-view-confirm").click();const close=page.getByRole("button",{name:"Đóng cài đặt",exact:true});if(await close.isVisible())await close.click();
 const view=page.getByRole("button",{name:/Atlas local/});await expect(view).toBeVisible();await view.focus();await page.keyboard.press("F2");await page.getByLabel("Tên Quick View",{exact:true}).fill("Atlas renamed");await page.keyboard.press("Enter");const renamed=page.getByRole("button",{name:/Atlas renamed/});await expect(renamed).toBeVisible();await renamed.focus();await page.keyboard.press("Shift+F10");await page.getByRole("menuitem",{name:"Xóa view",exact:true}).click();await expect(renamed).toHaveCount(0);await expect(page.getByRole("button",{name:"Pending (demo)",exact:true})).toBeVisible();
});
