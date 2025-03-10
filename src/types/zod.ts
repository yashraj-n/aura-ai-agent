import { z } from "zod";

export const ZReviewLLMSchema = z.array(
    z.object({
        fileName: z.string().describe("The name of the file"),
        description: z
            .string()
            .describe("What is the issue/bug about, describe it"),
        type: z
            .enum(["SECURITY", "PERFOMANCE", "LOGIC", "MISC"])
            .describe("The type of issue "),
        severity: z
            .enum(["LOW", "MEDIUM", "HIGH"])
            .describe("The severity of the issue"),
        snippet: z.string().describe("A code snippet that shows the issue"),
        fix: z.string().describe("Snippet of the fix"),
    })
);

export const ZMessageParseSchema = z.object({
    type: z
        .enum(["FEATURE", "REVIEW", "NONE"])
        .describe("The type of action to be taken"),
    message: z.string().describe("The message to the user"),
});
