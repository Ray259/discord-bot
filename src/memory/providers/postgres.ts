import { ChatMessage } from '../types';
import { saveContext, getRelevantContext } from '../vectorStore';
import { logger } from '../../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This replaces the old in-memory map
export const PostgresProvider = {
    addMessage: async (userId: string, message: ChatMessage) => {
        try {
            // 1. Save to relational DB (History)
            await prisma.message.create({
                data: {
                    userId,
                    role: message.role,
                    parts: message.parts
                }
            });
            
            // 2. Save USER messages to Vector Store (Search context)
            if (message.role === 'user') {
                await saveContext(message.parts, { userId, role: message.role });
                logger.info(`Saved message to Postgres/Vector for user ${userId}`);
            }
        } catch (error) {
            logger.error('Error in PostgresProvider.addMessage', error);
        }
    },

    getHistory: async (userId: string): Promise<ChatMessage[]> => {
        try {
            // Fetch last 10 messages for immediate context
            const messages = await prisma.message.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            
            // Reverse to ascending order for LLM context
            return messages.reverse().map(m => ({
                role: m.role as 'user' | 'model',
                parts: m.parts
            }));
        } catch (error) {
            logger.error('Error in PostgresProvider.getHistory', error);
            return [];
        }
    },

    // RAG specific method
    getContext: async (userId: string, query: string) => {
        return await getRelevantContext(userId, query);
    }
};
