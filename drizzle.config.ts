import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit 的配置。
 *
 * `drizzle-kit generate` 依据 lib/db/schema.ts 生成 SQL 迁移到 drizzle/ 目录；
 * 运行期用 `migrate()`（见 scripts/migrate.ts）把迁移应用到库上。
 * 迁移文件进版本库，库文件不进（见 .gitignore）。
 */
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? 'data/fitchat.db',
  },
})
