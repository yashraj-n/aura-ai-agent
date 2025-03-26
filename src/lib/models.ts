import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createMistral } from "@ai-sdk/mistral";
import { createAnthropic } from "@ai-sdk/anthropic";

export const claudeHaiku = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})("claude-3-5-sonnet-latest");

export const mistralSmall = createMistral({
    apiKey: process.env.MISTRAL_API_KEY,
})("mistral-small-latest");

export const codestral = createMistral({
    apiKey: process.env.MISTRAL_API_KEY,
})("codestral-latest");
