import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Downgrade to warn — too many instances to fix at once, will address gradually
      "@typescript-eslint/no-explicit-any": "warn",
      // setState in useEffect is valid for data fetching patterns
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
