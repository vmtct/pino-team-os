// PAP-2360 / PLT-LEAD: seed only for isolated local review and tests.
import type {LeadM1Record} from "./lead-household-presentation";
export * from "./lead-household-presentation";
export const LEAD_M1_FIXTURE: LeadM1Record = {
  id: "LEAD-MOCK-001", fixture: true, contactName: "Nguyễn Thị Minh Anh", phone: "0900000000", lifecycle: "ACTIVE",
  members: [
    { id: "MEM-MOCK-001", name: "Nguyễn Thị Minh Anh", age: 35, gender: "Nữ", roles: ["PARENT"], primaryContact: true },
    { id: "MEM-MOCK-002", name: "Nguyễn Minh Khuê", age: 8, gender: "Nữ", roles: ["STUDENT"], primaryContact: false },
    { id: "MEM-MOCK-003", name: "Nguyễn Bảo Ngọc", age: 6, gender: "Nữ", roles: ["GUEST"], primaryContact: false },
  ],
  relationships: [
    { id: "REL-MOCK-001", fromMemberId: "MEM-MOCK-001", toMemberId: "MEM-MOCK-002", label: "Mẹ", status: "DECLARED" },
    { id: "REL-MOCK-002", fromMemberId: "MEM-MOCK-001", toMemberId: "MEM-MOCK-003", label: "Người giám hộ", status: "DECLARED" },
  ],
  intents: [
    { id: "INT-MOCK-001", kind: "AFTERSCHOOL_ART", source: "PINO Afterschool", memberIds: ["MEM-MOCK-002"], status: "CONTACTED", createdAt: null },
    { id: "INT-MOCK-002", kind: "AFTERSCHOOL_PIANO", source: "PINO Afterschool", memberIds: ["MEM-MOCK-002"], status: "SUBMITTED", createdAt: null },
    { id: "INT-MOCK-003", kind: "MYTIME_ACRYLIC", source: "MyTime by PINO", memberIds: ["MEM-MOCK-003"], status: "SUBMITTED", createdAt: null },
    { id: "INT-MOCK-004", kind: "MYTIME_PIANO", source: "MyTime by PINO", memberIds: ["MEM-MOCK-003"], status: "SUBMITTED", createdAt: null },
  ],
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
};
