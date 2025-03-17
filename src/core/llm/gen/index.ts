import { claudeHaiku, codestral } from "../../../lib/models";
import { ToolCallManager } from "../../tools/fs";
import { generateText } from "ai";
import prompts from "../../../lib/prompts";
import { logger } from "../../../logger";
import { AISDKExporter } from "langsmith/vercel";
import type { IndexEmbedResponse } from "../../../utils";

const model = claudeHaiku;

export async function generateChanges(
    repoPath: string,
    plan: string,
    embeddingsData: IndexEmbedResponse
) {
    logger.info(`Starting code changes generation for repository: ${repoPath}`);
    const {
        ReadDirectory,
        ReadFile,
        GetAllFiles,
        WriteFile,
        CreateFile,
        CreateDirectory,
    } = new ToolCallManager(repoPath);
    const {
        embeddings: { FindRelevantEmbeddings },
    } = embeddingsData;

    logger.info("Calling LLM to generate code changes...");
    try {
        const response = await generateText({
            model,
            system: prompts.CODE_GENERATION,
            messages: [{ role: "user", content: plan }],
            tools: {
                ReadDirectory,
                ReadFile,
                GetAllFiles,
                // FindRelevantEmbeddings,
                WriteFile,
                CreateFile,
                CreateDirectory,
            },
            toolChoice: "auto",
            maxSteps: 1000,
            maxRetries: 3,
            onStepFinish: (stepResult) => {
                logger.debug("Step Finish: ", stepResult);
            },
            experimental_telemetry: AISDKExporter.getSettings({
                runName: "Code Generation",
            }),
        });
        logger.info("Code changes generation completed successfully");
        return response.text;
    } catch (error) {
        logger.error(
            `Error generating code changes: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        throw error;
    }
}
