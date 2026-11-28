import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {createTimekeepingCameraReview,isTimekeepingLocalReview,reviewTimekeepingPage,TIMEKEEPING_REVIEW_CENTER,TIMEKEEPING_REVIEW_DATE} from "../app/bo/workforce/timekeeping/timekeeping-camera-local-review";
test("PAP-1612 exact Timekeeping local opaque route only",()=>{
 const args=["http://desktop-isrdren:8800","null","/bo/workforce/timekeeping","",""] as const;
 assert.equal(isTimekeepingLocalReview(...args),true);
 for(const [index,value] of [[0,"https://bo.staging.pinohouse.art"],[1,"http://desktop-isrdren:8800"],[2,"/bo/payroll-daily"],[3,"?centerId=other"],[4,"#other"]] as const){const next=[...args] as string[];next[index]=value;assert.equal(isTimekeepingLocalReview(next[0],next[1],next[2],next[3],next[4]),false);}
});
test("PAP-1612 synthetic session and evidence same identity; local bounded filters",()=>{
 const review=createTimekeepingCameraReview();assert.equal(review.session.id,review.evidence.id);assert.equal(review.session.staff.displayLabel,review.evidence.staffName);assert.equal(review.session.effective.durationSeconds,null);assert.equal(review.session.latestCorrection,null);assert.equal(review.session.status,"OPEN");
 const filter={centerId:TIMEKEEPING_REVIEW_CENTER.id,startDate:TIMEKEEPING_REVIEW_DATE,endDate:TIMEKEEPING_REVIEW_DATE,staffId:"",status:""};
 assert.equal(reviewTimekeepingPage(review,filter).data.length,1);
 for(const patch of [{centerId:"other"},{startDate:"2026-11-29"},{status:"CLOSED"},{staffId:"other"}])assert.equal(reviewTimekeepingPage(review,{...filter,...patch}).data.length,0);
});
test("PAP-1612 local view excludes live transport and payroll coupling",()=>{
 const view=readFileSync("app/bo/workforce/timekeeping/TimekeepingView.tsx","utf8");
 assert.match(view,/if \(review\) return;/);assert.match(view,/if \(review \|\| !centerId/);assert.match(view,/!review && selected/);assert.match(view,/review && evidenceOpen/);
 assert.doesNotMatch(readFileSync("app/bo/payroll-daily/BoPayrollDailyReadView.tsx","utf8"),/BoCheckInEvidence|evidenceReview|payroll-camera-local-review/);
});
