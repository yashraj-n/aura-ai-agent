import { Probot } from "probot";
import { handleIssueCommentCreated } from "../handlers/issueCommentHandlers";
import { logger } from "../logger";
import { type RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";


export const initializeApp = (app: Probot): void => {
    // Global error handler
    app.onError((error) => {
        logger.error("Unhandled error:", error);
    });

    // Register event handlers
    app.on("issue_comment.created", handleIssueCommentCreated);

    // Additional app initialization
    app.load(async (app) => {
        logger.info("App loaded successfully");
    });
};
