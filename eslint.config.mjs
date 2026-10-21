import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// PAP-837: preserve the pre-Next-16 lint admission policy for unchanged legacy
// files. New Next 16 / react-hooks compiler diagnostics remain visible as
// warnings until the separate per-component remediation can be completed.
// Rules of Hooks, TS parser errors, Next Core Web Vitals and other errors
// remain enforced by the native presets above.
const legacyRuleParity = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
  "react-hooks/exhaustive-deps": "warn",
  "@typescript-eslint/no-require-imports": "warn",
  "@typescript-eslint/no-explicit-any": "warn",
  "prefer-const": "warn",
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { rules: legacyRuleParity },
  globalIgnores([".next/**", ".open-next/**", "node_modules/**"]),
]);
