import assert from "node:assert/strict";
import { test } from "node:test";
import { handleWorkforcePhotoUpload, readCameraPhotoBytes, MAX_CAMERA_PHOTO_BYTES } from "./workforce-photo-upload-handler";

const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const clientUploadKey = "1234567890abcdef1234567890abcdef";
const url = `https://tos.example/api/workforce/timekeeping/photo/upload?sessionId=${sessionId}&clientUploadKey=${clientUploadKey}`;
const jpeg=(count:number)=>{const bytes=new Uint8Array(count);bytes.set([255,216,255,224],0);return bytes;};
const req=(body:Uint8Array,mime="image/jpeg",inputUrl=url)=>new Request(inputUrl,{method:"POST",headers:{"content-type":mime},body:new Blob([Uint8Array.from(body)])});

test("PAP-1431 camera JPEG payload is byte bounded",async()=>{
 const bytes=await readCameraPhotoBytes(req(jpeg(128)));
 assert.equal(bytes.byteLength,128);
});
test("PAP-1431 refuses oversized body even with no Content-Length",async()=>{
 await assert.rejects(readCameraPhotoBytes(req(jpeg(MAX_CAMERA_PHOTO_BYTES+1))),/PHOTO_TOO_LARGE/);
});
test("PAP-1431 refuses wrong media type before authentication or Core call",async()=>{
 const response=await handleWorkforcePhotoUpload(req(jpeg(128),"image/png"),{} as never);
 assert.equal(response.status,400);
 assert.equal((await response.json()).error.code,"PHOTO_INVALID_INPUT");
});
test("PAP-1431 refuses missing or wrong session before authentication",async()=>{
 const response=await handleWorkforcePhotoUpload(req(jpeg(128),"image/jpeg","https://tos.example/api/workforce/timekeeping/photo/upload?sessionId=bad&clientUploadKey=1234567890abcdef"),{} as never);
 assert.equal(response.status,400);
});
test("PAP-1431 refuses media signature spoofing before authentication",async()=>{
 const response=await handleWorkforcePhotoUpload(req(new Uint8Array(128)),{} as never);
 assert.equal(response.status,400);
});
