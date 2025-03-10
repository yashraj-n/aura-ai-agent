import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createMistral } from "@ai-sdk/mistral";

export const gemini = createOpenRouter({
  apiKey: process.env.OPEN_ROUTER_API_KEY,
})
("google/gemini-2.0-flash-exp:free");
// ("google/gemini-2.0-pro-exp-02-05:free");

export const mistralSmall = createMistral({
  apiKey: process.env.MISTRAL_API_KEY,
})("mistral-small-latest");


export const codestral = createMistral({
  apiKey: process.env.MISTRAL_API_KEY,
})("codestral-latest");
