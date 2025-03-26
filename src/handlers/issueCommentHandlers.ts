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
import TasksManager from "../utils/task-manager";
import { dashboardConfig } from "../config/dashboard";

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
        const threads = await transformIssueToThread(context);

        let id = `${new Date().getTime()}-${context.payload.issue.number}-${
            context.payload.repository.owner.login
        }-${context.payload.repository.name}`;
        let generatedTask = new TasksManager({
            issueId: context.payload.issue.number.toString(),
            issueTitle: context.payload.issue.title,
            issueUrl: context.payload.issue.html_url,
            threads,
            status: "started",
            id: id,
        });

        await Promise.all([
            generatedTask.createTask(),
            createIssueComment(
                context,
                `Creating a task for this issue, You can see the progress on the dashboard [here](${dashboardConfig.url}/Task/${id})`
            ),
        ]);

        const {
            data: { token },
        } = await context.octokit.apps.createInstallationAccessToken({
            installation_id: context.payload.installation!.id,
        });

        await generatedTask.setTaskStatus("cloning");

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
            await generatedTask.setTaskStatus("indexing");
            const embeddingsData = await indexAndEmbedRepo(clonedPath);
            await generatedTask.setTaskStatus("planning");
            const plan = await generatePlan(
                clonedPath,
                threads,
                embeddingsData
            );
            console.log("Plan: ", plan);
            await generatedTask.setTaskStatus("generating", plan);
            const codeGen = await generateChanges(
                clonedPath,
                plan,
                embeddingsData
            );
            console.log("Code gen output: ", codeGen);
            await generatedTask.setTaskStatus("pushing");
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
            await generatedTask.setTaskStatus(
                "done",
                undefined,
                pr.data.html_url
            );
            await createIssueComment(
                context,
                `## Task Finished\nThe task has been finished and a Pull Request had been created.\nYou can review the PR [here](${pr.data.html_url})`
            );

            await generatedTask.setTaskEndedAt();
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
