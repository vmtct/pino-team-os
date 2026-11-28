import assert from "node:assert/strict";
import test from "node:test";
import {cameraReviewTransition,isTosCameraLocalReview} from "./pap1612-tos-camera-review";
test("PAP-1612 TOS camera review exact local opaque route only",()=>{
 assert.equal(isTosCameraLocalReview("http://desktop-isrdren:8800","null","/tos","",""),true);
 for(const [origin,opaque,path,search,hash] of [["https://tos.staging.pinohouse.art","null","/tos","",""],["http://desktop-isrdren:8800","http://desktop-isrdren:8800","/tos","",""],["http://desktop-isrdren:8800","null","/tos-v4","",""],["http://desktop-isrdren:8800","null","/tos","?review=1",""],["http://desktop-isrdren:8800","null","/tos","","#other"]])assert.equal(isTosCameraLocalReview(origin,opaque,path,search,hash),false);
});
test("PAP-1612 simulated capture required before local confirmation, terminal confirmation cannot repeat",()=>{
 assert.equal(cameraReviewTransition("framing","confirm"),"framing");
 assert.equal(cameraReviewTransition("framing","capture"),"preview");
 assert.equal(cameraReviewTransition("preview","retake"),"framing");
 assert.equal(cameraReviewTransition("preview","confirm"),"confirmed");
 for(const action of ["capture","retake","confirm"] as const)assert.equal(cameraReviewTransition("confirmed",action),"confirmed");
});