-- 资料三件套（身高/年龄/性别）改为可空。
--
-- 注册只要邮箱 + 口令（邀请码是唯一门槛），身高/年龄/性别是注册之后的
-- 「首次引导」才填的——算每日目标要用到它们，而那时才第一次需要。
-- 把它们继续留在 NOT NULL 上，就等于逼注册表单要么多问三个字段、
-- 要么先塞一组假数字，两条路都不诚实。
--
-- 与 0000_init.sql 一样是手写的：生成环境禁止 esbuild 拉子进程，drizzle-kit
-- 跑不起来（报 spawn EPERM）。所以 lib/db/schema.test.ts 会把这份 SQL 应用到
-- 一个全新的库上，再逐表逐列与 schema.ts 比对；写法若与 schema 漂移，测试转红。
--
-- SQLite 不能直接去掉列的 NOT NULL，只能「建新表 → 搬数据 → 删旧表 → 改名」，
-- 这也是 drizzle-kit 自己生成时会用的写法。删旧表时 users 正被其它表引用，
-- 所以整段关掉外键：不关会触发级联，把用户的记录一起删掉。

-- 注意：这里**不写** PRAGMA foreign_keys——SQLite 里它在事务内是空操作，而迁移器
-- 把每个迁移包在事务里执行，写了也只是看着安心。外键是在 lib/db/migrate.ts 里、
-- 执行迁移的连接上关掉的，那个文件同时解释了为什么必须关，以及迁移之后怎么用
-- foreign_key_check 把「悄悄坏掉的库」拦下来。

CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`height_cm` integer,
	`age` integer,
	`sex` text,
	`started_at` text NOT NULL,
	`timezone` text NOT NULL DEFAULT 'Asia/Shanghai',
	`created_at` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_users` (`id`, `email`, `password_hash`, `height_cm`, `age`, `sex`, `started_at`, `timezone`, `created_at`) SELECT `id`, `email`, `password_hash`, `height_cm`, `age`, `sex`, `started_at`, `timezone`, `created_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
