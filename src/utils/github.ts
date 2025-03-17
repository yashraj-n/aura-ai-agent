import type { Context } from "probot";
import { parseMessage } from "../core/llm/message-parse";
import config from "../../config";

export function isSelfMentioned(comment: string): boolean {
    const mentionPattern = new RegExp(
        `@${config.APP_NAME}\\b|\\b${config.APP_NAME}\\b`,
        "i"
    );

    return mentionPattern.test(comment);
}

// wrapper for parseMessage
export async function calculateWhatToDo(comment: string) {
    return await parseMessage(comment);
}

export async function createIssueComment(
    context: Context<"issue_comment.created">,
    comment: string
) {
    return await context.octokit.rest.issues.createComment({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: context.payload.issue.number,
        body: comment,
    });
}

export async function createPullRequestComment(
    context: Context<"pull_request.opened">,
    comment: string
) {
    const {
        pull_request: { number: issue_number },
        repository: { owner, name: repo },
    } = context.payload;

    return await context.octokit.rest.issues.createComment({
        owner: owner.login,
        repo,
        issue_number,
        body: comment,
    });
}
export async function getPullRequestPatch(
    context: Context<"pull_request.opened">
) {
    return (
        await context.octokit.request(
            "GET /repos/{owner}/{repo}/pulls/{pull_number}",
            {
                owner: context.payload.repository.owner.login,
                repo: context.payload.repository.name,
                pull_number: context.payload.pull_request.number,
                headers: {
                    Accept: "application/vnd.github.v3.patch",
                },
            }
        )
    ).data as unknown as string;
}
