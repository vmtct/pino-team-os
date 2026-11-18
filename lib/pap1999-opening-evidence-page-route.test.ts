import {test} from "node:test";
import assert from "node:assert/strict";
import {openingEvidencePageHref, openingEvidencePageSubject} from "./opening-evidence-page-route";
import {detailTabHref} from "./bo-full-detail-navigation";
import {openingEvidenceHostDecision,openingEvidenceBoModule} from "./opening-evidence-host-contract";
import {decideHostBoundary} from "./host-boundary";
const receipt="00000000-0000-7000-8000-000000000001",center="00000000-0000-7000-8000-000000000002";
const bo="bo.staging.pinohouse.art";
test("PAP-1999 actual uppercase subject uses lowercase Full Detail path and safe tab navigation",()=>{
  for(const subjectType of ["CLASS","RECEPTION"] as const){
    const href=openingEvidencePageHref({subjectType,openingReceiptId:receipt,centerId:center});
    const path="/bo/opening-evidence/"+subjectType.toLowerCase()+"/"+receipt;
    assert.equal(href,path+"?centerId="+center);
    assert.equal(openingEvidencePageSubject(subjectType.toLowerCase()),subjectType);
    assert.equal(openingEvidencePageSubject(subjectType),subjectType);
    for(const tab of ["overview","evidence","history"]){
      assert.equal(detailTabHref(href,tab),href+"&tab="+tab);
    }
    for(const admitted of [path,"/bo/opening-evidence/"+subjectType+"/"+receipt]){
      assert.equal(openingEvidenceBoModule(admitted),"opening-evidence");
      assert.equal(decideHostBoundary(bo,admitted,"GET").action,"next");
      assert.equal(openingEvidenceHostDecision("bo.pinohouse.art",admitted,"GET"),"not_found");
      assert.equal(openingEvidenceHostDecision(bo,admitted,"POST"),"not_found");
    }
    const api="/api/bo/opening-evidence/"+subjectType+"/"+receipt;
    assert.equal(openingEvidenceHostDecision(bo,api,"GET"),"next");
    assert.equal(openingEvidenceHostDecision(bo,api.replace(subjectType,subjectType.toLowerCase()),"GET"),"not_found");
  }
  for(const invalid of ["Class","Reception","other","../class",""]){
    assert.equal(openingEvidencePageSubject(invalid),null);
    assert.equal(openingEvidenceBoModule("/bo/opening-evidence/"+invalid+"/"+receipt),null);
  }
});
