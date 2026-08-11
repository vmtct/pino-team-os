import type { NotionPage } from "@/lib/notion/types";
import { multiSelectProp, relationIds, selectProp, textProp } from "@/lib/notion/properties";

export type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  employmentStatus: string;
  department: string;
  role: string;
  functions: string[];
  programs: string[];
  appAccess: string;
};

export function mapStaff(page: NotionPage): Staff {
  return {
    id: page.id,
    name: textProp(page, "Name"),
    email: textProp(page, "Email"),
    phone: textProp(page, "Phone"),
    employmentStatus: selectProp(page, "Employment Status"),
    department: selectProp(page, "Department"),
    role: textProp(page, "Role"),
    functions: multiSelectProp(page, "Functions"),
    programs: relationIds(page, "Programs"),
    appAccess: selectProp(page, "App Access") || "Staff",
  };
}
