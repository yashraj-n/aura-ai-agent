import { pgTable, text, serial, pgEnum, timestamp } from "drizzle-orm/pg-core";

const validTasks = [
    "started",
    "cloning",
    "indexing",
    "planning",
    "generating",
    "pushing",
    "done",
    "errored"
] as const;
export type taskStatus = (typeof validTasks)[number];
export const taskStatus = pgEnum("task_status", validTasks);

export const tasks = pgTable("tasks", {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull(),
    issueUrl: text("issue_url").notNull(),
    issueTitle: text("issue_title").notNull(),
    threads: text("threads").array().notNull(),
    status: taskStatus("status").notNull(),
    plan: text("plan"),
    pr_link: text("pr_link"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
});
