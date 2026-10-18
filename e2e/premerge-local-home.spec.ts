import { test, expect } from "@playwright/test";

/** PRE-MERGE LOCAL UI E2E: deterministic presentation fixtures, not a Core integration verdict. */
test.beforeEach(async ({ page }) => {
  await page.route("**/api/workforce/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/profile")
      ? { id:"fixture-staff", displayLabel:"Nhân viên thử nghiệm", status:"ACTIVE", department:null, roleLabel:null, employmentType:null, email:null, mobile:null, legalAddress:null }
      : path.endsWith("/context")
        ? { userId:"fixture-user", staffMemberId:"fixture-staff", email:"fixture@example.invalid",
            centers:[{ id:"fixture-center", key:"TEST", displayName:"Trung tâm thử nghiệm", timeZone:"Asia/Ho_Chi_Minh" }],termWeeks:[] }
        : [];
    await route.fulfill({status:200, contentType:"application/json", body:JSON.stringify({data})});
  });
});
for (const width of [390,768,1440]) {
  test(`PAP-709 local Home responsive and denied tile — ${width}`,async ({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.getByRole("heading",{name:/Xin chào/})).toBeVisible();
    const apps=page.getByRole("region",{name:"Ứng dụng PINO"}).getByRole("button");
    await expect(apps).toHaveCount(5);
    for(const [index,name] of ["Ca làm","Tiếp tân","Trạm TOS","Trưởng ca","Lớp học"].entries())
      await expect(apps.nth(index)).toContainText(name);
    const content=await page.locator("main > div").filter({has:page.getByRole("heading",{name:/Xin chào/})}).boundingBox();
    expect(content).not.toBeNull();
    expect(content!.width).toBeLessThanOrEqual(431);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const denied=apps.nth(1);
    await expect(denied).toHaveAttribute("aria-disabled","true");
    await denied.click();
    await expect(page.getByRole("status")).toContainText("Ca này bạn chưa có quyền");
    await page.screenshot({path:`test-results/local-home-${width}.png`,fullPage:true});
  });
}
