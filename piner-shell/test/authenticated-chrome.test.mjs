import test from "node:test";
import assert from "node:assert/strict";
import {parseRoute,getShellAdapter} from "../src/adapter.mjs";
import {renderHtml} from "../src/view.mjs";
import {handleRequest} from "../src/worker.mjs";
const model={students:[{id:"synthetic-a",label:"Học viên A"},{id:"synthetic-b",label:"Học viên B"}],selectedId:"synthetic-b"};
const render=(path,memberChrome=model)=>renderHtml(parseRoute(path),getShellAdapter(),{memberChrome});
test("PAP-2194 launcher retains two programs and sign-out",()=>{const html=render("/");assert.equal((html.match(/data-launch-app=/g)||[]).length,2);assert.match(html,/data-sign-out/);});
test("PAP-2194 four canonical tabs and selected student",()=>{for(const path of ["/piner/house","/piner/house/grid","/piner/house/reels","/piner/house/community"]){const html=render(path);assert.equal((html.match(/data-tab=/g)||[]).length,4);assert.match(html,/data-student-id="synthetic-b" aria-selected="true"/);assert.match(html,/data-adapter-state="empty"/);assert.match(html,/data-sign-out/);}});
test("PAP-2194 MyTime has no student options",()=>{const html=render("/piner/mytime");assert.doesNotMatch(html,/synthetic-a|synthetic-b|Học viên A|Học viên B/);assert.match(html,/Chưa kết nối tài khoản MyTime/);});
test("PAP-2194 empty, one, stale selected student and encoding",()=>{assert.match(render("/piner/house",{students:[],selectedId:"stale"}),/Không có học viên liên kết/);assert.match(render("/piner/house",{students:[{id:"a",label:"<img>"}],selectedId:"stale"}),/data-student-id="a" aria-selected="true"/);assert.doesNotMatch(render("/piner/house",{students:[{id:"a",label:"<img>"}]}),/<img>/);assert.doesNotMatch(render("/piner/house",{...model,selectedId:"stale"}),/aria-selected="true"/);});
test("PAP-2194 public worker still fails closed",async()=>{const r=await handleRequest(new Request("https://app.pinohouse.art/piner/house?memberChrome=true"));const html=await r.text();assert.match(html,/data-adapter-state="unauthenticated"/);assert.doesNotMatch(html,/data-member-chrome|data-student-id|data-sign-out/);});

test("PAP-2194 member switcher omits close button; public remains unchanged",async()=>{assert.doesNotMatch(render("/piner/house"),/data-dismiss/);const r=await handleRequest(new Request("https://app.pinohouse.art/piner/house"));assert.match(await r.text(),/data-dismiss/);});

test("PAP-2194 canonical chrome icon-only accessible nav and listbox",()=>{const html=render("/piner/house");assert.equal((html.match(/data-line-icon=/g)||[]).length,4);assert.match(html,/aria-label="Bộ sưu tập" title="Bộ sưu tập"/);assert.doesNotMatch(html,/tab-symbol/);assert.match(html,/role="listbox"/);assert.match(html,/student-check/);});

test("PAP-2194 Student Switcher omits chevron in both states",()=>{const html=render("/piner/house");assert.doesNotMatch(html,/profile-chevron|⌄/);assert.match(html,/aria-haspopup="listbox"/);assert.match(html,/student-check/);});
