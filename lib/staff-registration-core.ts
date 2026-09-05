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
  displayLabel: string;
  email: string;
  password: string;
  mobile: string;
  dateOfBirth: string;
  currentAddress: string;
  governmentIdNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankBranch: string | null;
  governmentIdFront: StaffRegistrationDocumentInput;
  governmentIdBack: StaffRegistrationDocumentInput;
}

export interface StaffRegistrationCoreBinding {
  status(): Promise<StaffRegistrationIntakeState>;
  submit(input: StaffRegistrationSubmissionInput): Promise<{ status: "PENDING" }>;
}

export interface StaffRegistrationEnv {
  PINO_STAFF_REGISTRATION_CORE: StaffRegistrationCoreBinding;
}
