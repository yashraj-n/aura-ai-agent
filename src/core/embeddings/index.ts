import { ollama } from "ollama-ai-provider";
import { embedMany, tool } from "ai";
import { db } from "../../db";
import { embeddings as embeddingsTable } from "../../db/schema/embeddings";
import { z } from "zod";
import { cosineDistance, gt, sql, eq, and } from "drizzle-orm";
import { logger } from "../../logger";

class Embeddings {
  private readonly EmbeddingsModel = ollama.embedding("nomic-embed-text");

  constructor(private repo_id: string) {
    this.repo_id = repo_id;
  }

  private async embed(prompt: string[]) {
    try {
      logger.info(`Embedding ${prompt.length} prompts`);
      const { embeddings } = await embedMany({
        model: this.EmbeddingsModel,
        values: prompt,
      });
      logger.info(`Successfully embedded ${embeddings.length} prompts`);
      return embeddings;
    } catch (error) {
      logger.error(`Error embedding prompts: ${error}`);
      throw error;
    }
  }

  private async saveEmbeddings(
    embeddings: {
      repo_id: string;
      content: string;
      embedding: number[];
    }[]
  ) {
    try {
      logger.info(`Saving ${embeddings.length} embeddings to database`);
      await db.insert(embeddingsTable).values(embeddings);
      logger.info(`Successfully saved ${embeddings.length} embeddings`);
    } catch (error) {
      logger.error(`Error saving embeddings to database: ${error}`);
      throw error;
    }
  }

  private async findRelevantEmbeddings(prompt: string) {
    try {
      logger.debug(`Finding relevant embeddings for prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
      const userQueryEmbedded = await this.embed([prompt]);
      const similarity = sql<number>`1 - (${cosineDistance(
        embeddingsTable.embedding,
        userQueryEmbedded[0]
      )})`;

      const relevantEmbeddings = await db
        .select()
        .from(embeddingsTable)
        .where(
          and(gt(similarity, 0.5), eq(embeddingsTable.repo_id, this.repo_id))
        );

      logger.debug(`Found ${relevantEmbeddings.length} relevant embeddings`);
      return relevantEmbeddings.map((embedding) => embedding.content);
    } catch (error) {
      logger.error(`Error finding relevant embeddings: ${error}`);
      throw error;
    }
  }

  public async generateEmbeddings(chunks: string[]) {
    try {
      logger.info(`Generating embeddings for ${chunks.length} chunks`);
      const embeddings = await this.embed(chunks);
      const embeddingsData = embeddings.map((embedding, index) => ({
        repo_id: this.repo_id,
        content: chunks[index],
        embedding: embedding,
      }));
      await this.saveEmbeddings(embeddingsData);
      logger.info(`Successfully generated and saved embeddings for ${chunks.length} chunks`);
      return embeddingsData;
    } catch (error) {
      logger.error(`Error generating embeddings: ${error}`);
      throw error;
    }
  }

  public FindRelevantEmbeddings = tool({
    description:
      "Find relevant content from the database by doing semantic search",
    parameters: z.object({
      query: z.string().describe("The query to search for"),
    }),
    execute: async ({ query }) => {
      try {
        logger.info(`Executing FindRelevantEmbeddings tool with query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
        const results = await this.findRelevantEmbeddings(query);
        logger.info(`FindRelevantEmbeddings tool found ${results.length} results`);
        return results;
      } catch (error) {
        logger.error(`Error in FindRelevantEmbeddings tool: ${error}`);
        throw error;
      }
    },
  });
}

export default Embeddings;
