export type ToppiProgramCode = "CC" | "LF";
export type PackageStatus = "ACTIVE" | "COMPLETED" | "DRAFT";
export type RenewalStatus = "NONE" | "DUE_SOON" | "AWAITING_RENEWAL" | "CONTINUITY_EXPIRING";

export type MockStudent = {
  id: string;
  displayName: string;
  guardianName: string;
  guardianContact: string;
  pinoria: "ACTIVE" | "NOT_STARTED";
  pinoHouse: string | null;
};

export type MockDeliverySlot = {
  id: string;
  label: string;
  weekday: string;
  time: string;
  capacity: number;
  occupied: number;
};

export type MockEnrollment = {
  id: string;
  studentId: string;
  program: ToppiProgramCode;
  level: number;
  unit: number;
  slotId: string;
  packageStatus: PackageStatus;
  renewalStatus: RenewalStatus;
  projectedCompletion: string;
  startedOn: string;
};

export const mockStudents: MockStudent[] = [
  {
    id: "stu-bo",
    displayName: "Bơ Nguyễn",
    guardianName: "Mai Nguyễn",
    guardianContact: "090 123 4567",
    pinoria: "ACTIVE",
    pinoHouse: "Piano · active",
  },
  {
    id: "stu-mia",
    displayName: "Mía Trần",
    guardianName: "Hà Trần",
    guardianContact: "091 234 5678",
    pinoria: "ACTIVE",
    pinoHouse: "Art · active",
  },
  {
    id: "stu-soc",
    displayName: "Sóc Lê",
    guardianName: "Vy Lê",
    guardianContact: "093 345 6789",
    pinoria: "ACTIVE",
    pinoHouse: null,
  },
  {
    id: "stu-na",
    displayName: "Na Phạm",
    guardianName: "An Phạm",
    guardianContact: "098 456 7890",
    pinoria: "NOT_STARTED",
    pinoHouse: null,
  },
  {
    id: "stu-ti",
    displayName: "Tí Võ",
    guardianName: "Minh Võ",
    guardianContact: "097 567 8901",
    pinoria: "ACTIVE",
    pinoHouse: "Little Piner · inactive",
  },
];

export const mockSlots: MockDeliverySlot[] = [
  { id: "slot-thu-1800", label: "Thu · 18:00–19:30", weekday: "Thu", time: "18:00–19:30", capacity: 10, occupied: 7 },
  { id: "slot-thu-1930", label: "Thu · 19:30–21:00", weekday: "Thu", time: "19:30–21:00", capacity: 10, occupied: 6 },
  { id: "slot-sat-1800", label: "T7 · 18:00–19:30", weekday: "T7", time: "18:00–19:30", capacity: 10, occupied: 8 },
  { id: "slot-sat-1930", label: "T7 · 19:30–21:00", weekday: "T7", time: "19:30–21:00", capacity: 10, occupied: 5 },
];

export const mockEnrollments: MockEnrollment[] = [
  {
    id: "enr-bo-cc4",
    studentId: "stu-bo",
    program: "CC",
    level: 4,
    unit: 7,
    slotId: "slot-thu-1800",
    packageStatus: "ACTIVE",
    renewalStatus: "NONE",
    projectedCompletion: "15 Oct 2026",
    startedOn: "30 Jul 2026",
  },
  {
    id: "enr-mia-lf2",
    studentId: "stu-mia",
    program: "LF",
    level: 2,
    unit: 11,
    slotId: "slot-sat-1800",
    packageStatus: "ACTIVE",
    renewalStatus: "DUE_SOON",
    projectedCompletion: "05 Sep 2026",
    startedOn: "20 Jun 2026",
  },
  {
    id: "enr-soc-cc6",
    studentId: "stu-soc",
    program: "CC",
    level: 6,
    unit: 12,
    slotId: "slot-thu-1930",
    packageStatus: "COMPLETED",
    renewalStatus: "AWAITING_RENEWAL",
    projectedCompletion: "27 Aug 2026",
    startedOn: "11 Jun 2026",
  },
  {
    id: "enr-na-lf8",
    studentId: "stu-na",
    program: "LF",
    level: 8,
    unit: 4,
    slotId: "slot-sat-1930",
    packageStatus: "ACTIVE",
    renewalStatus: "NONE",
    projectedCompletion: "24 Oct 2026",
    startedOn: "01 Aug 2026",
  },
];

export function programName(program: ToppiProgramCode) {
  return program === "CC" ? "Confident Communication" : "Language Foundation";
}

export function stageName(program: ToppiProgramCode, level: number) {
  if (program === "CC") {
    if (level <= 3) return "Spark";
    if (level <= 6) return "Connect";
    return "Present";
  }
  if (level <= 3) return "Core";
  if (level <= 6) return "Expand";
  return "Master";
}

export function studentFor(id: string) {
  return mockStudents.find((student) => student.id === id);
}

export function slotFor(id: string) {
  return mockSlots.find((slot) => slot.id === id);
}

export const mockRegistrations = [
  { id: "reg-01", learner: "Lúa Đỗ", guardian: "Lan Đỗ", program: "CC" as const, status: "TRIAL", preferredSlot: "Thu · 18:00–19:30" },
  { id: "reg-02", learner: "Mây Bùi", guardian: "Thu Bùi", program: "LF" as const, status: "PLACEMENT", preferredSlot: "T7 · 18:00–19:30" },
  { id: "reg-03", learner: "Cốm Nguyễn", guardian: "Tâm Nguyễn", program: "CC" as const, status: "FOLLOW_UP", preferredSlot: "Thu · 19:30–21:00" },
];
