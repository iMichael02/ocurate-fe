import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "public/"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["test/**/*.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
];
