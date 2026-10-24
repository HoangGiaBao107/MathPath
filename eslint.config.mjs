import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

export default tseslint.config(
  { ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts", ".codex-test-temp/**", "tmp/**", "content/extracted/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  prettier,
);
