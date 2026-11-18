import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {verifyWishItemPreview} from "./wish-item-preview";
const target={itemId:"019a0000-0000-7000-8000-000000000001",revision:2};
const bytes=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=","base64"),blob=new Blob([bytes],{type:"image/png"});
const metadata={...target,status:"PUBLISHED",itemType:"WEARABLE",name:"QA Item",mimeType:"image/png",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
test("preview verifies exact immutable Item revision and actual bytes",async()=>{
 const r=await verifyWishItemPreview(target,metadata,blob);assert.equal(r.revision,2);assert.equal(r.name,"QA Item");
 for(const m of [{...metadata,revision:3},{...metadata,status:"DRAFT"},{...metadata,itemType:"SET"},{...metadata,sha256:"a".repeat(64)},{...metadata,byteSize:1},{...metadata,itemId:"019a0000-0000-7000-8000-000000000009"}])await assert.rejects(verifyWishItemPreview(target,m,blob));
 await assert.rejects(verifyWishItemPreview(target,metadata,new Blob([bytes],{type:"image/svg+xml"})));
});
