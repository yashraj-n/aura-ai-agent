import { mistralSmall } from "../../../lib/models";
import { generateObject } from "ai";
import prompts from "../../../lib/prompts";
import { AISDKExporter } from "langsmith/vercel";
import { ZMessageParseSchema } from "../../../types/zod";

export async function parseMessage(message: string) {
    const { object } = await generateObject({
        model: mistralSmall,
        schema: ZMessageParseSchema,
        system: prompts.MESSAGE_PARSE,
        messages: [
            {
                role: "user",
                content: message,
            },
        ],
        maxRetries: 3,
        experimental_telemetry: AISDKExporter.getSettings({
            runName: "Message Parse",
        }),
        temperature: 1,
    });
    return object;
}
