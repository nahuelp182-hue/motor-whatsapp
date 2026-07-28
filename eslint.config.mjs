import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts sueltos de Node (CommonJS, se corren con `node`, no pasan por el bundler).
    // scripts/aplicar-sql.js se retira en el Bloque C del plan de arquitectura.
    "scripts/**",
  ]),
]);

export default eslintConfig;
