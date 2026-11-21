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
      <div><p className="text-sm">Person · Trạng thái · Nhóm · Lượt sử dụng</p><ul aria-label="Danh sách người tham gia" className="space-y-2">{rows.map(row => <li key={row.id} className="flex items-center justify-between gap-3"><span>{row.personLabel} · {row.status} · {row.group ?? "—"} · {row.usageCount ?? "—"}</span>{onOpen ? <button type="button" onClick={() => onOpen(row.id)} aria-label={`Xem Participation của ${row.personLabel}`}>Xem</button> : null}</li>)}</ul></div>}
  </section>;
}
