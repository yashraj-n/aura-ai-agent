import { gemini, mistralSmall } from "../../../lib/models";
import { generateObject } from "ai";
import { z } from "zod";
import prompts from "../../../lib/prompts";
import { AISDKExporter } from "langsmith/vercel";
export async function transformStructural<T>(
    response: string,
    schema: z.ZodSchema
): Promise<T> {
    const { object } = await generateObject({
        model: mistralSmall,
        schema,
        system: prompts.STRUCTURAL_TRANSFORM,
        messages: [
            {
                role: "user",
                content: response,
            },
        ],
        maxRetries: 3,
        experimental_telemetry: AISDKExporter.getSettings({
            runName: "Structural Transform",
        }),
    });
    return object;
}
