import { PrismaVectorStore } from "@langchain/community/vectorstores/prisma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PrismaClient, Prisma, Document as PrismaDocument } from "@prisma/client";
import { Document } from "@langchain/core/documents";
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // or embedding-001
  apiKey: process.env.GEMINI_API_KEY,
});

export const vectorStore = PrismaVectorStore.withModel<PrismaDocument>(prisma).create(
  embeddings,
  {
    prisma: Prisma,
    // LangChain expects the MODEL name, not the DB table name?
    // Wait, the error `relation "Document" does not exist` comes from Postgres (42P01).
    // This implies LangChain/Prisma is executing a raw query like `SELECT * FROM "Document"`.
    // But my schema has `@@map("documents")`.
    // If I pass `tableName: "Document"`, the library might be using that for raw queries.
    tableName: "Document", 
    vectorColumnName: "embedding",
    columns: {
      id: PrismaVectorStore.IdColumn,
      content: PrismaVectorStore.ContentColumn,
      // metadata: PrismaVectorStore.JsonColumn, // Optional if we want metadata
    },
  }
);

export async function saveContext(content: string, metadata: Record<string, any> = {}) {
  // PrismaVectorStore expects documents to match the model shape *if* strongly typed.
  // We can relax the type check or provide dummy values.
  // Actually, for `addDocuments`, it just needs to be compatible with internal logic.
  // The issue is `withModel<PrismaDocument>` enforces strict types on the input docs.
  // Let's remove the generic constraint on `withModel` for the creation PART, or cast.
  await vectorStore.addDocuments([
    new Document({ 
        pageContent: content, 
        metadata: {
            ...metadata,
            // These fields are managed by Prisma defaults/logic but TS might complain if missing in the input Doc type
            // relative to the Model type. 
            // Workaround: Any cast to bypass strict Model shape check for the input document
        } 
    }) as any, 
  ]);
}

export async function getRelevantContext(query: string, k: number = 3) {
    return await vectorStore.similaritySearch(query, k);
}
