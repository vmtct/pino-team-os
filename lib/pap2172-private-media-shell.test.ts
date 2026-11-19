/** PAP-2172 — local candidate content/validation, not authenticated UI or G4. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {renderToStaticMarkup} from "react-dom/server";
import {privateMediaSlot,validatePrivateMediaSelection,PRIVATE_MEDIA_MAX_BYTES} from "../app/bo/piner-posts/private-media-shell";
import {checkedSlotContent} from "../app/components/workspace-renderer/Slots";
const noop=()=>{};
const actions={select:noop,preview:noop,closePreview:noop,remove:noop,retry:noop};
const row={id:"fixture-1",name:"QA image.png",bytes:1024,state:"ready"} as const;
const render=(state:Parameters<typeof privateMediaSlot>[0])=>renderToStaticMarkup(checkedSlotContent(privateMediaSlot(state,actions)));
test("PAP-2172 count, type, size exact boundary",()=>{
 assert.equal(validatePrivateMediaSelection([{type:"image/png",size:PRIVATE_MEDIA_MAX_BYTES}],4),null);
 assert.ok(validatePrivateMediaSelection([{type:"image/png",size:1}],5));
 assert.ok(validatePrivateMediaSelection([{type:"image/png",size:PRIVATE_MEDIA_MAX_BYTES+1}],0));
 assert.ok(validatePrivateMediaSelection([{type:"image/svg+xml",size:1}],0));
 assert.ok(validatePrivateMediaSelection([{type:"image/png",size:0}],0));
 assert.ok(validatePrivateMediaSelection([{type:"image/jpeg",size:1}],-1));
});
test("native content states and capability boundary",()=>{
 assert.match(render({status:"loading"}),/Đang tải ảnh/);
 assert.doesNotMatch(render({status:"denied"}),/type="file"|Xem ảnh|Gỡ ảnh/);
 assert.match(render({status:"error"}),/Thử lại/);
 assert.match(render({status:"ready",rows:[],canEdit:true,busy:false}),/Chưa có ảnh/);
 assert.doesNotMatch(render({status:"ready",rows:[row],canEdit:false,busy:false}),/type="file"|Gỡ ảnh/);
 assert.match(render({status:"ready",rows:[row],canEdit:true,busy:true}),/disabled/);
});
test("private blob-only preview of existing ready row",()=>{
 const state={status:"ready",rows:[row],canEdit:true,busy:false} as const;
 assert.match(render({...state,preview:{id:row.id,url:"blob:http://local/fixture"}}),/src="blob:/);
 assert.doesNotMatch(render({...state,preview:{id:row.id,url:"https://example.com/fixture"}}),/<img/);
 assert.doesNotMatch(render({...state,preview:{id:"other",url:"blob:http://local/fixture"}}),/<img/);
});
