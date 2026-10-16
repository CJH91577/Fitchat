-- 登录/注册失败计数表（限流用，见 lib/auth/rate-limit.ts）。
--
-- 与 0000/0001 一样手写：生成环境禁止 esbuild 拉子进程，drizzle-kit
-- 跑不起来。lib/db/schema.test.ts 会把这份 SQL 应用到全新库上，再逐表逐列
-- 与 schema.ts 比对；写法若与 schema 漂移，测试转红。
--
-- 纯新增表，不碰任何既有数据，不需要表重建那套流程。

CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`count` integer NOT NULL
);
