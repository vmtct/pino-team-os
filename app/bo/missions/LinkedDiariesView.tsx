import type { ReactNode } from "react";
import type { LinkedMissionDiary } from "@/lib/bo-mission-linked-diaries";

/** PAP-1193: pure read-only content inside TDD's business tab; no second shell/actions. */
export function missionLinkedDiaryContent(rows: readonly LinkedMissionDiary[]): ReactNode {
 if (!rows.length) return <section className="v24-prop-section">
  <p role="status">Chưa có Nhật Ký nào liên kết trực tiếp với lần giao nhiệm vụ này.</p>
 </section>;
 return <section className="v24-prop-section">
  <h3>Nhật Ký đã liên kết</h3>
  <div className="table-scroll">
   <table>
    <caption>Nhật Ký theo nhiệm vụ được giao</caption>
    <thead><tr><th>Ngày ghi</th><th>Diary ID</th><th>Bối cảnh dạy</th>
     <th>Lớp</th><th>Giáo viên</th><th>Trạng thái</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.linkId}>
     <td>{row.registeredAt??"—"}</td>
     <td>{row.diaryId}</td>
     <td>{row.teachingContextKey||"—"}</td>
     <td>{row.runningClassId??"—"}</td>
     <td>{row.registeredByUserId??"—"}</td>
     <td>{row.status==="CLOSED"?"Đã đóng":"Đã ghi"}</td>
    </tr>)}</tbody>
   </table>
  </div>
 </section>;
}
