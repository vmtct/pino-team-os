import test from "node:test";
import assert from "node:assert/strict";
import { createBoPublicViewBrowserRuntime } from "./bo-public-view-browser-runtime";

const contract={moduleKey:"staff",allowedFields:["id","name"],role:"staff" as const};
test("browser Shared Views composition refuses server-side activation",()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window");
  Reflect.deleteProperty(globalThis,"window");
  try { assert.throws(()=>createBoPublicViewBrowserRuntime(contract),/browser context/); }
  finally { if(previous)Object.defineProperty(globalThis,"window",previous); }
});
test("browser Shared Views composition is unloaded and creates no network request",()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,"window");
  Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{origin:"https://bo.pinohouse.art"}}});
  try {
    const runtime=createBoPublicViewBrowserRuntime(contract);
    assert.equal(runtime.getSnapshot().status,"unloaded");
    assert.equal(runtime.getSnapshot().state,null);
    runtime.dispose();
  } finally { if(previous)Object.defineProperty(globalThis,"window",previous);else Reflect.deleteProperty(globalThis,"window"); }
});