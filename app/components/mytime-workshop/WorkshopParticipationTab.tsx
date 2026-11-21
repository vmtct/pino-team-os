"use client";
/** PAP-2242 · M1 presentation-only participation shell. No Core writes. */
import type {ReactNode} from "react";

export type ParticipationPreview = {
  id: string;
  personLabel: string;
  status: string;
  group?: "Hội họa" | "Piano" | null;
  usageCount?: number | null;
};

export function WorkshopParticipationTab({
  workshopName, rows, canCreate, onCreate, onOpen, unavailable=false
}: {
  workshopName: string;
  rows: readonly ParticipationPreview[];
  canCreate: boolean;
  unavailable?: boolean;
  onCreate?: () => void;
  onOpen?: (participationId: string) => void;
}): ReactNode {
  return <section aria-label="Participation" className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Người tham gia</h2>
        <p className="text-sm">Workshop: {workshopName}</p>
      </div>
      {canCreate && onCreate ? <button type="button" className="primary-btn" onClick={onCreate}>Thêm người tham gia</button> : null}
    </div>
    {unavailable ? <p role="status">Dữ liệu Participation chưa được kết nối với Core. Không thể tạo hoặc xác nhận lượt tham gia tại đây.</p> : rows.length === 0 ? <p role="status">Chưa có người tham gia.</p> :
      <div className="overflow-x-auto"><table className="w-full text-left">
        <thead><tr><th scope="col">Person</th><th scope="col">Trạng thái</th><th scope="col">Nhóm</th><th scope="col">Lượt sử dụng</th><th scope="col">Chi tiết</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{row.personLabel}</td><td>{row.status}</td><td>{row.group ?? "—"}</td><td>{row.usageCount ?? "—"}</td>
          <td>{onOpen ? <button type="button" onClick={() => onOpen(row.id)} aria-label={`Xem Participation của ${row.personLabel}`}>Xem</button> : "—"}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
