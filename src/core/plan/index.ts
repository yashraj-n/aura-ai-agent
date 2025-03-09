import { mistral, openRouter } from "../../lib/models";
import { ToolCallManager } from "../../tools/fs";
import { generateText } from "ai";
import { ZReviewLLMSchema } from "../../types/zod";
import prompts from "../../lib/prompts";
import { logger } from "../../logger";
import { AISDKExporter } from "langsmith/vercel";

export async function generatePlan(repoPath: string, threads: string[]) {
  const { ReadDirectory, ReadFile, GetAllFiles } = new ToolCallManager(
    repoPath
  );
  let userMessage = threads.join("\n");

  const response = await generateText({
    model: openRouter,
    system: prompts.PLAN_GENERATION,
    messages: [{ role: "user", content: userMessage }],
    tools: {
      ReadDirectory,
      ReadFile,
      GetAllFiles,
    },
    toolChoice: "auto",
    maxSteps: 1000,
    onStepFinish: (stepResult) => {
      logger.debug("Step Finish: ", stepResult);
    },
    experimental_telemetry: AISDKExporter.getSettings()
  });
  return response.text;
}
