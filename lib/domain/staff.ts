import type { NotionPage } from "@/lib/notion/types";
import { checkboxProp, multiSelectProp, relationIds, selectProp, textProp } from "@/lib/notion/properties";

export type Staff = {
  id: string;
  name: string;
  userId: string;
  email: string;
  phone: string;
  employmentStatus: string;
  department: string;
  functions: string[];
  programs: string[];
  appAccess: string;
  companionAccess: boolean;
};

export function mapStaff(page: NotionPage): Staff {
  return {
    id: page.id,
    name: textProp(page, "Name"),
    userId: textProp(page, "User ID"),
    email: textProp(page, "Email"),
    phone: textProp(page, "Mobile"),
    employmentStatus: selectProp(page, "Employment Status"),
    department: selectProp(page, "Department"),
    functions: multiSelectProp(page, "Functions"),
    programs: relationIds(page, "Programs"),
    appAccess: selectProp(page, "App Access") || "Staff",
    companionAccess: checkboxProp(page, "Companion Access"),
  };
}
