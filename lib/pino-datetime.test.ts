/** PAP-1895 / PAP-1820 / Epic PAP-1676 — deterministic PINO_DATETIME_V1 contract. */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PINO_DATETIME_CONTRACT, formatPinoDateTime, formatPinoDateOnly, formatPinoTimeOnly } from "./pino-datetime";
import { BoValue } from "../app/bo/components/registration/BoValue";
import type { BoField } from "./bo-registration";
const field={key:"assignedAt",label:"Ngày giao",type:"datetime",icon:"▦"} as BoField;
const render=(value:string|null)=>renderToStaticMarkup(createElement(BoValue,{field,value}));

test("PAP-1895 PINO_DATETIME_V1 parses UTC and offset instants into ICT, never browser locale",()=>{
  assert.equal(PINO_DATETIME_CONTRACT,"PINO_DATETIME_V1");
  assert.equal(formatPinoDateTime("2026-11-10T08:10:06.835Z"),"10/11/2026 · 15:10");
  assert.equal(formatPinoDateTime("2026-11-10T15:10:06+07:00"),"10/11/2026 · 15:10");
  assert.equal(formatPinoDateTime("2026-11-09T17:30:00Z"),"10/11/2026 · 00:30");
  assert.equal(formatPinoDateTime("2026-11-09T23:55:00Z"),"10/11/2026 · 06:55");
  assert.equal(formatPinoDateTime("2024-02-29T23:59:00Z"),"01/03/2024 · 06:59");
});
test("PAP-1895 reject invalid ISO, calendar normalization, missing/unauthorized and date-only fake time",()=>{
  for(const value of [null,undefined,"",0,{},"x","2026-02-30T01:00:00Z",
    "2026-13-01T01:00:00Z","2026-11-31T01:00:00Z","2026-11-12T25:00:00Z",
    "2026-11-12T00:61:00Z","2026-11-12T00:00:60Z",
    "2026-11-12T00:00:00+24:00","2026-11-10",
    "2026-11-10T15:10:06","1970-00-00T00:00:00Z"]){
    assert.equal(formatPinoDateTime(value),"—",String(value));
  }
  assert.equal(render("2026-11-10T08:10:06.835Z"),"10/11/2026 · 15:10");
  assert.match(render(null),/>—</);
  assert.equal(render("invalid-date"),"—");
});
test("PAP-1895 date-only and time-only values never invent an hour or timezone shift",()=>{
  assert.equal(formatPinoDateOnly("2024-02-29"),"29/02/2024");
  assert.equal(formatPinoDateOnly("2026-11-10"),"10/11/2026");
  assert.equal(formatPinoDateOnly("2026-02-29"),"—");
  assert.equal(formatPinoDateOnly("2026-11-10T00:00:00Z"),"—");
  assert.equal(formatPinoTimeOnly("09:05"),"09:05");
  assert.equal(formatPinoTimeOnly("23:59"),"23:59");
  assert.equal(formatPinoTimeOnly("24:00"),"—");
  assert.equal(formatPinoTimeOnly("9:05"),"—");
});
