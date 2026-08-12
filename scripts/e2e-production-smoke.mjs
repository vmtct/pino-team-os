const baseUrl = process.env.E2E_BASE_URL || "https://pino-team-os.minhtri-van42.workers.dev";

const checks = [
  ["home", "/", 200],
  ["health", "/api/health", 200],
  ["me", "/me", [200, 302, 401, 403]],
  ["schedule", "/schedule", [200, 302, 401, 403]],
  ["team", "/team", [200, 302, 401, 403]],
];

let failed = false;
for (const [name, path, expected] of checks) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  const allowed = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  console.log(`${allowed ? "PASS" : "FAIL"} ${name}: ${response.status} ${path}`);
  if (!allowed) failed = true;
}

if (failed) process.exit(1);
console.log(`E2E smoke passed against ${baseUrl}`);
