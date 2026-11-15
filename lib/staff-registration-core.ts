export interface StaffRegistrationIntakeState {
  enabled: boolean;
}

export interface StaffRegistrationDocumentInput {
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  body: ArrayBuffer;
}

export interface StaffRegistrationSubmissionInput {
  selectedCenterId: string;
  displayLabel: string;
  email: string;
  password: string;
  mobile: string | null;
  dateOfBirth: string | null;
  currentAddress: string | null;
  governmentIdNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  bankBranch: string | null;
  governmentIdFront: StaffRegistrationDocumentInput | null;
  governmentIdBack: StaffRegistrationDocumentInput | null;
}

export interface StaffRegistrationCoreBinding {
  status(): Promise<StaffRegistrationIntakeState>;
  listCenters(): Promise<Array<{id:string;displayName:string}>>;
  submit(input: StaffRegistrationSubmissionInput): Promise<{ status: "PENDING" }>;
}

export interface StaffRegistrationEnv {
  PINO_STAFF_REGISTRATION_CORE: StaffRegistrationCoreBinding;
}
