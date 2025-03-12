import { authenticatedUser } from "../app";
import Embeddings from "../core/embeddings";
import FastIndexer from "../core/indexer";

export type IndexEmbedResponse = {
    chunks: string[];
    embeddings: Embeddings;
};

export async function indexAndEmbedRepo(
    repoPath: string
): Promise<IndexEmbedResponse> {
    const fastIndexer = new FastIndexer(repoPath);
    const chunks = await fastIndexer.generateChunks();
    const Embeder = new Embeddings(repoPath);
    await Embeder.generateEmbeddings(chunks);
    return {
        chunks,
        embeddings: Embeder,
    };
}


