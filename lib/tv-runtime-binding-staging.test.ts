import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

interface ServiceBinding {
  binding: string;
  service: string;
  entrypoint: string;
}

function servicesOf(path: string): ServiceBinding[] {
  const parsed = ts.parseConfigFileTextToJson(path, readFileSync(path, "utf8"));
  assert.equal(parsed.error, undefined, `Invalid JSONC: ${path}`);
  assert.ok(parsed.config && Array.isArray(parsed.config.services), `Missing services: ${path}`);
  return parsed.config.services as ServiceBinding[];
}

for (const stagingFile of ["wrangler.staging.jsonc", "wrangler.ho-staging.json"]) {
  test(`PAP-1243: ${stagingFile} binds Pinoria TV runtime only to staging Core`, () => {
    const services = servicesOf(stagingFile);
    const matches = services.filter((service) => service.binding === "PINO_TV_RUNTIME_CORE");
    assert.deepEqual(matches, [{
      binding: "PINO_TV_RUNTIME_CORE",
      service: "pino-core-staging",
      entrypoint: "DisplayRuntimeControlPlane",
    }]);
    assert.ok(services.every((service) => service.service === "pino-core-staging"),
      "No staging service may point to production Core");
  });
}

test("PAP-1243: Production TV runtime binding remains production-only", () => {
  const matches = servicesOf("wrangler.jsonc")
    .filter((service) => service.binding === "PINO_TV_RUNTIME_CORE");
  assert.deepEqual(matches, [{
    binding: "PINO_TV_RUNTIME_CORE",
    service: "pino-core",
    entrypoint: "DisplayRuntimeControlPlane",
  }]);
});
