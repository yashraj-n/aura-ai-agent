import { mistral, openRouter } from "../../lib/models";
import { ToolCallManager } from "../../tools/fs";
import { generateObject, generateText, Output } from "ai";
import prompts from "../../lib/prompts";
import { AISDKExporter } from "langsmith/vercel";
import { indexAndEmbedRepo } from "../../utils/utils";
import { logger } from "../../logger";

export async function generateReview(repoPath: string, patches: string) {
  const {
    embeddings: { FindRelevantEmbeddings },
  } = await indexAndEmbedRepo(repoPath);

  const { ReadDirectory, ReadFile, GetAllFiles } = new ToolCallManager(
    repoPath
  );
  const response = await generateText({
    model: mistral,
    // experimental_output: Output.object({
    //   schema: ZReviewLLMSchema,
    // }),
    system: prompts.CODE_REVIEW,
    messages: [
      {
        role: "user",
        content: patches,
      },
    ],
    maxRetries: 3,
    experimental_telemetry: AISDKExporter.getSettings(),
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
    temperature: 0.75,
  });

  return response.text;
}
