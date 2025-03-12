import type { Context } from "probot";
import { authenticatedUser } from "../app";
import { parseMessage } from "../core/llm/message-parse";

export function isSelfMentioned(comment: string): boolean {
    if (!authenticatedUser?.data?.name) {
        return false;
    }

    const escapedName = authenticatedUser.data.name.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

    const mentionPattern = new RegExp(
        `@${escapedName}\\b|\\b${escapedName}\\b`,
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
