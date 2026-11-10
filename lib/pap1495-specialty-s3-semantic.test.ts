import test from "node:test";
import assert from "node:assert/strict";
import {specialtyFields,specialtyStatusLabel,specialtyProvider,specialtyQuery} from "../app/ho/learning/specialties/schema";
const canonical=["little-piner-art","little-piner-piano","artchitect","pianohouse"];
const ids=["11234567-89ab-7cde-8fab-0123456789ab","21234567-89ab-7cde-8fab-0123456789ab","31234567-89ab-7cde-8fab-0123456789ab","41234567-89ab-7cde-8fab-0123456789ab"];
const summary={id:"01234567-89ab-7cde-8fab-0123456789ab",pathProgramId:ids[0],name:"Anime",description:"Mô tả",status:"DRAFT",tags:["Anime"],version:1,missionCountDistinct:0};
test("PAP-1495 (PAP-1491) S3 field semantics consume DS badges without extra CSS",()=>{
 const m=Object.fromEntries(specialtyFields.map(f=>[f.key,f]));
 assert.equal(m.path.type,"relation");assert.equal(m.status.type,"select");assert.equal(m.description.type,"textarea");assert.equal(m.tagView.type,"multiselect");
 assert.equal(specialtyStatusLabel("DRAFT"),"Bản nháp");
 assert.equal(specialtyStatusLabel("ACTIVE"),"Đang áp dụng");
 assert.equal(specialtyStatusLabel("ARCHIVED"),"Đã lưu trữ");
 assert.equal(specialtyQuery.visible.length,11);
});
test("PAP-1495 S3 Core path label and typed tag array; Core status DTO untouched",async()=>{
 const fetcher:typeof fetch=async u=>Response.json({data:String(u).endsWith("path-options")?canonical.map((code,i)=>({id:ids[i],code,label:["Little Piner Art","Little Piner Piano","Artchitect","PianoHouse"][i]})):[summary]});
 const r=await specialtyProvider.list(specialtyQuery,{surface:"HO"},fetcher,new AbortController().signal);
 assert.equal(r.total,1);assert.equal(r.records[0].row.status,"Bản nháp");assert.equal(r.records[0].row.path,"Little Piner Art");
 assert.deepEqual(r.records[0].row.tagView,["Anime"]);
});
