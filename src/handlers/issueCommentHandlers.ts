import { Context } from "probot";
import { logger } from "../logger";
import { isSelfMentioned } from "../utils";

export const handleIssueCommentCreated = async (
    context: Context<"issue_comment.created">
): Promise<void> => {
    try {
        if (isSelfMentioned(context.payload.comment.body)) {
            logger.info(
                "Self mentioned in issue comment:",
                context.payload.comment.body
            );
            const reply = await context.octokit.rest.issues.createComment({
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name,
                issue_number: context.payload.issue.number,
                body: "# REAL",
            });
            logger.info("Reply created:", reply.data);
        }
    } catch (error) {
        logger.error("Error handling issue comment:", error);
        throw error;
    }
};
