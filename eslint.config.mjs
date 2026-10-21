import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Reuse the exact React Hooks plugin instance registered by the upstream
// flat config: ESLint 9 requires a plugin to be in the same config object
// where its rule severities are overridden.
const reactHooksPlugin = nextVitals.find((config) => config.plugins?.["react-hooks"])?.plugins?.["react-hooks"];
if (!reactHooksPlugin) throw new Error("Next 16 React Hooks ESLint plugin was not found");

export default defineConfig([
  ...nextVitals,
  {
    plugins: { "react-hooks": reactHooksPlugin },
    // PAP-837: New React Compiler diagnostics over pre-existing Team screens
    // remain visible as warnings until fixed under PAP-839. Older enforced
    // rules-of-hooks, exhaustive-deps, and Next safety rules are unchanged.
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
