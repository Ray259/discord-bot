import { PrismaVectorStore } from "@langchain/community/vectorstores/prisma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PrismaClient, Prisma, Document as PrismaDocument } from "@prisma/client";
import { Document } from "@langchain/core/documents";
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001", // Updated to supported model name
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

export async function saveContext(
    content: string, 
    userId: string | null, 
    contextId: string | null, 
    isPublic: boolean = false, 
    metadata: Record<string, any> = {}
) {
  try {
    const embedding = await embeddings.embedQuery(content);
    const vectorString = `[${embedding.join(',')}]`;

    const doc = await prisma.document.create({
        data: {
            content,
            userId,
            contextId,
            isPublic,
            metadata: { ...metadata, userId, contextId, isPublic },
        }
    });

    const id = doc.id;
    await prisma.$executeRaw`UPDATE "documents" SET embedding = ${vectorString}::vector WHERE id = ${id}`;
    
  } catch (error) {
    console.error("Error saving context:", error);
    throw error;
  }
}

export async function getRelevantContext(userId: string, contextId: string, query: string, k: number = 3) {
    // Perform similarity search
    // We fetch a larger pool then manually filter to ensure strict privacy logic
    const result = await vectorStore.similaritySearch(query, k * 5); 
    
    return result
        .filter(doc => {
            const m = doc.metadata as any;
            // Isolation Logic:
            // 1. Must match the current context (Server/DM)
            if (m.contextId !== contextId) return false;
            
            // 2. Either it is PUBLIC or it belongs to the CURRENT user
            return m.isPublic === true || m.userId === userId;
        })
        .slice(0, k);
}
