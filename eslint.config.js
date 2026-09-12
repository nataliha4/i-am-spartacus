import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "legacy/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, Bun: "readonly" },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/client/tracker/**/*.jsx"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
);
