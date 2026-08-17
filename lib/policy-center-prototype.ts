export type PolicyStatus = "ACTIVE" | "SCHEDULED" | "SUPERSEDED";

export type PolicyPrototype = {
  id: string;
  domain: "WORKFORCE";
  name: string;
  summary: string;
  target: string;
  version: number;
  status: PolicyStatus;
  effectiveFrom: string;
  effectiveUntil?: string;
  usedBy: string[];
  changeReason: string;
};

export const policyDomains = [
  { id: "WORKFORCE", name: "Workforce", active: 4, upcoming: 1, description: "Staffing expectations, shift templates, fallback and coverage rules." },
  { id: "MEMBERSHIP", name: "Membership", active: 0, upcoming: 0, description: "No canonical policies yet. Add only when Membership approves configurable business rules." },
  { id: "OPEN_STUDIO", name: "Open Studio", active: 0, upcoming: 0, description: "No canonical policies yet. Booking and guest rules remain domain-owned until promoted to Policy." },
  { id: "PINER", name: "Piner", active: 0, upcoming: 0, description: "No canonical policies yet. Journey/access rules remain feature-owned until promoted to Policy." },
] as const;

export const workforcePolicies: PolicyPrototype[] = [
  {
    id: "pa-evening-shift-v3",
    domain: "WORKFORCE",
    name: "Evening Assistant Shift",
    summary: "17:30 → 21:00 · Split shift: No",
    target: "CENTER · Cần Thơ",
    version: 3,
    status: "ACTIVE",
    effectiveFrom: "17 Aug 2026",
    usedBy: ["Weekly Assistant Planning", "Daily Coverage", "Shift Offerings"],
    changeReason: "Current operating baseline",
  },
  {
    id: "pa-baseline-v2",
    domain: "WORKFORCE",
    name: "PA Operating Baseline",
    summary: "2 responsibilities · PA-ACA + PA-Reception",
    target: "CENTER · Cần Thơ",
    version: 2,
    status: "ACTIVE",
    effectiveFrom: "17 Aug 2026",
    usedBy: ["Coverage Demand", "Daily Coverage"],
    changeReason: "Current house operating model",
  },
  {
    id: "piano-te-v1",
    domain: "WORKFORCE",
    name: "PianoHouse TE Coverage",
    summary: "1 qualified Piano TE per fixed cohort · Expected Premium",
    target: "PATH · PianoHouse",
    version: 1,
    status: "ACTIVE",
    effectiveFrom: "17 Aug 2026",
    usedBy: ["Coverage Demand", "Monthly Teachers"],
    changeReason: "Founder staffing baseline",
  },
  {
    id: "lp-share-v1",
    domain: "WORKFORCE",
    name: "Little Piner TE Sharing",
    summary: "Shared Early Years TE permitted when room + capability + capacity allow",
    target: "PATH · Little Piner",
    version: 1,
    status: "ACTIVE",
    effectiveFrom: "17 Aug 2026",
    usedBy: ["Coverage Demand Compiler"],
    changeReason: "Bridge-block operating model",
  },
  {
    id: "pa-evening-shift-v4",
    domain: "WORKFORCE",
    name: "Evening Assistant Shift",
    summary: "17:00 → 21:00 · Split shift: No",
    target: "CENTER · Cần Thơ",
    version: 4,
    status: "SCHEDULED",
    effectiveFrom: "01 Sep 2026",
    usedBy: ["Weekly Assistant Planning", "Daily Coverage", "Shift Offerings"],
    changeReason: "Prototype upcoming change for UX review",
  },
  {
    id: "pa-evening-shift-v2",
    domain: "WORKFORCE",
    name: "Evening Assistant Shift",
    summary: "18:00 → 21:00 · Split shift: No",
    target: "CENTER · Cần Thơ",
    version: 2,
    status: "SUPERSEDED",
    effectiveFrom: "01 Jul 2026",
    effectiveUntil: "16 Aug 2026",
    usedBy: ["Historical Shift Offerings"],
    changeReason: "Previous operating window",
  },
];

export const currentWorkforcePolicies = workforcePolicies.filter(policy => policy.status === "ACTIVE");
export const upcomingWorkforcePolicies = workforcePolicies.filter(policy => policy.status === "SCHEDULED");
export const historicalWorkforcePolicies = workforcePolicies.filter(policy => policy.status === "SUPERSEDED");
