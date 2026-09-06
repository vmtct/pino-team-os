import { test, expect, type Page } from "@playwright/test";

const centerId="01999999-9999-7999-8999-999999999901", assignmentId="01999999-9999-7999-8999-999999999902";
const context={userId:"u",staffMemberId:"s",email:"staff@pino.invalid",centers:[{id:centerId,key:"house",displayName:"PINO House",timeZone:"Asia/Ho_Chi_Minh"}],termWeeks:[]};
const profile={id:"s",displayLabel:"Staff PINO",status:"active",email:null,mobile:null,legalAddress:null};
async function baseRoutes(page: Page, exception:()=>unknown){
 await page.route("**/api/workforce/**",async route=>{const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(path.endsWith("/context"))return route.fulfill({json:{data:context}});
  if(path.endsWith("/profile"))return route.fulfill({json:{data:profile}});
  if(path.endsWith("/timekeeping/current"))return route.fulfill({json:{data:null}});
  if(path.endsWith("/schedule"))return route.fulfill({json:{data:[]}});
  if(path.endsWith("/timekeeping/history"))return route.fulfill({json:{data:[]}});
  if(path.endsWith("/check-in-exceptions/status"))return route.fulfill({json:{data:exception()}});
  return route.fallback();
 });
}
test.use({viewport:{width:390,height:844}});

test("mobile no-assignment request is canonical, retry-safe and has no horizontal overflow",async({page})=>{
 let state:unknown={kind:"NO_ELIGIBLE_ASSIGNMENT",request:null},requestBody:unknown=null;
 await baseRoutes(page,()=>state);
 await page.route("**/api/workforce/check-in-exceptions",async route=>{requestBody=route.request().postDataJSON();state={kind:"REQUESTED",request:{id:"r",staffMemberId:"s",centerId,workDate:"2026-09-06",reason:"Được gọi hỗ trợ lớp",status:"REQUESTED",requestedAt:new Date().toISOString(),requestedByUserId:"u",approvedAt:null,approvedByUserId:null,declinedAt:null,declinedByUserId:null,declineReason:null,generatedAssignmentId:null,version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}};return route.fulfill({json:{data:(state as {request:unknown}).request}})});
 await page.goto("/check-in");
 await expect(page.getByRole("heading",{name:"Bạn chưa có ca làm được phân công cho hôm nay"})).toBeVisible();
 await page.getByRole("button",{name:"Yêu cầu check-in ngoài lịch"}).click();
 await page.getByLabel("Lý do").fill("Được gọi hỗ trợ lớp");
 await page.getByRole("button",{name:"Gửi yêu cầu"}).click();
 await expect(page.getByRole("heading",{name:"Đang chờ Manager duyệt"})).toBeVisible();
 expect(requestBody).toEqual({centerId,reason:"Được gọi hỗ trợ lớp"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test("approved assignment is handed to normal check-in with exact canonical assignmentId",async({page})=>{
 let checkInBody:unknown=null;
 const assignment={id:assignmentId,centerId,staffMemberId:"s",workDate:"2026-09-06",shiftTemplateId:"t",termWeekId:null,status:"ACTIVE",assignedByUserId:"m",assignedAt:new Date().toISOString(),cancelledByUserId:null,cancelledAt:null,cancellationReason:null,replacesAssignmentId:null,shift:{code:"EVENING",displayLabel:"Ca tối",startLocalTime:"17:30",endLocalTime:"21:00"}};
 await baseRoutes(page,()=>({kind:"ELIGIBLE_ASSIGNMENT",assignment}));
 await page.route("**/api/workforce/timekeeping/check-in",async route=>{checkInBody=route.request().postDataJSON();return route.fulfill({json:{data:{id:"session",centerId,assignmentId,workDate:"2026-09-06",status:"OPEN",checkInAt:new Date().toISOString(),checkOutAt:null}}})});
 await page.goto("/check-in");
 await expect(page.getByRole("heading",{name:"Sẵn sàng check-in"})).toBeVisible();
 await page.getByRole("button",{name:"CHECK IN"}).click();
 expect(checkInBody).toEqual({centerId,assignmentId});
});
