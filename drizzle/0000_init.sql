-- 初始表结构。与 lib/db/schema.ts 一一对应。
--
-- 手写而不是 drizzle-kit generate 生成，是因为生成环境禁止 esbuild 拉子进程。
-- 因此 lib/db/schema.test.ts 会把这份 SQL 应用到一个全新的库上，再逐表逐列
-- 与 Drizzle 自己的定义比对——一旦两者漂移，测试立刻失败。
--
-- 注意：语句之间必须用 statement-breakpoint 标记分隔（标记由「减号减号大于号」
-- 加一个空格，再加上 statement-breakpoint 组成）。drizzle 的迁移器就是按这个标记
-- 切分 SQL 文件的：漏掉它，多条语句会被当成一条执行；而**注释里若出现该标记的
-- 完整字样，切分会从注释中间断开**，第一段就没有可执行语句，迁移会以
-- 「The supplied SQL string contains no statements」失败。

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`height_cm` integer NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`started_at` text NOT NULL,
	`timezone` text NOT NULL DEFAULT 'Asia/Shanghai',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`note` text,
	`used_by_user_id` text,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`user_id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`calories` integer NOT NULL,
	`protein` integer NOT NULL,
	`carbs` integer NOT NULL,
	`fat` integer NOT NULL,
	`exercise_calories` integer NOT NULL,
	`target_weight_kg` real NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`per_grams` integer DEFAULT 100 NOT NULL,
	`calories` integer NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
CREATE TABLE `food_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`grams` real NOT NULL,
	`source` text NOT NULL,
	`calories` integer NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `food_entries_user_date_idx` ON `food_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `exercise_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`minutes` integer,
	`calories_burned` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exercise_entries_user_date_idx` ON `exercise_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `strength_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight_kg` real NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `exercise_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `strength_sets_entry_index_idx` ON `strength_sets` (`entry_id`,`set_index`);--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kg` real NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plan_days` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`theme` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_days_user_weekday_idx` ON `plan_days` (`user_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_day_id` text NOT NULL,
	`item_index` integer NOT NULL,
	`name` text NOT NULL,
	`sets` integer NOT NULL,
	`reps` text NOT NULL,
	FOREIGN KEY (`plan_day_id`) REFERENCES `plan_days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_items_day_index_idx` ON `plan_items` (`plan_day_id`,`item_index`);
