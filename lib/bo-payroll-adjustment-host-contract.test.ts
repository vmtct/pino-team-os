import assert from "node:assert/strict";
import test from "node:test";
import {matchesProductPayrollAdjustmentPath} from "./bo-payroll-adjustment-host-contract";
import {decideHostBoundary,BO_STAGING_HOSTNAME,BO_HOSTNAME,HO_STAGING_HOSTNAME,TOS_STAGING_HOSTNAME,TOS_HOSTNAME} from "./host-boundary";
const period="0199f001-0000-7000-8000-000000000003";
const staff="0199f001-0000-7000-8000-000000000004";
const path="/api/bo/workforce/payroll/periods/"+period+"/staff/"+staff+"/financial-adjustments";
test("PAP-1956 exact canonical product adjustment path only",()=>{
 assert.equal(matchesProductPayrollAdjustmentPath(path),true);
 for(const bad of [path+"/",path+"?centerId=fake",path+"\n",path+"/history",path.replace("/bo/","/ho/"),path.replace("/bo/","/tos/"),path.replace(period,"bad"),path.replace(staff,"0199f001-0000-4000-8000-000000000004"),path.replace(staff,"0199f001-0000-7000-1000-000000000004"),path.replace(staff,"0199F001-0000-7000-8000-000000000004"),path.replace("/staff/","//staff/"),path.replace("/financial-adjustments","/%66inancial-adjustments"),path.replace("/financial-adjustments","/paid"),path.replace("/financial-adjustments","/adjustments")])assert.equal(matchesProductPayrollAdjustmentPath(bad),false,bad);
});
test("PAP-1956 fixed PAP-1211 fixture remains outside product admission",()=>{
 assert.equal(matchesProductPayrollAdjustmentPath(path.replace(period,"01a171ed-eb78-7941-b1de-dd4c020457b7").replace(staff,"01a18a28-6d8e-7db7-acbb-a18a942a5e72")),false);
});
test("PAP-1956 actual host edge candidate admits only exact BO Staging POST, keeps historical aperture",()=>{
 assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,path,"POST"),{action:"next"});
 for(const host of [BO_HOSTNAME,HO_STAGING_HOSTNAME,TOS_STAGING_HOSTNAME,TOS_HOSTNAME,"localhost","unknown.invalid","team.pinohouse.art"])assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"not_found"},host);
 for(const verb of ["GET","HEAD","PATCH","PUT","DELETE","OPTIONS"])assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,path,verb),{action:"not_found"},verb);
 for(const p of [path+"/",path+"/extra",path.replace(period,"bad"),path.replace(staff,"bad"),path.replace(staff,"0199F001-0000-7000-8000-000000000004"),path.replace("/financial-adjustments","/adjustments"),path.replace("/financial-adjustments","/FINANCIAL-ADJUSTMENTS"),path.replace(period,"01a171ed-eb78-7941-b1de-dd4c020457b7").replace(staff,"01a18a28-6d8e-7db7-acbb-a18a942a5e72")])assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME,p,"POST"),{action:"not_found"},p);
});