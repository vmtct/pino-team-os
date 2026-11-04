import assert from "node:assert/strict";
import test from "node:test";
import { HO_BILLS_API, isHoBillsRequest, parseBillVoid, canVoidBill, type HoBill } from "./ho-bills-contract";
const id="123e4567-e89b-42d3-a456-426614174000";
test("PAP-1422: Founder HO Bills facade admits only list/detail/confirmed Void",()=>{
  assert.equal(isHoBillsRequest(HO_BILLS_API,"GET"),true);
  assert.equal(isHoBillsRequest(HO_BILLS_API,"POST"),false);
  assert.equal(isHoBillsRequest(HO_BILLS_API+"/"+id,"GET"),true);
  assert.equal(isHoBillsRequest(HO_BILLS_API+"/"+id,"PATCH"),false);
  assert.equal(isHoBillsRequest(HO_BILLS_API+"/"+id+"/void","POST"),true);
  for(const suffix of ["/"+id+"/issue","/"+id+"/payment","/"+id+"/void/extra","/not-an-uuid/void"]){
    for(const method of ["GET","POST","PATCH","PUT","DELETE"]){
      assert.equal(isHoBillsRequest(HO_BILLS_API+suffix,method),false,method+suffix);
    }
  }
});
test("PAP-1422: Void command requires confirmation, version, nonempty reason",()=>{
  assert.deepEqual(parseBillVoid({expectedVersion:2,reason:"  Duplicate bill  ",confirmed:true}),{expectedVersion:2,reason:"Duplicate bill",confirmed:true});
  for(const input of [null,{}, {expectedVersion:0,reason:"reason",confirmed:true},{expectedVersion:1,reason:" ",confirmed:true},{expectedVersion:1,reason:"reason",confirmed:false},{expectedVersion:1,reason:"reason",confirmed:true,amountMinor:9999}])assert.equal(parseBillVoid(input),null);
});
test("PAP-1422: never offer Void for paid/partial/voided or confirmed transactions",()=>{
  const bill={bill:{voidedAt:null},paymentState:"OPEN",collectedAmountMinor:0,transactions:[]} as HoBill;
  assert.equal(canVoidBill(bill),true);
  assert.equal(canVoidBill({...bill,paymentState:"PAID"}),false);
  assert.equal(canVoidBill({...bill,paymentState:"PARTIALLY_PAID"}),false);
  assert.equal(canVoidBill({...bill,collectedAmountMinor:1}),false);
  assert.equal(canVoidBill({...bill,bill:{...bill.bill,voidedAt:"2026-11-04T12:00:00Z"}}),false);
  assert.equal(canVoidBill({...bill,transactions:[{status:"CONFIRMED"} as HoBill["transactions"][number]]}),false);
});
