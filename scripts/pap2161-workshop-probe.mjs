// PAP-2161 / MT-WORKSHOP — isolated fixture browser functional probe.
import {chromium} from "playwright";
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 for(const surface of ["ho","bo"]){
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];p.on("pageerror",e=>errors.push(String(e)));
 await p.goto("http://127.0.0.1:8888/"+surface+"/mytime-workshops");
 await p.waitForTimeout(1800);
 console.log(surface,JSON.stringify({errors,text:(await p.locator("body").innerText()).slice(-2500),buttons:await p.locator("button").allTextContents(),table:await p.locator("table").count(),width:await p.evaluate(()=>[document.documentElement.scrollWidth,innerWidth])}));
 await p.close();
 }
}finally{await browser.close();}
