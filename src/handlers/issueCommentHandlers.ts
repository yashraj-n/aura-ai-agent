import { Context } from "probot";
import { logger } from "../logger";
import {
    isSelfMentioned,
    calculateWhatToDo,
    createIssueComment,
} from "../utils/github";

export const handleIssueCommentCreated = async (
    context: Context<"issue_comment.created">
): Promise<any> => {
    try {
        if (!isSelfMentioned(context.payload.comment.body)) return;

        logger.info(
            "Self mentioned in issue comment:",
            context.payload.comment.body
        );

        const taskTodo = await calculateWhatToDo(context.payload.comment.body);

        if (taskTodo.type === "NONE") {
            logger.info("No task to do, creating comment");
            return createIssueComment(context, taskTodo.message);
        }

        const repoUrl = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}`;
        const { data: accessToken } =
        await context.octokit.apps.createInstallationAccessToken({
            installation_id: context.payload.installation!.id,
        });
        
       const token = accessToken.token;

        console.log("GitHub Access Token:", token);
        logger.info("GitHub Access Token:", accessToken.token);

        const reply = await context.octokit.rest.issues.createComment({
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
            issue_number: context.payload.issue.number,
            body: `${repoUrl}\n${taskTodo.type}\n${taskTodo.message}`,
        });
        logger.info("Reply created:", reply.data);
    } catch (error) {
        logger.error("Error handling issue comment:", error);
        throw error;
    }
};
