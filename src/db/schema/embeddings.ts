import { index, pgTable, text, varchar, vector, serial } from 'drizzle-orm/pg-core';

export const embeddings = pgTable(
  'embeddings',
  {
    id: serial('id')
      .primaryKey(),
    repo_id: varchar('repo_id', { length: 191 }).notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
  },
  table => ({
    embeddingIndex: index('embeddingIndex').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  }),
);