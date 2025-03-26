import { tasks, type taskStatus } from "../db/schema/tasks";
import { db } from "../db/index";
import { eq } from "drizzle-orm";

export default class TasksManager {
    private tasksDetails: typeof tasks.$inferInsert;
    constructor(tasksDetails: typeof tasks.$inferInsert) {
        this.tasksDetails = tasksDetails;
    }

    async createTask() {
        return await db.insert(tasks).values(this.tasksDetails);
    }

    async setTaskStatus(
        status: taskStatus,
        plan?: string | undefined,
        prLink?: string | undefined
    ) {
        return await db
            .update(tasks)
            .set({ status, plan, pr_link: prLink })
            .where(eq(tasks.id, this.tasksDetails.id));
    }

    async setTaskEndedAt() {
        return await db
            .update(tasks)
            .set({ endedAt: new Date() })
            .where(eq(tasks.id, this.tasksDetails.id));
    }
}
