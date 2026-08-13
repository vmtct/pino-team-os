import { getPage, updatePageProperties } from "@/lib/notion";
import { dateStartProp, selectProp, textProp } from "@/lib/notion/properties";
import type { Staff } from "@/lib/domain/staff";
import type { NotionPage } from "@/lib/notion/types";

export const REQUIRED_STAFF_PROFILE_FIELDS = [
  "Email",
  "Date of Birth",
  "Gender",
  "CCCD",
  "ID Issue Date",
  "ID Issue Place",
  "LEG Address",
  "ID Documents",
] as const;

export type StaffProfile = {
  email: string;
  dateOfBirth: string;
  gender: string;
  cccd: string;
  idIssueDate: string;
  idIssuePlace: string;
  address: string;
  idDocuments: number;
  employmentType: string;
  department: string;
  startDate: string;
  role: string;
};

export type StaffProfileField = keyof StaffProfile;

export const STAFF_PROFILE_LABELS: Record<StaffProfileField, string> = {
  email: "Email",
  dateOfBirth: "Ngày sinh",
  gender: "Giới tính",
  cccd: "CCCD",
  idIssueDate: "Ngày cấp CCCD",
  idIssuePlace: "Nơi cấp CCCD",
  address: "Địa chỉ",
  idDocuments: "Ảnh CCCD 2 mặt",
  employmentType: "Loại nhân sự",
  department: "Bộ phận",
  startDate: "Ngày bắt đầu",
  role: "Chức danh / Vai trò",
};

export const STAFF_PROFILE_OPTIONS = {
  gender: ["Male", "Female"],
  employmentType: ["Full-time", "Part-time", "Contract", "Intern", "Other"],
  department: ["Academy", "Operations", "Marketing", "Sales", "Management", "Other"],
} as const;

function normalize(value: string): string { return value.trim(); }

function idDocumentsCount(page: NotionPage): number {
  const property = page.properties["ID Documents"] as { files?: unknown[] } | undefined;
  return Array.isArray(property?.files) ? property.files.length : 0;
}

export function mapStaffProfile(page: NotionPage): StaffProfile {
  return {
    email: textProp(page, "Email"),
    dateOfBirth: dateStartProp(page, "Date of Birth"),
    gender: selectProp(page, "Gender"),
    cccd: textProp(page, "CCCD"),
    idIssueDate: textProp(page, "ID Issue Date"),
    idIssuePlace: textProp(page, "ID Issue Place"),
    address: textProp(page, "LEG Address"),
    idDocuments: idDocumentsCount(page),
    employmentType: selectProp(page, "Employment Type"),
    department: selectProp(page, "Department"),
    startDate: dateStartProp(page, "Start Date"),
    role: textProp(page, "Role"),
  };
}

export function missingStaffProfileFields(profile: StaffProfile): StaffProfileField[] {
  const missing: StaffProfileField[] = [];
  if (!normalize(profile.email)) missing.push("email");
  if (!normalize(profile.dateOfBirth)) missing.push("dateOfBirth");
  if (!normalize(profile.gender)) missing.push("gender");
  if (!normalize(profile.cccd)) missing.push("cccd");
  if (!normalize(profile.idIssueDate)) missing.push("idIssueDate");
  if (!normalize(profile.idIssuePlace)) missing.push("idIssuePlace");
  if (!normalize(profile.address)) missing.push("address");
  if (profile.idDocuments < 2) missing.push("idDocuments");
  return missing;
}

export async function staffProfile(staff: Staff): Promise<StaffProfile> {
  return mapStaffProfile(await getPage(staff.id));
}

function dateProperty(value: string): Record<string, unknown> {
  return value ? { date: { start: value } } : { date: null };
}

export async function updateStaffProfile(staff: Staff, input: Partial<StaffProfile>): Promise<StaffProfile> {
  const properties: Record<string, unknown> = {};
  if (input.email !== undefined) properties.Email = { email: normalize(input.email) || null };
  if (input.dateOfBirth !== undefined) properties["Date of Birth"] = dateProperty(normalize(input.dateOfBirth));
  if (input.gender !== undefined) properties.Gender = { select: normalize(input.gender) ? { name: normalize(input.gender) } : null };
  if (input.cccd !== undefined) properties.CCCD = { rich_text: [{ type: "text", text: { content: normalize(input.cccd) } }] };
  if (input.idIssueDate !== undefined) properties["ID Issue Date"] = { rich_text: [{ type: "text", text: { content: normalize(input.idIssueDate) } }] };
  if (input.idIssuePlace !== undefined) properties["ID Issue Place"] = { rich_text: [{ type: "text", text: { content: normalize(input.idIssuePlace) } }] };
  if (input.address !== undefined) properties["LEG Address"] = { rich_text: [{ type: "text", text: { content: normalize(input.address) } }] };
  if (input.employmentType !== undefined) properties["Employment Type"] = { select: normalize(input.employmentType) ? { name: normalize(input.employmentType) } : null };
  if (input.department !== undefined) properties.Department = { select: normalize(input.department) ? { name: normalize(input.department) } : null };
  if (input.startDate !== undefined) properties["Start Date"] = dateProperty(normalize(input.startDate));
  if (input.role !== undefined) properties.Role = { rich_text: [{ type: "text", text: { content: normalize(input.role) } }] };

  if (!Object.keys(properties).length) return staffProfile(staff);
  return mapStaffProfile(await updatePageProperties(staff.id, properties));
}
