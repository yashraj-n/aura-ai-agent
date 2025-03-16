import { Context } from "probot";
import { logger } from "../logger";
import {
    isSelfMentioned,
    calculateWhatToDo,
    createIssueComment,
} from "../utils/github";
import { Git } from "../git";
import { indexAndEmbedRepo } from "../utils";
import { generateReview } from "../core/llm/review";
import { transformStructural } from "../core/llm/structure";
import { ZReviewLLMSchema } from "../types/zod";
import { z } from "zod";
import { generateReviewMarkdown } from "../utils/markdown";
import { generatePlan } from "../core/llm/plan";
import { generateChanges } from "../core/llm/gen";

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
        } else if (taskTodo.type === "REVIEW")
            // Review is only available when there are file changes (Pull Request)
            return createIssueComment(
                context,
                "Review is only available when there are file changes (Pull Request)"
            );
        const {
            data: { token },
        } = await context.octokit.apps.createInstallationAccessToken({
            installation_id: context.payload.installation!.id,
        });

        const gitClient = new Git(
            {
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name,
            },
            token
        );

        const clonedPath = await gitClient.cloneRepository();

        if (!clonedPath) {
            logger.error("Failed to clone repository");
            return createIssueComment(context, "Failed to clone repository");
        }

        try {
            const threads = await transformIssueToThread(context);
            const embeddingsData = await indexAndEmbedRepo(clonedPath);
            const plan = await generatePlan(
                clonedPath,
                threads,
                embeddingsData
            );
            console.log("Plan: ", plan);

            const codeGen = await generateChanges(
                clonedPath,
                plan,
                embeddingsData
            );
            console.log("Code gen output: ", codeGen);

            const branchName = await gitClient.createPullRequest(
                context.payload.issue.number
            );

            logger.info(`branch created: ${branchName}`);

            // Get the default branch of the repository
            const { data: repo } = await context.octokit.rest.repos.get({
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name,
            });

            // Creating a PR using the default branch as base
            const pr = await context.octokit.rest.pulls.create({
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name,
                title: `Feature Request for issue #${context.payload.issue.number}`,
                head: branchName,
                base: repo.default_branch,
            });

            logger.info(`PR created: ${pr.data.html_url}`);

            await createIssueComment(
                context,
                `## Task Finished\nThe task has been finished and a Pull Request had been created.\nYou can review the PR [here](${pr.data.html_url})`
            );
        } catch (error) {
            logger.error("Error generating plan:", error);
            return createIssueComment(
                context,
                "An error occurred while generating the plan"
            );
        } finally {
            await gitClient.cleanup();
        }
    } catch (error) {
        logger.error("Error handling issue comment:", error);
        throw error;
    }
};
const transformIssueToThread = async (
    context: Context<"issue_comment.created">
): Promise<string[]> => {
    const issueTitle = context.payload.issue.title;
    const issueBody = context.payload.issue.body;
    const issueComments = (
        await context.octokit.rest.issues.listComments({
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
            issue_number: context.payload.issue.number,
        })
    ).data.slice(0, 10);

    return [
        `# Title: ${issueTitle}`,
        `### Body: ${issueBody}`,
        ...issueComments.map(
            (comment) => `${comment.user?.login}: ${comment.body}`
        ),
    ];
};
