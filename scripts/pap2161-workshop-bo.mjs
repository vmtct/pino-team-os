import {chromium} from "playwright";
import assert from "node:assert/strict";
const b=await chromium.launch({channel:"chrome",headless:true});
try{
for(const width of [1440,768,390]){
 const p=await b.newPage({viewport:{width,height:900}});const errors=[];p.on("pageerror",e=>errors.push(String(e)));
 await p.goto("http://127.0.0.1:8888/bo/mytime-workshops");
 await p.locator("button[data-edit=name]").filter({hasText:"Daydream cuối tuần"}).waitFor();
 assert.equal(await p.getByRole("button",{name:"Thêm Workshop",exact:true}).count(),0);
 assert.equal(await p.locator("button[data-edit=name]").filter({hasText:"Mediterranean Balcony"}).count(),0);
 const noOverflow=()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 assert.ok(await noOverflow());await p.locator("button[data-edit=name]").filter({hasText:"Daydream cuối tuần"}).click();await p.locator("#full-detail").waitFor();assert.ok(await noOverflow());
 await p.locator("#full-detail").click();assert.equal(await p.locator("[data-detail-edit]").count(),0);assert.equal(await p.getByRole("button",{name:"Hủy Workshop",exact:true}).count(),0);assert.ok(await noOverflow());assert.deepEqual(errors,[]);await p.close();console.log("BO",width,"PASS");
}
const p=await b.newPage();await p.goto("http://127.0.0.1:8888/bo/mytime-workshops");await p.locator("button[data-edit=name]").filter({hasText:"Daydream cuối tuần"}).waitFor();await p.getByRole("button",{name:"Trung t\u00e2m hi\u1ec7n t\u1ea1i: PINO House A. Chuy\u1ec3n trung t\u00e2m",exact:true}).click();await p.getByRole("option",{name:"PINO House B",exact:true}).click();await p.locator("button[data-edit=name]").filter({hasText:"Mediterranean Balcony"}).first().waitFor();assert.equal(await p.locator("button[data-edit=name]").filter({hasText:"Daydream cuối tuần"}).count(),0);await p.close();console.log("BO_CENTER_PASS");
}finally{await b.close();}
