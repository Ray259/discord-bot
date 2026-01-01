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
    tableName: "documents" as any, // Explicit table name mapped in schema
    vectorColumnName: "embedding",
    columns: {
      id: PrismaVectorStore.IdColumn,
      content: PrismaVectorStore.ContentColumn,
    },
  }
);

export async function saveContext(content: string, metadata: Record<string, any> = {}) {
  try {
    // 1. Generate Embedding
    const embedding = await embeddings.embedQuery(content);
    const vectorString = `[${embedding.join(',')}]`;

    // 2. Save Content & Embedding
    // Using prisma.document and raw query for vector update to support pgvector
    const doc = await prisma.document.create({
        data: {
            content,
            metadata: metadata || {},
        }
    });

    // 3. Update with Vector
    const id = doc.id;
    await prisma.$executeRaw`UPDATE "documents" SET embedding = ${vectorString}::vector WHERE id = ${id}`;
    
  } catch (error) {
    console.error("Error saving context manually:", error);
    throw error;
  }
}

export async function getRelevantContext(userId: string, query: string, k: number = 3) {
    // Filter in-memory to ensure strict user isolation
    const result = await vectorStore.similaritySearch(query, k * 5); 
    
    return result
        .filter(doc => {
            const docUserId = (doc.metadata as any).userId;
            return docUserId === userId;
        })
        .slice(0, k);
}
