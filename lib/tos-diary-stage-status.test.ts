import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {diaryWriteView,type DiaryWriteViewInput} from "./tos-diary-stage-status";

const ready:DiaryWriteViewInput={admitted:true,busy:false,checking:false,ticket:"EMPTY",outcome:null};

test("PAP-1429 Staging admitted Diary must not falsely tell Staff that writes are disabled",()=>{
 const s=diaryWriteView(ready);
 assert.equal(s.label,"Sẵn sàng ghi Staging");
 assert.doesNotMatch(s.message,/chưa gửi|không được gửi|không có dữ liệu nào được gửi/i);
 assert.match(s.message,/Core/);
});
test("PAP-1429 sending, source confirmation and recovered pending ticket have truthful captions",()=>{
 const busy=diaryWriteView({...ready,busy:true,ticket:"PENDING"});
 assert.equal(busy.label,"Đang ghi Nhật ký");
 assert.match(busy.message,/không gửi lại Register/);
 const done=diaryWriteView({...ready,outcome:"LINK_VERIFIED"});
 assert.equal(done.label,"Đã xác minh Core");
 assert.match(done.message,/Mission/);
 const pending=diaryWriteView({...ready,ticket:"PENDING"});
 assert.equal(pending.label,"Cần đối soát bản gửi gốc");
 const incomplete=diaryWriteView({...ready,outcome:"LINK_PENDING"});
 assert.equal(incomplete.label,"Cần đối soát bản gửi gốc");
});
test("PAP-1429 fail-closed state still communicates disabled write precisely",()=>{
 const denied=diaryWriteView({...ready,admitted:false});
 assert.equal(denied.label,"Chưa mở quyền ghi");
 assert.match(denied.message,/chưa được gửi/);
 const unavailable=diaryWriteView({...ready,ticket:"UNAVAILABLE"});
 assert.equal(unavailable.label,"Chưa thể xác minh khóa gửi");
 const checking=diaryWriteView({...ready,checking:true,ticket:"PENDING"});
 assert.equal(checking.label,"Đang đối soát Core");
 const successWithoutAdmission=diaryWriteView({...ready,admitted:false,outcome:"LINK_VERIFIED"});
 assert.equal(successWithoutAdmission.label,"Đã xác minh Core","a confirmed receipt remains truthful after a gate changes");
});

test("PAP-1429 TOS form uses derived status and no unconditional false read-only caption",()=>{
 const ui=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/DiaryCapturePanel.tsx"),"utf8");
 assert.match(ui,/diaryWriteView\(\{/);
 assert.match(ui,/admitted:writeAdmitted/);
 assert.match(ui,/\{writeView\.label\}/);
 assert.match(ui,/\{writeView\.message\}/);
 assert.doesNotMatch(ui,/<span>Chưa mở quyền ghi<\/span>/);
 assert.doesNotMatch(ui,/Biểu mẫu đang hoàn thiện\. Nội dung bạn nhập chưa được lưu/);
});
