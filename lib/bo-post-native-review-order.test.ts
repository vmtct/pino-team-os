import {test} from "node:test";
import assert from "node:assert/strict";
import {verifiedSubmittedOrder} from "../app/bo/piner-posts/native-review-order";
test("PAP-2386 pending order retains exact immutable cover and rejects stale or incomplete readback",()=>{
 const listing={postVersion:6,mediaCount:2,attachments:[{id:"a",state:"READY"},{id:"b",state:"READY"}]};
 assert.deepEqual(verifiedSubmittedOrder(["b","a"],6,listing),["b","a"]);
 for(const ids of [null,[],["a"],["a","a"],["a","c"]])assert.throws(()=>verifiedSubmittedOrder(ids,6,listing));
 assert.throws(()=>verifiedSubmittedOrder(["b","a"],5,listing));
 assert.throws(()=>verifiedSubmittedOrder(["b","a"],6,{...listing,attachments:[{id:"a",state:"RESERVED"},listing.attachments[1]!]}));
});
