import assert from "node:assert/strict";
import test from "node:test";
import {createCameraStreamLease} from "./pap1612-camera-stream";
function fake(){let stops=0;return {stream:{getTracks:()=>[{stop:()=>{stops++;}}]},stops:()=>stops};}
test("PAP-1612 late acquisition after cancellation stops immediately",()=>{const lease=createCameraStreamLease(),token=lease.begin(),a=fake();lease.release();assert.equal(lease.accept(token,a.stream),false);assert.equal(a.stops(),1);});
test("PAP-1612 retry supersedes prior pending acquisition without disturbing current stream",()=>{const lease=createCameraStreamLease(),first=lease.begin(),second=lease.begin(),a=fake(),b=fake();assert.equal(lease.accept(second,b.stream),true);assert.equal(lease.accept(first,a.stream),false);assert.equal(a.stops(),1);assert.equal(b.stops(),0);lease.release();lease.release();assert.equal(b.stops(),1);});
test("PAP-1612 begin releases current stream and invalidates old completion",()=>{const lease=createCameraStreamLease(),token=lease.begin(),a=fake();assert.equal(lease.accept(token,a.stream),true);const next=lease.begin();assert.equal(a.stops(),1);assert.equal(lease.isCurrent(token),false);assert.equal(lease.isCurrent(next),true);});
