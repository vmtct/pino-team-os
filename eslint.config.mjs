import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // PAP-837: Next 16 introduces new React Compiler diagnostics over existing
    // Team screens. Preserve the prior enforced lint baseline while surfacing
    // these new findings as warnings until individually remediated.
    // The original rules-of-hooks, exhaustive-deps and Next safety rules
    // retain their upstream severities.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([".next/**", ".open-next/**", "node_modules/**"]),
]);
