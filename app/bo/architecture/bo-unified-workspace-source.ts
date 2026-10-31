import schoolSource from "@/public/bo-authority-source/school-adapters.js";
import type { BoWorkspaceSource } from "@/app/bo/components/registration/BoRegistrationWorkspace";
import type { BoField, BoRecord } from "@/lib/bo-registration";
import { boModuleRegistry } from "./registry";
import { isBoStagingRouteAdmitted } from "./bo-staging-route-policy";
import { currentBoModuleHref } from "@/lib/bo-url-contract";
import { shiftPlansAdapter, availabilityAdapter, assignmentsAdapter } from "./workforce-read-adapters";
import { payrollPeriodsAdapter } from "@/lib/bo-payroll-read-adapter";
import { assignmentFields } from "@/app/bo/missions/schema";

// PAP-1158: retain the historical adapter contract, but exclude its duplicate salary metadata view from live BO.
const school = {
  ...schoolSource,
  modules: Object.fromEntries(Object.entries(schoolSource.modules).filter(([key]) => key !== "salaryPeriods")),
};
// PAP-1210: metadata registers the actual sidebar slot. Data is owned by the typed provider.
school.modules.missions = { label: "Nhiệm vụ", group: "SCHOOL", fields: assignmentFields.map(f => ({ key: f.key, label: f.label, type: f.type, icon: f.icon, w: f.width, readonly: true })) };
const adapters = {
  "workforce-shift-plans": shiftPlansAdapter,
  "workforce-availability": availabilityAdapter,
  "workforce-assignments": assignmentsAdapter,
  "payroll-periods": payrollPeriodsAdapter,
} as const;
type WorkforceKey = keyof typeof adapters;
const isWorkforce = (key: string): key is WorkforceKey => Object.hasOwn(adapters, key);
const icons: Record<BoField["type"], string> = {
  text:"Aa", id:"#", select:"▣", number:"#", currency:"#", date:"▦",
  relation:"↗", boolean:"☑", textarea:"Aa", datetime:"▦",
  multirelation:"↗", person:"◉", multiselect:"▣", email:"@", url:"↗", formula:"ƒ",
};
const widths: Partial<Record<BoField["type"], number>> = {
  id:145, number:113, select:135, boolean:120, date:145, relation:172,
};
const admittedModules = boModuleRegistry.filter(def => isBoStagingRouteAdmitted(def.href));
for (const def of admittedModules) if (!isWorkforce(def.key)) throw new Error("Staging module missing authorized adapter: " + def.key);
const moduleDefinitions = Object.fromEntries(admittedModules.map(def => [def.key, {
  label: def.label,
  group: "WORKFORCE",
  fields: def.fields.map(field => ({
    key: field.key, label: field.label, type: field.type,
    readonly: true, icon: icons[field.type],
    w: field.key === "name" ? 235 : (widths[field.type] ?? 172),
  })),
}]));
const paths: Record<string,string> = Object.fromEntries(admittedModules.map(def => [def.key, def.href]));
export const unifiedBoWorkspaceSource: BoWorkspaceSource = {
  ...school,
  allowStudentCreate: true,
  modules: { ...school.modules, ...moduleDefinitions },
  isModuleReadOnly: isWorkforce,
  routeForModule: (key) => currentBoModuleHref(key, paths),
  async load(key, fetcher, options) {
    if (!isWorkforce(key)) return school.load(key, fetcher, options);
    const data = await adapters[key].list(fetcher);
    if (!Array.isArray(data) || data.some(r => !r || typeof r.id !== "string" || typeof r.name !== "string"))
      throw new Error("Workforce projection invalid");
    const ids = new Set(data.map(r => r.id));
    if (ids.size !== data.length || data.length > 10000) throw new Error("Duplicate or excessive Workforce records");
    return data as BoRecord[];
  },
};
