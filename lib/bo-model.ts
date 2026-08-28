export interface BoCenter {
  id: string;
  key: string;
  displayName: string;
  timeZone: string;
  status: string;
}

export interface BoPathProgram {
  id: string;
  code: string;
  displayName: string;
  status: string;
}

export interface BoRunningClass {
  id: string;
  name: string;
  pathProgramId: string;
  timezone: "Asia/Ho_Chi_Minh";
  recurrenceWeekdays: number[];
  startLocalTime: string;
  endLocalTime: string;
  defaultCapacity: number;
  status: string;
}

export interface BoSyllabus {
  id: string;
  pathProgramId: string;
  curriculumWeek: number;
  title: string;
  shortDescription: string | null;
  skillSummary: string | null;
  ageMin: number | null;
  ageMax: number | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  publicationStatus: string;
}

export interface BoSession {
  id: string;
  runningClassId: string | null;
  pathProgramId: string | null;
  syllabusId: string | null;
  localDate: string | null;
  startsAt: string;
  endsAt: string;
  bookingOpensAt: string;
  bookingClosesAt: string;
  availability: { capacity: number; remainingSeats: number; isFull: boolean };
  registrationCount: number;
  accessOffers: Array<{ offerType: string }>;
  status: string;
}

export interface BoSessionLearningOwner {
  sessionId: string;
  staffMemberId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignmentSource: "OPERATOR" | "MIGRATION";
  changeReason: string | null;
  updatedAt: string;
  version: number;
}

export interface BoSessionLearningOwnerProjection {
  sessionId: string;
  owner: BoSessionLearningOwner | null;
}

export interface BoSessionLearningOwnerCommand {
  staffMemberId: string;
  expectedVersion?: number;
  reason?: string;
}

export interface BoRegistration {
  id: string;
  sessionId: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  childName: string;
  childDateOfBirth: string | null;
  canonicalStudentId: string | null;
  createdAt: string;
}

export interface BoAccessRole {
  id: string;
  roleKey: string;
  displayName: string;
  roleType: "system" | "custom";
  status: "active" | "archived";
  description: string | null;
  permissionCount: number;
  assignmentCount: number;
}

export interface BoAccessAssignment {
  assignmentId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
  scopeId: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface BoAccessUser {
  id: string;
  staffMemberId: string | null;
  status: string;
  email: string | null;
  assignments: BoAccessAssignment[];
}

export interface BoStaffRecord {
  id: string;
  displayLabel: string;
  status: "active" | "inactive";
  department: string | null;
  roleLabel: string | null;
}

export type BoStaffOnboardingCommand =
  | { commandType: "ONBOARD_STAFF_RECORD_ONLY"; staff: { displayLabel: string; email?: string; mobile?: string; department?: string; roleLabel?: string; employmentType?: string; startDate?: string } }
  | { commandType: "ONBOARD_STAFF_WITH_ACCESS"; staff: { displayLabel: string; email?: string; mobile?: string; department?: string; roleLabel?: string; employmentType?: string; startDate?: string }; email: string; assignments: BoStaffAccessAssignmentInput[]; pin?: string }
  | { commandType: "PROVISION_ACCESS_FOR_STAFF"; staffMemberId: string; email: string; assignments: BoStaffAccessAssignmentInput[] };

export interface BoStaffAccessAssignmentInput {
  roleId: string;
  scopeType: "GLOBAL" | "CENTER" | "PATH" | "RUNNING_CLASS";
  scopeId: string | null;
}

export interface BoStaffOnboardingResult {
  commandType: BoStaffOnboardingCommand["commandType"];
  staffMemberId: string;
  userId?: string;
  externalIdentityId?: string;
  assignmentIds: string[];
  accessState: "NOT_PROVISIONED" | "PROVISIONED_AWAITING_LOGIN";
}

export interface BoContext {
  userId: string;
  email: string;
  staffMemberId: string | null;
  surface: "BO";
  entitled: true;
}
