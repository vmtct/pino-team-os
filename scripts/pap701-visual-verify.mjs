import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = "http://localhost:3041";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [390, 768, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: "pino_staff_password_session", value: "visual-only-not-auth", url: base }]);
    await ctx.route("**/api/workforce/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/profile")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({data:{id:"test",displayLabel:"Nhân viên thử nghiệm",status:"ACTIVE",department:null,roleLabel:null,employmentType:null,email:null,mobile:null,legalAddress:null}}) });
      if (pathname.endsWith("/context")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({data:{userId:"test",staffMemberId:"test",email:"test@example.invalid",centers:[{id:"center-test",key:"TEST",displayName:"PINO Test Center",timeZone:"Asia/Ho_Chi_Minh"}],termWeeks:[]}}) });
      if (pathname.endsWith("/schedule")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({data:[]}) });
      return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({error:{code:"NO_TEST_ROUTE"}})});
    });
    const page = await ctx.newPage();
    await page.goto(base+"/", {waitUntil:"domcontentloaded",timeout:60000});
    await page.getByRole("heading", {name:/Xin chào/}).waitFor({timeout:30000});
    await page.waitForTimeout(1800); // wait until client hydration/media query resolves
    assert.equal(await page.locator("section[aria-label='Ứng dụng PINO'] button").count(),5);
    assert.equal(await page.locator("nav").count(),0);
    assert.equal(await page.locator("section[aria-label='Ứng dụng PINO'] button[aria-disabled='true']").count(),width>=760?3:4);
    const dimensions = await page.evaluate(() => ({content:document.querySelector("main > div:nth-of-type(2)")?.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,window:innerWidth}));
    assert.ok(dimensions.content<=430.1,JSON.stringify(dimensions));
    assert.ok(dimensions.scroll<=dimensions.window+1,JSON.stringify(dimensions));
    await page.waitForTimeout(1800); // wait for React hydration before exercising client-side toast
    await page.getByRole("button",{name:"Tiếp tân chưa có quyền"}).click({force:true});
    await page.getByRole("status").getByText("Ca này bạn chưa có quyền").waitFor();
    fs.mkdirSync("test-results/pap701", {recursive:true});
    await page.screenshot({path:`test-results/pap701/home-${width}.png`,fullPage:true});
    console.log("PAP701_VP_PASS",width,JSON.stringify(dimensions));
    await ctx.close();
  }
} finally { await browser.close(); }
