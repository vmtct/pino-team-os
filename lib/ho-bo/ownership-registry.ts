/** PAP-991 / PAP-990 M01. Design inventory only: never import into runtime routing or ACL. */
export const registryVersion = 1;
export const sourceSnapshot = "a10107f4f75dd1719fb5723a73318f2ddadc30c2";
export type Ownership = "HO_GLOBAL_MASTER" | "BO_CENTER_OPERATION" | "SHARED_ENTITY_SPLIT" | "SHARED_READ";
export type Action = "create" | "update" | "assign" | "operate" | "read";
export type Scope = "GLOBAL" | "CENTER";
export type StoryKey = `PAP-${number}`;
export interface Target {
  surface: "HO" | "BO";
  route: string;
  scope: Scope;
  actions: readonly Action[];
  /** Stable design resource names, NOT new Core permissions, IDs or table names. */
  resources: readonly string[];
  availability: "PLANNED_CONTRACT_REQUIRED";
  routeDisposition: "MISSING_PLANNED_HO_ROUTE" | "EXISTING_BO_PATH_SCOPE_NOT_PROVEN";
}
export interface OwnershipModule {
  moduleKey: string;
  label: string;
  oldBoHrefs: readonly string[];
  sourcePages: readonly string[];
  ownership: Ownership;
  dataOwner: { repository: "pino-core"; domain: string };
  targets: readonly Target[];
  specializedSlot: { kind: "DETAIL" | "EDITOR" | "TIMELINE" | "MATRIX" | "DASHBOARD"; purpose: string };
  adoptionStories: readonly StoryKey[];
  legacyDisposition: "MOVE_AUTHOR_TO_HO" | "RETAIN_CENTER_ROUTE" | "SPLIT_BEFORE_CUTOVER" | "RETAIN_SCOPED_READ" | "RETIRE_PROTOTYPE";
  boConsumption: string;
  contractStatus: "OWNER_API_PERMISSION_TABLE_RECONCILE_REQUIRED";
}
export interface AdoptionStory {
  key: StoryKey;
  label: string;
  admission: "PILOT_ONLY" | "FOUNDER_APPROVAL_GATED" | "EXCLUDED_FROM_UI_ADOPTION";
}

// Exact PAP-878 story table, including all four excluded historical rows.
export const adoptionStories: readonly AdoptionStory[] = [
  { key: "PAP-890", label: "Home", admission: "EXCLUDED_FROM_UI_ADOPTION" },
  { key: "PAP-891", label: "Students", admission: "PILOT_ONLY" },
  { key: "PAP-892", label: "Student Visits", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-875", label: "Subscriptions", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-893", label: "Classes", admission: "PILOT_ONLY" },
  { key: "PAP-894", label: "School Schedule", admission: "EXCLUDED_FROM_UI_ADOPTION" },
  { key: "PAP-895", label: "Leads", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-896", label: "Open Studio", admission: "EXCLUDED_FROM_UI_ADOPTION" },
  { key: "PAP-897", label: "TVs", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-898", label: "Programs & Syllabus", admission: "EXCLUDED_FROM_UI_ADOPTION" },
  { key: "PAP-899", label: "Missions", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-900", label: "Practice", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-919", label: "Staff", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-901", label: "Workforce Schedule & Time", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-902", label: "Check-in Exceptions", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-903", label: "Timekeeping", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-904", label: "Compensation History", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-905", label: "Duty Exceptions", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-876", label: "Payroll Periods", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-906", label: "Extra Time", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-920", label: "Training Library", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-921", label: "Training Register", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-907", label: "World", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-908", label: "Economy", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-909", label: "Collection", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-877", label: "Wardrobe", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-910", label: "Effects", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-911", label: "TV Projection Policy", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-912", label: "Website CMS", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-913", label: "Access", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-914", label: "Roles", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-915", label: "Policies", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-916", label: "AI Data Inbox", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-917", label: "Pancake", admission: "FOUNDER_APPROVAL_GATED" },
  { key: "PAP-918", label: "Audit", admission: "FOUNDER_APPROVAL_GATED" },
];

const author = (route: string, ...resources: string[]): Target => ({ surface: "HO", route, scope: "GLOBAL", actions: ["create", "update", "read"], resources, availability: "PLANNED_CONTRACT_REQUIRED", routeDisposition: "MISSING_PLANNED_HO_ROUTE" });
const local = (route: string, resources: string[], actions: readonly Action[] = ["create", "update", "assign", "operate", "read"]): Target => ({ surface: "BO", route, scope: "CENTER", actions, resources, availability: "PLANNED_CONTRACT_REQUIRED", routeDisposition: "EXISTING_BO_PATH_SCOPE_NOT_PROVEN" });
const read = (surface: "HO" | "BO", route: string, ...resources: string[]): Target => ({ surface, route, scope: surface === "HO" ? "GLOBAL" : "CENTER", actions: ["read"], resources, availability: "PLANNED_CONTRACT_REQUIRED", routeDisposition: surface === "HO" ? "MISSING_PLANNED_HO_ROUTE" : "EXISTING_BO_PATH_SCOPE_NOT_PROVEN" });
const page = (route: string) => `app${route}/page.tsx`;
function moduleRow(moduleKey: string, label: string, oldRoute: string, ownership: Ownership, domain: string, targets: readonly Target[], stories: readonly StoryKey[], kind: OwnershipModule["specializedSlot"]["kind"], purpose: string, extraPages: readonly string[] = []): OwnershipModule {
  return {
    moduleKey, label, oldBoHrefs: [oldRoute], sourcePages: [page(oldRoute), ...extraPages.map(page)], ownership,
    dataOwner: { repository: "pino-core", domain }, targets, adoptionStories: stories,
    specializedSlot: { kind, purpose },
    legacyDisposition: ownership === "HO_GLOBAL_MASTER" ? "MOVE_AUTHOR_TO_HO" : ownership === "BO_CENTER_OPERATION" ? "RETAIN_CENTER_ROUTE" : ownership === "SHARED_ENTITY_SPLIT" ? "SPLIT_BEFORE_CUTOVER" : "RETAIN_SCOPED_READ",
    boConsumption: ownership === "HO_GLOBAL_MASTER" ? "Reference canonical global IDs and published versions; no BO master authoring." : "Exactly one authorized Center projection/relation; never clone global masters.",
    contractStatus: "OWNER_API_PERMISSION_TABLE_RECONCILE_REQUIRED",
  };
}

export const ownershipRegistry: readonly OwnershipModule[] = [
  moduleRow("home", "Home (UI excluded)", "/bo", "SHARED_READ", "operational projections", [read("HO", "/ho", "network-overview"), read("BO", "/bo", "center-overview")], ["PAP-890"], "DASHBOARD", "Global network vs single-center awareness; no new command ownership."),
  moduleRow("students", "Students", "/bo/learners", "SHARED_ENTITY_SPLIT", "student identity / participation", [author("/ho/students", "student-identity"), local("/bo/learners", ["student-center-membership"])], ["PAP-891"], "DETAIL", "Global Student ID; local enrollment, pedagogy and authorized Pinoria links."),
  moduleRow("student-visits", "Student Visits", "/bo/student-visits", "BO_CENTER_OPERATION", "participation / attendance / visits", [local("/bo/student-visits", ["student-visit"])], ["PAP-892"], "TIMELINE", "Visit ledger and reception actions; not mentor check-in."),
  moduleRow("subscriptions", "Subscription catalog vs sales", "/bo/subscriptions", "SHARED_ENTITY_SPLIT", "subscription catalog / billing", [author("/ho/subscription-catalog", "subscription-product"), local("/bo/subscriptions", ["subscription-sale", "subscription-consumption"])], ["PAP-875"], "DETAIL", "Global product/version references; center sale, billing and consumption."),
  moduleRow("classes", "Classes", "/bo/running-classes", "BO_CENTER_OPERATION", "delivery occurrence / capacity", [local("/bo/running-classes", ["running-class"])], ["PAP-893"], "DETAIL", "Class roster, weekly teachers and session detail."),
  moduleRow("sessions", "Sessions", "/bo/sessions", "BO_CENTER_OPERATION", "delivery occurrence / capacity", [local("/bo/sessions", ["session"])], ["PAP-893"], "DETAIL", "Actual sessions reference global Syllabus IDs."),
  moduleRow("registrations", "Registrations", "/bo/registrations", "BO_CENTER_OPERATION", "booking / participation", [local("/bo/registrations", ["session-registration"])], ["PAP-893"], "DETAIL", "Registration lifecycle and capacity remain Core-owned."),
  moduleRow("activation", "Delivery Activation", "/bo/delivery-activation", "BO_CENTER_OPERATION", "delivery activation", [local("/bo/delivery-activation", ["delivery-activation"])], ["PAP-893"], "DETAIL", "Activation feedback and center execution."),
  moduleRow("calendar", "School Schedule (UI excluded)", "/bo/calendar", "SHARED_ENTITY_SPLIT", "calendar / closures", [author("/ho/calendar", "global-holiday-policy"), local("/bo/calendar", ["center-closure", "center-calendar"])], ["PAP-894"], "TIMELINE", "Global defaults plus local closures; one calendar authority."),
  moduleRow("leads", "Leads", "/bo/sales/leads", "BO_CENTER_OPERATION", "sales pipeline", [local("/bo/sales/leads", ["center-lead"])], ["PAP-895"], "DETAIL", "Consultation pipeline; cross-center transfer requires explicit contract."),
  moduleRow("open-studio", "Open Studio (UI excluded)", "/bo/open-studio", "BO_CENTER_OPERATION", "open studio / capacity", [local("/bo/open-studio", ["open-studio-operation"])], ["PAP-896"], "DETAIL", "Local claims, capacity and sessions; global policy is referenced."),
  moduleRow("tv-devices", "TV Devices", "/bo/tvs", "BO_CENTER_OPERATION", "TV devices", [local("/bo/tvs", ["center-tv-device"])], ["PAP-897"], "EDITOR", "Device inventory and authorized controls; no global TV policy writes."),
  moduleRow("learning-masters", "Programs & Syllabus (UI excluded)", "/bo/syllabus", "HO_GLOBAL_MASTER", "learning catalog / syllabus", [author("/ho/programs", "program"), author("/ho/syllabi", "syllabus")], ["PAP-898"], "EDITOR", "Rich curriculum/profile editor; BO consumes published versions."),
  moduleRow("missions", "Missions", "/bo/missions", "HO_GLOBAL_MASTER", "learning mission definitions", [author("/ho/missions", "mission-definition")], ["PAP-899"], "EDITOR", "Definition/prerequisite editor; learner execution remains separate."),
  moduleRow("practice", "Practice Library", "/bo/practice", "HO_GLOBAL_MASTER", "learning practice catalog", [author("/ho/practice", "practice-definition")], ["PAP-900"], "EDITOR", "Library authoring only; learner evidence is not a global master write."),
  moduleRow("staff", "Staff", "/bo/staff", "SHARED_ENTITY_SPLIT", "staff / workforce", [author("/ho/staff", "staff-identity"), local("/bo/staff", ["staff-center-membership", "staff-center-assignment"])], ["PAP-919"], "DETAIL", "PAP-779 handoff required; global StaffMember distinct from User.", ["/bo/staff/[staffId]"]),
  moduleRow("workforce-schedule", "Workforce Schedule & Time", "/bo/workforce", "BO_CENTER_OPERATION", "workforce planning / shifts", [local("/bo/workforce", ["center-shift", "center-schedule"])], ["PAP-901"], "MATRIX", "Weekly planner retained as specialized detail; IN scope for adoption."),
  moduleRow("check-in-exceptions", "Check-in Exceptions", "/bo/workforce/check-in-exceptions", "BO_CENTER_OPERATION", "workforce presence", [local("/bo/workforce/check-in-exceptions", ["check-in-exception"])], ["PAP-902"], "DETAIL", "Preserve protected photo/evidence review."),
  moduleRow("timekeeping", "Timekeeping", "/bo/workforce/timekeeping", "BO_CENTER_OPERATION", "workforce timekeeping", [local("/bo/workforce/timekeeping", ["center-timekeeping"])], ["PAP-903"], "TIMELINE", "Attendance and correction ledger; Core owns actual time truth."),
  moduleRow("compensation-history", "Compensation History", "/bo/workforce/compensation", "SHARED_READ", "workforce compensation", [read("HO", "/ho/workforce/compensation", "compensation-history"), read("BO", "/bo/workforce/compensation", "compensation-history")], ["PAP-904"], "TIMELINE", "Sensitive salary history with independent field ACL; policy edits belong to payroll."),
  moduleRow("duty-exceptions", "Duty Exceptions", "/bo/workforce/duty-exceptions", "BO_CENTER_OPERATION", "workforce duty", [local("/bo/workforce/duty-exceptions", ["duty-exception"])], ["PAP-905"], "DETAIL", "Local duty reconciliation; policy references remain global."),
  moduleRow("payroll", "Payroll Policy vs Center Execution", "/bo/workforce/payroll", "SHARED_ENTITY_SPLIT", "workforce payroll / policy", [author("/ho/workforce/payroll-policy", "payroll-policy"), local("/bo/workforce/payroll", ["center-payroll-period", "center-payroll-exception"])], ["PAP-876"], "DETAIL", "Global policy version; local period and exception commands retain finance gates."),
  moduleRow("extra-time", "Extra Time Review", "/bo/workforce/payroll/extra-time", "BO_CENTER_OPERATION", "workforce payroll", [local("/bo/workforce/payroll/extra-time", ["extra-time-review"])], ["PAP-906"], "DETAIL", "Center finance review; no global rate/policy authoring."),
  moduleRow("training", "Training Library vs Register", "/bo/training", "SHARED_ENTITY_SPLIT", "training catalog / progress", [author("/ho/training/library", "training-library"), local("/bo/training", ["training-register"])], ["PAP-920", "PAP-921"], "EDITOR", "Builder/library vs local assignments/progress; PAP-847/851/852 handoff required.", ["/bo/training/builder"]),
  moduleRow("pinoria-world", "World / Region / Season", "/bo/pinoria-world", "HO_GLOBAL_MASTER", "Pinoria world definitions", [author("/ho/pinoria/world", "pinoria-world", "pinoria-region", "pinoria-season")], ["PAP-907"], "EDITOR", "World/region builder and 16:9 preview; no independent Region page exists."),
  moduleRow("pinoria-economy", "Economy Rules vs Local Operations", "/bo/pinoria-wish", "SHARED_ENTITY_SPLIT", "Pinoria economy", [author("/ho/pinoria/economy", "pinoria-economy-rule"), local("/bo/pinoria-wish", ["center-economy-operation"], ["operate", "read"])], ["PAP-908"], "EDITOR", "Separate rule/catalog/release authoring from bounded local operations; correction authority must be reconciled."),
  moduleRow("pinoria-activity", "Activity Ledger", "/bo/pinoria-activities", "BO_CENTER_OPERATION", "Pinoria activities", [local("/bo/pinoria-activities", ["center-pinoria-activity"], ["operate", "read"])], ["PAP-908"], "TIMELINE", "Actual learner activity ledger; not global economy definitions."),
  moduleRow("pinoria-companions", "Pet Species vs Learner Companions", "/bo/pinoria-companions", "SHARED_ENTITY_SPLIT", "Pinoria companions", [author("/ho/pinoria/pet-species", "pet-species"), local("/bo/pinoria-companions", ["learner-companion"], ["operate", "read"])], ["PAP-909"], "DETAIL", "Species/stages global; learner lifecycle only through admitted canonical commands."),
  { ...moduleRow("companion-prototype", "Companion Prototype", "/bo/pinoria-companions/prototype", "SHARED_READ", "Pinoria companions", [read("HO", "/ho/pinoria/pet-species", "pet-species")], ["PAP-909"], "EDITOR", "Prototype source is evidence only; do not promote mock commands."), legacyDisposition: "RETIRE_PROTOTYPE" },
  moduleRow("ward-catalog", "Ward Catalog", "/bo/pinoria-ward", "HO_GLOBAL_MASTER", "Pinoria wardrobe catalog", [author("/ho/pinoria/ward", "ward-item")], ["PAP-877"], "EDITOR", "Global assets/catalog; no per-center copies."),
  moduleRow("ward-sets", "Ward Sets", "/bo/pinoria-ward/sets", "HO_GLOBAL_MASTER", "Pinoria wardrobe catalog", [author("/ho/pinoria/ward/sets", "ward-set")], ["PAP-877"], "EDITOR", "Set composition and bonuses reference canonical items/effects."),
  moduleRow("learner-loadouts", "Learner Loadouts", "/bo/pinoria-ward/learners", "BO_CENTER_OPERATION", "Pinoria learner wardrobe", [local("/bo/pinoria-ward/learners", ["learner-loadout"], ["assign", "operate", "read"])], ["PAP-877"], "DETAIL", "Authorized center relation to learner-global owned wardrobe; never clone the learner inventory."),
  moduleRow("effects", "Effects", "/bo/pinoria-effects", "HO_GLOBAL_MASTER", "Pinoria effect catalog", [author("/ho/pinoria/effects", "pinoria-effect")], ["PAP-910"], "EDITOR", "Global visual/effect definitions."),
  moduleRow("tv-policy", "TV Projection Policy", "/bo/pinoria-tv-policy", "HO_GLOBAL_MASTER", "Pinoria TV policy", [author("/ho/pinoria/tv-policy", "tv-projection-policy")], ["PAP-911"], "EDITOR", "Global projection rules; device execution belongs to BO."),
  moduleRow("tv-operator", "TV Operations", "/bo/pinoria-tv-operator", "BO_CENTER_OPERATION", "Pinoria TV operations", [local("/bo/pinoria-tv-operator", ["center-tv-operation"], ["operate", "read"])], ["PAP-897", "PAP-911"], "DETAIL", "Device diagnostics and local operator controls; nested ownership links, no new adoption grant."),
  moduleRow("tv-mesh", "TV House Mesh", "/bo/pinoria-tv-mesh", "BO_CENTER_OPERATION", "Pinoria TV operations", [local("/bo/pinoria-tv-mesh", ["center-tv-mesh"])], ["PAP-911"], "EDITOR", "House-specific layout/topology; exact field ownership needs TV owner review."),
  moduleRow("tv-dialogue", "TV Dialogue", "/bo/pinoria-tv-dialogue", "HO_GLOBAL_MASTER", "Pinoria TV content", [author("/ho/pinoria/tv-dialogue", "tv-dialogue-definition")], ["PAP-911"], "EDITOR", "Proposed global dialogue templates; confirm global template vs local override boundary before M04."),
  moduleRow("cms", "Website CMS", "/bo/content", "HO_GLOBAL_MASTER", "global website CMS", [author("/ho/content", "website-content")], ["PAP-912"], "EDITOR", "Rich content/media editor; publication authorization remains separate."),
  moduleRow("access", "Users / Access", "/bo/system/users", "SHARED_ENTITY_SPLIT", "access control / identity", [author("/ho/system/users", "access-user"), local("/bo/system/users", ["center-access-assignment"], ["assign", "read"])], ["PAP-913"], "DETAIL", "One global User; delegated assignment restricted to current Center; no Founder control-plane exposure."),
  moduleRow("roles", "Roles", "/bo/system/roles", "HO_GLOBAL_MASTER", "access control", [author("/ho/system/roles", "role-definition")], ["PAP-914"], "MATRIX", "Global permission matrix; BO consumes approved roles only."),
  moduleRow("policies", "Policies", "/bo/system/policies", "HO_GLOBAL_MASTER", "policy center", [author("/ho/system/policies", "global-policy")], ["PAP-915"], "EDITOR", "Policy definitions/defaults; future bounded center overrides require separate contract."),
  moduleRow("ai-inbox", "AI Data / Integration Configuration", "/bo/system/ai-data", "HO_GLOBAL_MASTER", "AI ingestion / integrations", [author("/ho/system/ai-data", "ai-integration-configuration")], ["PAP-916"], "DETAIL", "Global ingestion/review configuration; no new connector or external side effect in M01."),
  moduleRow("pancake", "Pancake Integration", "/bo/system/pancake", "HO_GLOBAL_MASTER", "integration configuration", [author("/ho/system/pancake", "pancake-integration-configuration")], ["PAP-917"], "EDITOR", "Global channel configuration; secrets never enter the registry or UI projections."),
  moduleRow("audit", "Audit", "/bo/system/audit", "SHARED_READ", "canonical audit", [read("HO", "/ho/system/audit", "audit-event"), read("BO", "/bo/system/audit", "audit-event")], ["PAP-918"], "TIMELINE", "Immutable global audit with redacted center projection; no application audit authoring."),
  moduleRow("profile", "Own Profile", "/bo/profile", "SHARED_READ", "identity / staff", [read("BO", "/bo/profile", "own-profile")], [], "DETAIL", "Non-sidebar utility; own identity restriction in addition to center context; PAP-991 inventories, not a new PAP-878 adapter."),
];
