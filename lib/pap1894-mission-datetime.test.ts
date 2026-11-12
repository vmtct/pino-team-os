/** PAP-1894 / Epic PAP-1676 — source-truth BO Mission timestamps in PINO ICT presentation. */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { assignmentFields, assignmentProvider, assignmentQuery } from "../app/bo/missions/schema";
import { BoValue } from "../app/bo/components/registration/BoValue";
import type { BoField } from "./bo-registration";

const center="01900000-0000-7000-8000-000000000001";
const id="01900000-0000-7000-8000-000000000002";
const actor="01900000-0000-7000-8000-000000000003";
const assignedAt="2026-11-09T17:30:00.000Z";
const cancelledAt="2026-11-10T19:05:00.000Z";
const row={id,centerId:center,studentId:actor,missionId:id,missionCodeSnapshot:"TEST-ICT",
  missionNameSnapshot:"Kiểm thử datetime PINO",contextKey:"",contextLabel:null,
  status:"CANCELLED" as const, assignedAt,assignedByUserId:actor,
  updatedAt:cancelledAt,updatedByUserId:actor,cancelledAt,cancelledReason:"Thay nhiệm vụ",version:2};
const field=(key:"assignedAt"|"cancelledAt")=>assignmentFields.find(f=>f.key===key)!;
const format=(key:"assignedAt"|"cancelledAt",value:string)=>{
  const f=field(key);
  const viewField={key:f.key,label:f.label,type:f.type,icon:f.icon,w:f.width,readonly:f.readOnly} satisfies BoField;
  return renderToStaticMarkup(createElement(BoValue,{field:viewField,value}));
};
const signal=()=>new AbortController().signal;

test("PAP-1894 BO Table/Drawer/Detail use typed PINO datetime metadata without UTC copy",()=>{
  for(const [key,label] of [["assignedAt","Ngày giao"],["cancelledAt","Ngày hủy"]] as const){
    assert.equal(field(key).type,"datetime");
    assert.equal(field(key).label,label);
    assert.equal(field(key).readOnly,true);
    assert.equal(field(key).capabilities.inlineEdit,false);
  }
});

test("PAP-1894 UTC rollover renders Vietnam-local 24-hour datetime, preserving the instant",()=>{
  assert.equal(format("assignedAt",assignedAt),"10/11/2026 · 00:30");
  assert.equal(format("cancelledAt",cancelledAt),"11/11/2026 · 02:05");
  assert.equal(format("assignedAt","2026-02-28T17:01:00Z"),"01/03/2026 · 00:01");
});

test("PAP-1894 Core null cancellation shows an honest dash, never invented midnight",async()=>{
  const fetcher:typeof fetch=async input=>{
    const url=String(input);
    if(url.startsWith("/api/bo/learners?")) return Response.json({data:[{id:actor,displayName:"An"}]});
    return Response.json({data:[row]});
  };
  const cancelled=await assignmentProvider.list(assignmentQuery,{surface:"BO",centerId:center},fetcher,signal());
  assert.equal(cancelled.records[0]?.row.assignedAt,assignedAt,"Underlying Core ISO stays unchanged");
  assert.equal(cancelled.records[0]?.row.cancelledAt,cancelledAt);
  assert.equal(format("cancelledAt",String(cancelled.records[0]?.row.cancelledAt)),"11/11/2026 · 02:05");
  const pending={...row,status:"ASSIGNED" as const,cancelledAt:null,cancelledReason:null,version:1};
  const assignedFetcher:typeof fetch=async input=>{
    const url=String(input);
    if(url.startsWith("/api/bo/learners?")) return Response.json({data:[{id:actor,displayName:"An"}]});
    if(url.includes("/execution?")) return Response.json({data:{assignmentId:id,centerId:center,assignmentStatus:"ASSIGNED",executionStatus:"IN_PROGRESS",executionVersion:0,updatedAt:null,updatedByUserId:null}});
    return Response.json({data:[pending]});
  };
  const assigned=await assignmentProvider.list(assignmentQuery,{surface:"BO",centerId:center},assignedFetcher,signal());
  assert.equal(assigned.records[0]?.row.cancelledAt,"—");
  assert.equal(format("cancelledAt",String(assigned.records[0]?.row.cancelledAt)),"—");
});
