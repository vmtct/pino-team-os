import test from "node:test";
import assert from "node:assert/strict";
import {centerBusinessDate,displayLocalDate,enrollmentDisplayEndDate,enrollmentPeriodState,validLocalDate} from "./bo-class-enrollment-presenter";
import {isOperationalReadPath,readQueryBody} from "./bo-read-handler";
const endpoint="delivery/running-classes/01234567-89ab-7abc-8def-0123456789ab/enrollments";
test("PAP-1041 exclusive end displays final enrolled local day including year/leap boundaries",()=>{
  assert.equal(enrollmentDisplayEndDate("2026-10-20"),"19/10/2026");
  assert.equal(enrollmentDisplayEndDate("2027-01-01"),"31/12/2026");
  assert.equal(enrollmentDisplayEndDate("2024-03-01"),"29/02/2024");
  assert.equal(enrollmentDisplayEndDate(null),"—");
  assert.equal(displayLocalDate("2026-10-20"),"20/10/2026");
  assert.equal(validLocalDate("2026-02-30"),false);
});
test("PAP-1041 status respects exclusive end and Center-local current date",()=>{
  const now=new Date("2026-10-19T17:30:00.000Z");
  assert.equal(centerBusinessDate("Asia/Ho_Chi_Minh",now),"2026-10-20");
  assert.equal(centerBusinessDate("America/Los_Angeles",now),"2026-10-19");
  assert.equal(centerBusinessDate(null,now),null);
  assert.equal(enrollmentPeriodState({effectiveFromLocalDate:"2026-10-20",effectiveUntilExclusiveLocalDate:null},"2026-10-20").label,"Đang học");
  assert.equal(enrollmentPeriodState({effectiveFromLocalDate:"2026-10-05",effectiveUntilExclusiveLocalDate:"2026-10-20"},"2026-10-20").label,"Đã kết thúc");
  assert.equal(enrollmentPeriodState({effectiveFromLocalDate:"2026-10-21",effectiveUntilExclusiveLocalDate:null},"2026-10-20").label,"Sắp bắt đầu");
  assert.equal(enrollmentPeriodState({effectiveFromLocalDate:"2026-10-05",effectiveUntilExclusiveLocalDate:null},null).label,"Chưa xác định");
});
test("PAP-1041 BO proxy only admits bounded class-enrollment GET with paired cursor",()=>{
  assert.equal(isOperationalReadPath(endpoint),true);
  assert.equal(isOperationalReadPath("delivery/running-classes/abc/enrollments"),false);
  assert.deepEqual(readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?limit=25&beforeFrom=2026-10-20&beforeId=01234567-89ab-7abc-8def-0123456789ab&beforeRank=0&asOfLocalDate=2026-10-20")),{
    limit:25,beforeFrom:"2026-10-20",beforeId:"01234567-89ab-7abc-8def-0123456789ab",beforeRank:0,asOfLocalDate:"2026-10-20"
  });
  assert.throws(()=>readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?limit=101")),RangeError);
  assert.throws(()=>readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?beforeFrom=2026-10-20")),RangeError);
  assert.throws(()=>readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?limit=1&limit=2")),RangeError);
  assert.throws(()=>readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?studentProfileId=1")),RangeError);
  assert.throws(()=>readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?limit=25&beforeFrom=2026-10-20&beforeId=01234567-89ab-7abc-8def-0123456789ab")),RangeError);
  assert.throws(()=>readQueryBody(endpoint,new URL("https://bo.test/"+endpoint+"?limit=25&beforeRank=4")),RangeError);
});
