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

export const handlePullRequestOpened = async (
    context: Context<"pull_request.opened">
): Promise<any> => {
    const patch = await getPullRequestPatch(context);
    await createPullRequestComment(context, "## Generating Review...");
    const accessToken =
        await context.octokit.apps.createInstallationAccessToken({
            installation_id: context.payload.installation!.id,
        });
    const gitClient = new Git(
        {
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
        },
        accessToken.data.token
    );

    const clonedPath = await gitClient.cloneRepository();

    if (!clonedPath) {
        logger.error("Failed to clone repository");
        return createPullRequestComment(context, "Failed to clone repository");
    }

    try {
        const embeddingsData = await indexAndEmbedRepo(clonedPath);
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
        await createPullRequestComment(context, markdown);
    } catch (error) {
        logger.error("Error cloning repository: ", error);
    } finally {
        await gitClient.cleanup();
    }
};
