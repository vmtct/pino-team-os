import { expect, test } from "@playwright/test";
const center={id:"center-test",displayLabel:"Can Tho",timeZone:"Asia/Ho_Chi_Minh"};
const base={id:"tk-670",staff:{id:"staff-670",displayLabel:"Test Staff"},centerId:center.id,workDate:"2026-10-17",assignmentId:null,assignment:null,checkInAt:"2026-10-17T01:00:00.000Z",checkOutAt:"2026-10-17T05:00:00.000Z",status:"CLOSED",durationSeconds:14400,anomalyFlags:[],recorded:{checkInAt:"2026-10-17T01:00:00.000Z",checkOutAt:"2026-10-17T05:00:00.000Z",durationSeconds:14400},effective:{checkInAt:"2026-10-17T01:00:00.000Z",checkOutAt:"2026-10-17T05:00:00.000Z",durationSeconds:14400},latestCorrection:null};
const authorizedStorageState = process.env.PAP670_E2E_STORAGE_STATE;
if (authorizedStorageState) test.use({ storageState: authorizedStorageState });
test("PAP-670 actual React page: correct mutation refetches canonical data",async({page})=>{
 test.skip(!authorizedStorageState, "Requires PAP670_E2E_STORAGE_STATE with an authorized isolated BO test session; never bypass middleware.");
 test.setTimeout(120000);
 const writes:any[]=[];let sessions:any[]=[{...base}];
 await page.route("**/api/bo/workforce/timekeeping*",async(route)=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(request.method()==="POST"){
   const body=request.postDataJSON();writes.push({path,body,headers:request.headers()});
   if(path.endsWith("/corrections"))sessions=sessions.map(s=>({...s,effective:{...s.effective,checkInAt:body.correctedAt},latestCorrection:{id:"corr-670",correctionType:body.correctionType,reason:body.reason,createdAt:"2026-10-17T07:00:00.000Z",createdByUserId:"tester",supersedesCorrectionId:null}}));
   else if(path.endsWith("/resolve-missed-checkout"))sessions=sessions.map(s=>({...s,status:"CLOSED",checkOutAt:body.checkOutAt,effective:{...s.effective,checkOutAt:body.checkOutAt},latestCorrection:{id:"corr-resolve",correctionType:"MISSED_CHECKOUT",reason:body.reason,createdAt:"2026-10-17T07:00:00.000Z",createdByUserId:"tester",supersedesCorrectionId:null}}));
   await route.fulfill({json:{data:{success:true}}});return;
  }
  if(path.endsWith("/centers")){await route.fulfill({json:{data:[center]}});return;}
  if(path.endsWith("/timekeeping")){const status=url.searchParams.get("status");const data=status?sessions.filter(s=>s.status===status):sessions;await route.fulfill({json:{data:{data,nextCursor:null,summary:{totalSessions:data.length,openSessions:data.filter(s=>s.status==="OPEN").length,closedSessions:data.filter(s=>s.status==="CLOSED").length}}}});return;}
  await route.continue();
 });
 await page.goto("http://127.0.0.1:3187/bo/workforce/timekeeping",{waitUntil:"domcontentloaded",timeout:90000});
 await expect(page.getByRole("heading",{name:"Timekeeping"})).toBeVisible();
 await page.getByText("Test Staff").first().click();
 await page.getByRole("button",{name:"Correct attendance"}).click();
 await page.locator('input[type="datetime-local"]').fill("2026-10-17T08:30");
 await page.locator("textarea").fill("Verified against manual attendance");
 await page.getByRole("button",{name:"Save correction"}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].body.correctedAt).toBe("2026-10-17T01:30:00.000Z");
 expect(writes[0].body.expectedLatestCorrectionId).toBeNull();
 expect(writes[0].headers["idempotency-key"]).toBeTruthy();
 await expect(page.getByText("Correction saved. Recorded history remains unchanged.")).toBeVisible();
});
