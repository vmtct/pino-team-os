import assert from "node:assert/strict";
import test from "node:test";
import {guardianRef,guardianProjection,validIntakeBoundary,categoryLabel,categoryValue} from "./guest-intake-contract";
const parentUserId="019d2202-0000-7000-8000-000000000001",guardian={parentUserId,relationship:"PARENT"};
test("PAP-2202 boundary: canonical reference, not guardian PII",()=>{
 assert.equal(guardianRef(guardian),true);
 for(const value of [{...guardian,phone:"+84900000001"},{...guardian,studentId:parentUserId},{parentUserId:"bad",relationship:"PARENT"},{...guardian,relationship:"UNKNOWN"}])assert.equal(guardianRef(value),false);
 assert.equal(guardianProjection({...guardian,displayName:"QA",maskedPhone:"+8••••01",phoneVerified:false}),true);
 assert.equal(guardianProjection({...guardian,displayName:"QA",maskedPhone:"+84900000001",phoneVerified:false}),false);
});
test("PAP-2202 boundary: create/patch, no extra scope or consent, legacy replay passes to Core",()=>{
 const adult={name:"QA",category:"ADULT",gender:"MALE",phone:"0900000001"};
 const minor={name:"QA",category:"MINOR",gender:"FEMALE",phone:null,guardian};
 assert.equal(validIntakeBoundary(adult,"POST"),true);assert.equal(validIntakeBoundary(minor,"POST"),true);
 for(const body of [{...minor,guardian:{...guardian,phone:"raw"}},{...minor,centerId:parentUserId},{...minor,consent:true},{...minor,category:"UNKNOWN"},{...adult,guardian},{...minor,guardian:null}])assert.equal(validIntakeBoundary(body,"POST"),false);
 assert.equal(validIntakeBoundary({name:"Legacy"},"POST"),true);
 assert.equal(validIntakeBoundary({expectedVersion:1,category:"ADULT",guardian:null},"PATCH"),true);
 assert.equal(validIntakeBoundary({expectedVersion:1},"PATCH"),false);
 assert.equal(validIntakeBoundary({expectedVersion:0,guardian},"PATCH"),false);
 assert.equal(categoryLabel(undefined),"Chưa xác định");assert.equal(categoryValue("Chưa xác định"),null);
});
