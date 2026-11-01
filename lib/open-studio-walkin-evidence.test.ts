import test from "node:test";
import assert from "node:assert/strict";
import {ePassPhotoError,hasRequiredEPassPhoto,MAX_EPASS_IMAGE_BYTES} from "./open-studio-walkin-evidence";

test("PAP-1313 photo and PH consent are mandatory, never silently skipped",()=>{
 const valid={type:"image/png",size:50000};
 assert.equal(hasRequiredEPassPhoto(null,true),false);
 assert.equal(hasRequiredEPassPhoto(valid,false),false);
 assert.equal(hasRequiredEPassPhoto(valid,true),true);
 assert.equal(hasRequiredEPassPhoto({...valid,type:"text/plain"},true),false);
 assert.equal(hasRequiredEPassPhoto({...valid,size:0},true),false);
 assert.equal(hasRequiredEPassPhoto({...valid,size:MAX_EPASS_IMAGE_BYTES+1},true),false);
 assert.match(ePassPhotoError(null)??"",/Bắt buộc/);
});
