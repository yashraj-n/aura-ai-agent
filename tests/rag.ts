import fs from "fs/promises";
import { glob } from "glob";
import { ollama } from "ollama-ai-provider";
import { embedMany, generateText, tool } from "ai";
import { db } from "../src/db";
import { embeddings as embeddingsTable } from "../src/db/schema/embeddings";
import { cosineDistance, desc, gt, sql, eq, and } from "drizzle-orm";
import { mistral } from "../src/lib/models";
import { z } from "zod";
const files = await glob("./sample_project/**/*");
const CHUNK_SIZE = 100;

const allData = await Promise.all(
  files.map(async (file) => {
    const content = await fs.readFile(file, "utf-8");
    return {
      file,
      content,
    };
  })
);
// generate embeddings such that each file has ####### <FILE_NAME> ####### <FILE_CONTENT>

const embeddingModel = ollama.embedding("nomic-embed-text");

const generateEmbeddings = async (prompt: string[]) => {
  const chunks = prompt
    .map((c) => {
      const lines = c.split("\n");
      const chunk = lines.slice(0, CHUNK_SIZE).join("\n");
      return chunk;
    })
    .flat();
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((embedding, index) => ({
    repo_id: "sample_project",
    content: chunks[index],
    embedding: embedding,
  }));
};

const embeddings = await generateEmbeddings(
  allData.map((data) => data.content)
);

await db.insert(embeddingsTable).values(embeddings);

const findRelevantEmbeddings = async (prompt: string) => {
  const userQueryEmbedded = await generateEmbeddings([prompt]);
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddingsTable.embedding,
    userQueryEmbedded[0].embedding
  )})`;
  const relevantEmbeddings = await db
    .select()
    .from(embeddingsTable)
    .where(and(gt(similarity, 0.5), eq(embeddingsTable.repo_id, "sample_project")));

  const relevantContent = relevantEmbeddings.map(
    (embedding) => embedding.content
  );
  return relevantContent;
};

const text = await generateText({
  model: mistral,
  prompt:
    "Does the code implement concurrency programming? use the getInformation tool to do semantic search on vector database of codebase? hint: search for p-limit maybe",
  tools: {
    getInformation: tool({
      description: "Get information about the code",
      parameters: z.object({
        prompt: z.string(),
      }),
      execute: async ({ prompt }) => {
        return findRelevantEmbeddings(prompt);
      },
    }),
  },
  onStepFinish: async (step) => {
    console.log("Step: ", step);
  },
  maxSteps: 1000,
});

console.log(text.text);
