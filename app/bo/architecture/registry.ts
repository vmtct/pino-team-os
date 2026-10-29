import { defineBoModule, defineBoModuleRegistry, type BoModuleContract } from "./contract";

/**
 * MANAGED SOURCE REGISTRY — PAP-926.
 * Add new entities through the canonical generator and implement the domain adapter.
 * The verifier checks these literal declarations without running application code.
 */
export const boModuleRegistry: readonly BoModuleContract[] = defineBoModuleRegistry([
  defineBoModule({
    key: "workforce-shift-plans",
    href: "/bo/workforce-shift-plans",
    label: "Center Shift Plans",
    kind: "entity",
    permissions: { read: "workforce.plan.view", write: "workforce.plan.edit" },
    fields: [
      { key: "id", label: "ID", type: "id", readOnly: true },
      { key: "name", label: "Kế hoạch / Tuần", type: "text", readOnly: true },
      { key: "centerName", label: "Center", type: "text", readOnly: true },
      { key: "termWeekLabel", label: "Tuần", type: "text", readOnly: true },
      { key: "availabilityState", label: "Đăng ký", type: "select", readOnly: true },
      { key: "planningState", label: "Lập lịch", type: "select", readOnly: true },
      { key: "registrationOpen", label: "Mở đăng ký", type: "boolean", readOnly: true },
    ],
    publicViews: "module-shared",
    quickView: "canonical-properties",
    fullDetail: "shared-tabs",
  }),
  defineBoModule({
    key: "workforce-availability",
    href: "/bo/workforce-availability",
    label: "Staff Availability",
    kind: "entity",
    permissions: { read: "workforce.plan.view", write: "workforce.plan.edit" },
    fields: [
      { key: "id", label: "ID", type: "id", readOnly: true },
      { key: "name", label: "Nhân sự", type: "text", readOnly: true },
      { key: "centerName", label: "Center", type: "text", readOnly: true },
      { key: "termWeekLabel", label: "Tuần", type: "text", readOnly: true },
      { key: "status", label: "Trạng thái", type: "select", readOnly: true },
      { key: "shiftCount", label: "Số ca", type: "number", readOnly: true },
    ],
    publicViews: "module-shared",
    quickView: "canonical-properties",
    fullDetail: "shared-tabs",
  }),
  defineBoModule({
    key: "workforce-assignments",
    href: "/bo/workforce-assignments",
    label: "Shift Assignments",
    kind: "entity",
    permissions: { read: "workforce.plan.view", write: "workforce.plan.edit" },
    fields: [
      { key: "id", label: "ID", type: "id", readOnly: true },
      { key: "name", label: "Nhân sự", type: "text", readOnly: true },
      { key: "centerName", label: "Center", type: "text", readOnly: true },
      { key: "termWeekLabel", label: "Tuần", type: "text", readOnly: true },
      { key: "workDate", label: "Ngày", type: "date", readOnly: true },
      { key: "shift", label: "Ca", type: "text", readOnly: true },
      { key: "status", label: "Trạng thái", type: "select", readOnly: true },
      { key: "note", label: "Note ca làm", type: "text", readOnly: true },
    ],
    publicViews: "module-shared",
    quickView: "canonical-properties",
    fullDetail: "shared-tabs",
  }),
  defineBoModule({
    key: "payroll-periods",
    href: "/bo/payroll-periods",
    label: "Kỳ lương",
    kind: "entity",
    permissions: { read: "payroll.period.view", write: "payroll.period.create" },
    fields: [
      { key: "id", label: "ID", type: "id", readOnly: true },
      { key: "name", label: "Kỳ lương", type: "text", readOnly: true },
      { key: "startDate", label: "Bắt đầu", type: "date", readOnly: true },
      { key: "endDate", label: "Kết thúc", type: "date", readOnly: true },
      { key: "centerName", label: "Center", type: "text", readOnly: true },
      { key: "staffCount", label: "PTE có công", type: "number", readOnly: true },
      { key: "expected", label: "Tổng Dự Kiến", type: "currency", readOnly: true },
      { key: "finalized", label: "Tổng Quyết Toán", type: "currency", readOnly: true },
      { key: "status", label: "Trạng thái", type: "select", readOnly: true },
    ],
    publicViews: "module-shared",
    quickView: "canonical-properties",
    fullDetail: "shared-tabs",
  }),
  // BO_NEW_MODULE_REGISTRATIONS — GENERATOR APPENDS ABOVE THIS LINE.
]);

export function requireBoModule(key: string) {
  const entry=boModuleRegistry.find(item=>item.key===key);
  if (!entry) throw new Error(`Unregistered BO module denied: ${key}`);
  return entry;
}

export function requireBoModuleForRoute(route: string) {
  const entry=boModuleRegistry.find(item=>item.href===route);
  if (!entry) throw new Error(`Unregistered BO route denied: ${route}`);
  return entry;
}
