import { codestral } from "../../../lib/models";
import { ToolCallManager } from "../../tools/fs";
import { generateText } from "ai";
import prompts from "../../../lib/prompts";
import { logger } from "../../../logger";
import { AISDKExporter } from "langsmith/vercel";
import type { IndexEmbedResponse } from "../../../utils";

export async function generatePlan(
    repoPath: string,
    threads: string[],
    embeddingsData: IndexEmbedResponse
) {
    logger.info(`Starting plan generation for repository: ${repoPath}`);
    const {
        embeddings: { FindRelevantEmbeddings },
    } = embeddingsData;
    const { ReadDirectory, ReadFile, GetAllFiles } = new ToolCallManager(
        repoPath
    );
    logger.debug(`Processing ${threads.length} conversation threads`);
    let userMessage = threads.join("\n");

    logger.info("Calling LLM to generate plan...");
    try {
        const response = await generateText({
            model: codestral,
            system: prompts.PLAN_GENERATION,
            messages: [{ role: "user", content: userMessage }],
            tools: {
                ReadDirectory,
                ReadFile,
                GetAllFiles,
                FindRelevantEmbeddings,
            },
            toolChoice: "auto",
            maxSteps: 1000,
            onStepFinish: (stepResult) => {
                logger.debug("Step Finish: ", stepResult);
            },
            experimental_telemetry: AISDKExporter.getSettings({
                runName: "Plan Generation",
            }),
        });
        logger.info("Plan generation completed successfully");
        return response.text;
    } catch (error) {
        logger.error(`Error generating plan: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
