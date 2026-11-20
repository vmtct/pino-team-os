import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
 await p.goto("http://127.0.0.1:8888/ho/mytime-workshops");
 await p.getByRole("button",{name:"Thêm Workshop",exact:true}).click();
 await p.locator("#create-save").click(); await p.getByRole("alert").last().waitFor();
 const edit=async(k,fn)=>{await p.locator('[data-detail-edit="'+k+'"]').click();await fn();await p.locator("#popover").getByRole("button",{name:"Lưu",exact:true}).click();await p.locator("#popover").waitFor({state:"hidden"});};
 await edit("name",()=>p.locator("#editor-value").fill("Workshop QA"));
 await edit("center",()=>p.locator("#editor-value").selectOption("PINO House A"));
 await edit("startAt",()=>p.locator("#editor-value").fill("2026-11-29T14:00"));
 await edit("endAt",()=>p.locator("#editor-value").fill("2026-11-29T17:00"));
 await edit("missions",()=>p.locator("#editor-options").getByRole("button",{name:/Moonlit City/}).click());
 await p.locator("#create-save").click();await p.locator("#full-detail").waitFor();
 await p.locator("#full-detail").click();
 await edit("name",()=>p.locator("#editor-value").fill("Workshop QA edited"));
 assert.ok((await p.locator("body").innerText()).includes("Workshop QA edited"));
 // PAP-2207: one cancellation action follows all Overview fields on desktop and mobile.
 const cancel=p.getByRole("button",{name:"H\u1ee7y Workshop",exact:true});
 assert.equal(await cancel.count(),1);
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:900});
  await cancel.scrollIntoViewIfNeeded();
  assert.ok(await cancel.evaluate(button=>{
   const fields=[...document.querySelectorAll(".v24-prop-item")].filter(e=>e.getClientRects().length);
   return fields.length>0&&fields.every(field=>Boolean(field.compareDocumentPosition(button)&Node.DOCUMENT_POSITION_FOLLOWING)&&field.getBoundingClientRect().bottom<=button.getBoundingClientRect().top+1);
  }),"Cancel must follow the visible Overview fields at width "+width);
 }
 p.once("dialog",d=>d.accept());await p.getByRole("button",{name:"Hủy Workshop",exact:true}).click();
 await p.getByText("Đã hủy",{exact:true}).last().waitFor();
 assert.equal(await p.locator("[data-detail-edit]").count(),0);
 assert.equal(await cancel.count(),0);
 assert.deepEqual(errs,[]); console.log("HO_CREATE_EDIT_CANCEL_PASS");
}finally{await browser.close();}
