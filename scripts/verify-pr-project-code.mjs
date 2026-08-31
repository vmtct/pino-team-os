const body = process.env.PINO_PR_BODY ?? "";
const createdAt = process.env.PINO_PR_CREATED_AT ?? null;
const cutoff = new Date("2026-08-31T02:15:00Z");
const created = createdAt ? new Date(createdAt) : null;
const required = Boolean(created && !Number.isNaN(created.getTime()) && created >= cutoff);
const projectCode = body.match(/^Project-Code:\s*(.+?)\s*$/im)?.[1]?.trim() ?? null;
const entryClass = body.match(/^Entry-Class:\s*(.+?)\s*$/im)?.[1]?.trim() ?? null;

if (entryClass === "NON_MATERIAL_APP_LOCAL") {
  console.log("Team Project-Code verification skipped for NON_MATERIAL_APP_LOCAL.");
  process.exit(0);
}

if (required && !projectCode) fail("material PR created after PLT-CARE cutover requires Project-Code");
if (projectCode && !/^PRJ-(TPP|PSP|PNR|WFM|PLT)$/.test(projectCode)) fail(`unsupported Project-Code ${projectCode}`);

console.log(projectCode ? `Team Project-Code verified: ${projectCode}.` : "Team Project-Code grandfathered for pre-cutover PR.");

function fail(message) {
  console.error(`Team Project-Code verification failed: ${message}`);
  process.exit(1);
}
