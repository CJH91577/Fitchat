-- 口令重置码表（见 lib/auth/reset.ts）。
--
-- 没有邮件服务，所以口令找回走「管理员 CLI 生成一次性重置码」的流程
--（scripts/reset-password.ts）。码绑定用户、24 小时过期、用一次作废。
--
-- 与 0000–0002 一样手写：生成环境禁止 esbuild 拉子进程，drizzle-kit
-- 跑不起来。lib/db/schema.test.ts 会把这份 SQL 应用到全新库上，再逐表逐列
-- 与 schema.ts 比对；写法若与 schema 漂移，测试转红。
--
-- 纯新增表，不碰任何既有数据，不需要表重建那套流程。

CREATE TABLE `password_reset_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
