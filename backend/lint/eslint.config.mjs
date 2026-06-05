// Flat ESLint config used by the code-check service to lint submitted JS/TS.
// It is intentionally self-contained (no project/tsconfig needed) so it can run
// against arbitrary extracted source files. Only syntax / best-practice rules
// are enabled — type-aware rules are skipped since submissions have no tsconfig.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      // Assume browser + node + modern globals so common identifiers
      // (window, document, process, console, ...) are not reported as undefined.
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {},
  },
];
