const { chromium } = require('D:/PINO/prototype/pino-team-os/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1366,height:768}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8766');
 const out={title:await page.title(),h1:await page.locator('h1').innerText(),todayRows:await page.locator('tbody tr[data-id]').count()};
 await page.getByRole('button',{name:'Lịch sử'}).click();
 out.historyRows=await page.locator('tbody tr[data-id]').count(); out.loadMoreVisible=await page.locator('#loadMore').isVisible();
 if(out.loadMoreVisible){await page.locator('#loadMore').click(); out.rowsAfterLoad=await page.locator('tbody tr[data-id]').count();}
 await page.locator('tr[data-id="s2"]').click(); out.drawer=await page.locator('#drawerBg').evaluate(e=>getComputedStyle(e).display); out.correction=await page.locator('#dCorrection').innerText(); out.correctAction=await page.locator('#mutation').innerText();
 await page.getByRole('button',{name:'✕ Đóng'}).click(); await page.locator('tr[data-id="s1"]').click(); out.resolveAction=await page.locator('#mutation').innerText(); await page.getByRole('button',{name:'✕ Đóng'}).click();
 await page.getByRole('button',{name:'Cần kiểm tra',exact:true}).last().click(); out.attentionRows=await page.locator('tbody tr[data-id]').count(); out.url=page.url();
 await page.locator('#staff').selectOption('staff-gh'); out.staffRows=await page.locator('tbody tr[data-id]').count(); out.staffUrl=page.url();
 await page.locator('#from').fill('2026-10-10'); await page.locator('#to').fill('2026-10-01'); out.dateError=await page.locator('#dateError').isVisible(); out.invalidRows=await page.locator('tbody tr[data-id]').count(); out.errors=errors;
 const mobile=await browser.newPage({viewport:{width:390,height:844}}); await mobile.goto('http://localhost:8766'); out.mobileOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 console.log(JSON.stringify(out,null,2)); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});