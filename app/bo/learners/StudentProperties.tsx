import type { ReactNode } from "react";
import type { BoLearnerLifecycle } from "@/lib/bo-model";
import { BoProperties } from "../components/BoProperties";
import { BoDataGridStatus } from "../components/data-grid";

export function StudentProperties({ record, compact, nameControl, statusControl }: { record: BoLearnerLifecycle; compact?: boolean; nameControl?: ReactNode; statusControl?: ReactNode }) {
  const student = record.student;
  return <BoProperties compact={compact} items={[
    { key: "name", label: "Tên học viên", value: nameControl ?? student.displayName },
    { key: "status", label: "Trạng thái", value: statusControl ?? <BoDataGridStatus value={student.status} tone={student.status === "ACTIVE" ? "success" : "neutral"} /> },
    { key: "id", label: "Student ID", value: student.id },
    { key: "birthYear", label: "Năm sinh", value: student.birthYear },
    { key: "birthMonth", label: "Tháng sinh", value: student.birthMonth },
    { key: "birthDay", label: "Ngày sinh", value: student.birthDay },
    { key: "birthPrecision", label: "Độ chính xác ngày sinh", value: student.birthPrecision },
    { key: "membership", label: "House member", value: record.houseMembership ? "Có" : "Không" },
    { key: "paths", label: "Chương trình đang học", value: student.activePaths.map(path => path.displayName).join(", ") || "—" },
    { key: "activeSubscriptions", label: "Gói học đang hiệu lực", value: student.activeSubscriptions },
    { key: "subscriptions", label: "Tổng gói học", value: record.subscriptions.length },
    { key: "version", label: "Phiên bản", value: student.version },
  ]} />;
}
