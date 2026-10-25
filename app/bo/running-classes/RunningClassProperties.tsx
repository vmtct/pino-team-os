import type { ReactNode } from "react";
import type { F3RunningClass } from "@/lib/f3-delivery-api";
import { BoProperties } from "../components/BoProperties";
import { BoDataGridStatus } from "../components/data-grid";

export function RunningClassProperties({ record, centerName, pathName, spaceName, centerTimeZone, compact, nameControl, capacityControl }: {
  record: F3RunningClass; centerName?: string | null; pathName?: string | null; spaceName?: string | null; centerTimeZone?: string | null;
  compact?: boolean; nameControl?: ReactNode; capacityControl?: ReactNode;
}) {
  return <BoProperties compact={compact} items={[
    { key: "name", label: "Tên lớp", value: nameControl ?? record.operationalName },
    { key: "status", label: "Trạng thái", value: <BoDataGridStatus value={record.status} tone={record.status === "ACTIVE" ? "success" : "neutral"} /> },
    { key: "id", label: "Class ID", value: record.id },
    { key: "center", label: "Cơ sở", value: centerName ?? record.centerId },
    { key: "path", label: "Chương trình", value: pathName ?? record.pathProgramId },
    { key: "space", label: "Không gian học", value: spaceName ?? record.learningSpaceId },
    { key: "weekday", label: "Ngày trong tuần (ISO)", value: record.weekdayIso },
    { key: "time", label: "Giờ học", value: `${record.windowStartsLocal}–${record.windowEndsLocal}${centerTimeZone ? ` (${centerTimeZone})` : ""}` },
    { key: "topology", label: "Hình thức lớp", value: record.deliveryTopology },
    { key: "participation", label: "Thời lượng tham gia", value: record.defaultParticipationMinutes == null ? "—" : `${record.defaultParticipationMinutes} phút` },
    { key: "capacity", label: "Sĩ số tối ưu", value: capacityControl ?? record.optimalConcurrentCapacity },
    { key: "hardCapacity", label: "Sĩ số tối đa", value: record.hardConcurrentCapacity },
    { key: "centerId", label: "Center ID", value: record.centerId },
    { key: "pathId", label: "Program ID", value: record.pathProgramId },
    { key: "spaceId", label: "Space ID", value: record.learningSpaceId },
    { key: "version", label: "Phiên bản", value: record.version },
  ]} />;
}
