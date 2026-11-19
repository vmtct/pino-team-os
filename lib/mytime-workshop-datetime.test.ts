// PAP-2199: native create presentation and editor input roundtrip, no live calls.
import {test} from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {BoValue} from "../app/bo/components/registration/BoValue";
import {ictWorkshopInstant} from "../app/components/mytime-workshop/api-client";
import {workshopEditorValue} from "../app/components/mytime-workshop/datetime";
import {checkWorkshop,type WorkshopInput} from "../app/components/mytime-workshop/WorkshopWorkspace";
import type {BoField} from "./bo-registration";
const field:BoField={key:"startAt",label:"Bắt đầu",type:"datetime",icon:"",w:180};
test("PAP-2199 draft shows canonical PINO time and reopens as ICT while retaining instant",()=>{
 for(const [wall,expected] of [["2026-11-29T14:00","29/11/2026 · 14:00"],["2026-11-30T00:15","30/11/2026 · 00:15"]]){
  const saved=ictWorkshopInstant(wall);
  assert.equal(renderToStaticMarkup(createElement(BoValue,{field,value:saved})),expected);
  const local=workshopEditorValue(field,saved);assert.equal(String(local).slice(0,16),wall);assert.equal(ictWorkshopInstant(String(local)),saved);
 }
 const exact="2026-11-29T07:00:12.345Z";
 assert.equal(ictWorkshopInstant(String(workshopEditorValue(field,exact))),exact);
 assert.equal(workshopEditorValue({...field,key:"updatedAt"},exact),undefined);
 assert.equal(workshopEditorValue(field,""),"");
});
test("PAP-2199 start/end order compares canonical instants, including mixed ISO and wall-clock",()=>{
 const row:WorkshopInput={name:"QA",center:"QA",startAt:"2026-11-29T07:00:00.000Z",endAt:"2026-11-29T15:00",missions:["QA"],specialty:null,capacity:null,eventLead:null,academicLead:null,otherStaff:[],facebookUrl:null,note:null};
 assert.equal(checkWorkshop(row),"");
 assert.notEqual(checkWorkshop({...row,endAt:"2026-11-29T14:00"}),"");
 assert.notEqual(checkWorkshop({...row,endAt:"2026-11-29T13:59"}),"");
 assert.notEqual(checkWorkshop({...row,endAt:"2026-02-30T14:00"}),"");
 assert.notEqual(checkWorkshop({...row,startAt:""}),"");
});
