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

export interface BoContext {
  userId: string;
  email: string;
  staffMemberId: string | null;
  surface: "BO";
  entitled: true;
}
