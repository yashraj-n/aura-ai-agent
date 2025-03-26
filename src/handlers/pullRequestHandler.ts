import { Context } from "probot";
import { createPullRequestComment, getPullRequestPatch } from "../utils/github";
import { Git } from "../git";
import { logger } from "../logger";
import { indexAndEmbedRepo } from "../utils";
import { transformStructural } from "../core/llm/structure";
import { generateReview } from "../core/llm/review";
import { z } from "zod";
import { ZReviewLLMSchema } from "../types/zod";
import { generateReviewMarkdown } from "../utils/markdown";
import ReviewManager from "../utils/review-manager";
import { dashboardConfig } from "../config/dashboard";

export const handlePullRequestOpened = async (
    context: Context<"pull_request.opened">
): Promise<any> => {
    let id = `${new Date().getTime()}-${context.payload.number}-${
        context.payload.repository.owner.login
    }-${context.payload.repository.name}`;
    let reviewManager = new ReviewManager({
        id: id,
        prLink: context.payload.pull_request.html_url,
        status: "started",
    });

    const [_review, patch] = await Promise.all([
        reviewManager.createReview(),
        getPullRequestPatch(context),
        createPullRequestComment(
            context,
            `Doing a security review for this PR, You can see the progress on the dashboard [here](${dashboardConfig.url}/Review/${id})`
        ),
    ]);
    const [_c, accessToken] = await Promise.all([
        reviewManager.setReviewStatus("cloning"),
        context.octokit.apps.createInstallationAccessToken({
            installation_id: context.payload.installation!.id,
        }),
    ]);

    const gitClient = new Git(
        {
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
        },
        accessToken.data.token
    );

    const clonedPath = await gitClient.cloneRepository();
    await reviewManager.setReviewStatus("indexing");

    if (!clonedPath) {
        logger.error("Failed to clone repository");
        return createPullRequestComment(context, "Failed to clone repository");
    }

    try {
        const embeddingsData = await indexAndEmbedRepo(clonedPath);
        await reviewManager.setReviewStatus("reviewing");
        const unStructuredReview = await generateReview(
            clonedPath,
            patch,
            embeddingsData
        );
        const strucuted = await transformStructural<
            z.infer<typeof ZReviewLLMSchema>
        >(unStructuredReview, ZReviewLLMSchema);
        console.log("unStructuredReview", unStructuredReview);
        const markdown = generateReviewMarkdown(strucuted);

        await reviewManager.setReviewStatus("done"),
            await reviewManager.setReviewReview(markdown);
        await createPullRequestComment(context, markdown);
        await reviewManager.setReviewEndedAt();
    } catch (error) {
        logger.error("Error cloning repository: ", error);
    } finally {
        await gitClient.cleanup();
    }
};
