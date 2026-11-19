import {describe,it} from "node:test";
import assert from "node:assert/strict";
import {workshopReferenceCodec} from "../app/components/mytime-workshop/reference-codec";
const id=(n:number)=>"01a03c6e-cc58-7d81-ac8e-"+String(n).padStart(12,"0");
describe("PAP-2164 stable Workshop references",()=>{
 it("never confuses duplicate staff display names or a label that resembles another token",()=>{
  const first=id(1),second=id(2),third=id(3);
  const c=workshopReferenceCodec([{id:first,label:"Nguyễn An"},{id:second,label:"Nguyễn An"},{id:third,label:"Nguyễn An · "+first.slice(-8)}],[]);
  assert.equal(new Set(c.options).size,3);
  for(const i of [first,second,third])assert.equal(c.resolve(c.display(i)),i);
 });
 it("retains historical identity only when already selected; never offers inactive references",()=>{
  const c=workshopReferenceCodec([{id:id(1),label:"Active"}],[{id:id(2),label:"Old"},{id:id(3),label:null}]);
  assert.deepEqual(c.options,["Active"]);assert.equal(c.display(id(2)),"Old");
  assert.throws(()=>c.resolve("Old"));assert.equal(c.resolve("Old",id(2)),id(2));
  assert.deepEqual(c.resolveMany([c.display(id(2)),c.display(id(1))],[id(2)]),[id(1),id(2)]);
  assert.throws(()=>c.resolveMany([c.display(id(1)),c.display(id(1))]));
  assert.throws(()=>c.resolve("unknown"));
 });
});
