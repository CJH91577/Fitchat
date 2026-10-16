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
    // 服务器备份校验脚本：在容器里用纯 node 运行（不能依赖 TS 工具链），
    // 必须是 CommonJS——ESLint 的 no-require-imports 对它不适用
    "scripts/check-backup.js",
  ]),
]);

export default eslintConfig;
