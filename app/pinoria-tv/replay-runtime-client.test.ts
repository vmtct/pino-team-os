import assert from "node:assert/strict";
import {test} from "node:test";
import {pollPendingReplay,loadReplayProjection,acknowledgeRenderedReplay} from "./replay-runtime-client";
const command={id:"019a7680-1200-7000-8000-000000000001",centerId:"center",displayId:"display",sessionId:"session",presentationId:"019a7680-1200-7000-8000-000000000002",revision:4};
test("replay poll reads only server-scoped pending instruction",async()=>{
  const old=globalThis.fetch;const calls:unknown[]=[];
  globalThis.fetch=async(_url,init)=>{calls.push(JSON.parse(String(init?.body)));return Response.json({data:{pending:command}});};
  try{assert.deepEqual(await pollPendingReplay("/runtime"),command);assert.deepEqual(calls,[{op:"replay-pending"}]);}
  finally{globalThis.fetch=old;}
});
test("projection cannot drift to another event",async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({data:{commandId:command.id,revision:4,presentation:{id:"019a7680-1200-7000-8000-000000000003",kind:"WISH_REVEAL",claimedAt:"2026-10-19T14:00:00Z",projection:{}}}});
  try{await assert.rejects(loadReplayProjection("/runtime",command),/does not match/);}
  finally{globalThis.fetch=old;}
});
test("client does not send ACK until called explicitly",async()=>{
  const old=globalThis.fetch;const calls:unknown[]=[];
  globalThis.fetch=async(_url,init)=>{calls.push(JSON.parse(String(init?.body)));return Response.json({data:{acknowledged:true}});};
  try{await acknowledgeRenderedReplay("/runtime",command);assert.deepEqual(calls,[{op:"replay-ack",commandId:command.id,revision:4}]);}
  finally{globalThis.fetch=old;}
});
