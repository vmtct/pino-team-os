import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const [policyId, policyName, evaluateUrl, keysUrl] = process.argv.slice(2);
if (![policyId, policyName, evaluateUrl, keysUrl].every(Boolean)) {
  console.error("usage: assert-tos-evaluator-policy-closure.mjs <policy-id> <policy-name> <evaluate-url> <keys-url>");
  process.exit(2);
}
const payload = JSON.parse(readFileSync(0, "utf8"));
if (payload?.success !== true || !Array.isArray(payload?.result)) {
  throw new Error("Cloudflare policy payload is not a successful result set");
}
const forbiddenPermitPolicies = payload.result.filter((policy) => ["bypass", "service_auth"].includes(policy?.decision));
if (forbiddenPermitPolicies.length) throw new Error(`TOS contains forbidden admission policy decisions: ${forbiddenPermitPolicies.map((p) => p.id ?? p.name ?? "unknown").join(",")}`);
const allows = payload.result.filter((policy) => policy?.decision === "allow");
const canonical = allows.filter((policy) => policy?.id === policyId);
if (canonical.length !== 1) throw new Error("canonical evaluator policy does not resolve exactly once");
const actual = canonical[0];
const normalized = {
  name: actual.name,
  decision: actual.decision,
  precedence: actual.precedence,
  include: actual.include ?? [],
  exclude: actual.exclude ?? [],
  require: actual.require ?? [],
};
const expected = {
  name: policyName,
  decision: "allow",
  precedence: 50,
  include: [{ external_evaluation: { evaluate_url: evaluateUrl, keys_url: keysUrl } }],
  exclude: [],
  require: [],
};
if (!isDeepStrictEqual(normalized, expected)) throw new Error("canonical evaluator policy shape is not exact");
const unsafe = allows.filter((policy) => policy?.id !== policyId).filter((policy) => {
  const requirements = Array.isArray(policy?.require) ? policy.require : [];
  return !requirements.some((rule) =>
    rule?.external_evaluation?.evaluate_url === evaluateUrl &&
    rule?.external_evaluation?.keys_url === keysUrl
  );
});
if (unsafe.length) throw new Error(`allow policies bypass canonical evaluator: ${unsafe.map((p) => p.id ?? p.name ?? "unknown").join(",")}`);
process.stdout.write(JSON.stringify({ canonicalPolicyId: policyId, allowPolicies: allows.length, unsafeAllowPolicies: 0 }));
