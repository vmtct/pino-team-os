import test from "node:test";
import assert from "node:assert/strict";
import { comparePixelBuffers } from "./tdd-g3-visual-pixels.mjs";

test("identical RGBA screenshot has zero changed pixels", () => {
  const data=Buffer.from([30,40,50,255,70,80,90,255]);
  assert.deepEqual(comparePixelBuffers(data,data),{changed:0,total:2,ratio:0});
});
test("small anti-alias color variation stays below tolerance", () => {
  const original=Buffer.from([30,40,50,255]);
  const modified=Buffer.from([49,59,69,255]);
  assert.equal(comparePixelBuffers(original,modified).changed,0);
});
test("large visual changes count as one changed pixel per RGBA", () => {
  const original=Buffer.from([0,0,0,255,0,0,0,255]);
  const modified=Buffer.from([255,0,0,255,0,0,0,255]);
  assert.deepEqual(comparePixelBuffers(original,modified),{changed:1,total:2,ratio:0.5});
});
test("alpha changes are detected and do not disappear",()=>{
  const original=Buffer.from([0,0,0,255]);
  const modified=Buffer.from([0,0,0,0]);
  assert.equal(comparePixelBuffers(original,modified).changed,1);
});
test("invalid dimensions and unsupported settings fail closed",()=>{
  assert.throws(()=>comparePixelBuffers(Buffer.alloc(4),Buffer.alloc(8)));
  assert.throws(()=>comparePixelBuffers(Buffer.alloc(5),Buffer.alloc(5)));
  assert.throws(()=>comparePixelBuffers(Buffer.alloc(4),Buffer.alloc(4),{channels:3}));
});
