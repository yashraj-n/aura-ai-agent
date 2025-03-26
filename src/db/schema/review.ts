import { pgTable, text, pgEnum, timestamp } from "drizzle-orm/pg-core";

const validTasks = [
    "started",
    "cloning",
    "indexing",
    "reviewing",
    "done",
    "errored",
] as const;
export type reviewStatus = (typeof validTasks)[number];
export const reviewStatus = pgEnum("review_status", validTasks);

export const reviews = pgTable("reviews", {
    id: text("id").primaryKey(),
    prLink: text("pr_link").notNull(),
    status: reviewStatus("status").notNull(),
    review: text("review"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
});
