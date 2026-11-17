import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/components/tos-vnext/ClassroomV4Presentation.tsx",import.meta.url),"utf8");
test("PAP-2080 dirty photo dismissal retains note and files until explicit confirmation",()=>{
 assert.match(source,/const isPhotoDirty=overlay==="photo"&&appendOpen&&\(draftPhotos\.length>0\|\|draftNote\.length>0\)/);
 assert.match(source,/if\(overlay==="photo"&&\(appendBusy\|\|appendWriteLock\.current\)\)return/);
 assert.match(source,/if\(isPhotoDirty\)\{requestPhotoDiscard\("close"\);return\}/);
 assert.match(source,/const cancelPhotoDraft=.*if\(isPhotoDirty\)\{requestPhotoDiscard\("cancel"\);return\}/);
 assert.match(source,/onClick=\{cancelPhotoDraft\}/);
 assert.match(source,/role="alertdialog" aria-modal="true" aria-label="Bỏ ảnh setup chưa gửi\?"/);
 assert.match(source,/onClick=\{keepPhotoDraft\}>Tiếp tục nhập/);
 assert.match(source,/onClick=\{confirmPhotoDiscard\}>Bỏ thay đổi/);
 assert.match(source,/const confirmPhotoDiscard=.*if\(action==="close"\)finishCloseOverlay\(\);else if\(action==="cancel"\)clearPhotoDraft\(\)/);
});
test("PAP-2080 existing diary guard, Escape and focus trap remain connected",()=>{
 assert.match(source,/if\(overlay==="diary"&&isDiaryDirty\)\{setDiscardConfirm\(true\);return\}/);
 assert.match(source,/if\(photoDiscard\)\{keepPhotoDraft\(\);return\}/);
 assert.match(source,/if\(e\.key==="Escape"\).*closeOverlay\(\)/);
 assert.match(source,/photoDiscard\?document\.querySelector\('\[aria-label="Bỏ ảnh setup chưa gửi\?"\]'\)/);
 assert.match(source,/\[overlay,discardConfirm,isDiaryDirty,photoDiscard,isPhotoDirty,appendBusy\]/);
 assert.match(source,/appendRetry\.current=null;setDraftPhotos\(\[\]\);setDraftNote\(""\);setAppendOpen\(false\)/);
});