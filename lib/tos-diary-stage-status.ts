/** PAP-1429 / platform Epic PAP-938, business Epic PAP-727.
 * Presentation-only status for a source-authorized Staging Diary writer.
 * This never admits a write; Core, confirmed Skip, roster and Mission remain gates.
 */
export type DiaryWriteViewInput={
 admitted:boolean;
 busy:boolean;
 checking:boolean;
 ticket:"EMPTY"|"PENDING"|"UNAVAILABLE";
 outcome:"REGISTER_UNCERTAIN"|"OBSERVATION_PENDING"|"LINK_PENDING"|"LINK_VERIFIED"|null;
};
export type DiaryWriteView={label:string;message:string};

export function diaryWriteView(input:DiaryWriteViewInput):DiaryWriteView{
 if(input.outcome==="LINK_VERIFIED")
  return {label:"Đã xác minh Core",
   message:"Core đã lưu ghi chú và xác nhận các liên kết Mission trên cùng Diary. Không phát sinh bản ghi trùng."};
 if(input.busy)
  return {label:"Đang ghi Nhật ký",
   message:"Lệnh ghi đang được Core xử lý. Giữ nguyên lượt gửi và chờ biên nhận, không gửi lại Register."};
 if(input.checking)
  return {label:"Đang đối soát Core",
   message:"Đang đọc biên nhận và liên kết từ Core. Không tạo thêm Diary hoặc tự retry Register."};
 if(input.outcome!==null||input.ticket==="PENDING")
  return {label:"Cần đối soát bản gửi gốc",
   message:"Nhật ký có thể đã được Core ghi nhận. Hãy dùng đúng biên nhận gốc hoặc Diary ID để xác minh; không tạo bản thứ hai."};
 if(input.ticket==="UNAVAILABLE")
  return {label:"Chưa thể xác minh khóa gửi",
   message:"Không kiểm tra được khóa gửi gốc của tab, nên chức năng tạo Nhật ký bị khóa để tránh bản ghi trùng."};
 if(input.admitted)
  return {label:"Sẵn sàng ghi Staging",
   message:"Chỉ ghi Nhật ký sau khi Staff, Center, lớp, roster, Mission và điều kiện Skip được xác minh. Core là nguồn xác nhận cuối cùng."};
 return {label:"Chưa mở quyền ghi",
  message:"Chỉ xem hoặc chưa đủ điều kiện ghi Nhật ký. Nội dung nhập chưa được gửi đến Core."};
}
