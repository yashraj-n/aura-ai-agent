import { codestral, gemini } from "../../../lib/models";
import { ToolCallManager } from "../../tools/fs";
import { generateObject, generateText, Output } from "ai";
import prompts from "../../../lib/prompts";
import { AISDKExporter } from "langsmith/vercel";
import { type IndexEmbedResponse } from "../../../utils";
import { logger } from "../../../logger";

export async function generateReview(
    repoPath: string,
    patches: string,
    embeddingsData: IndexEmbedResponse
) {
    const {
        embeddings: { FindRelevantEmbeddings },
    } = embeddingsData;

    const { ReadDirectory, ReadFile, GetAllFiles } = new ToolCallManager(
        repoPath
    );
    const response = await generateText({
        model: codestral,
        system: prompts.CODE_REVIEW,
        messages: [
            {
                role: "user",
                content: patches,
            },
        ],
        maxRetries: 3,
        experimental_telemetry: AISDKExporter.getSettings({
            runName: "Code Review",
        }),
        toolChoice: "auto",
        maxSteps: 1000,
        tools: {
            ReadDirectory,
            ReadFile,
            GetAllFiles,
            FindRelevantEmbeddings,
        },
        onStepFinish: (step) => {
            logger.debug("Step: ", step);
        },
        // temperature: 0.4,
    });

    return response.text;
}
