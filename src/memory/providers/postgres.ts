import { ChatMessage } from '../types';
import { saveContext, getRelevantContext } from '../vectorStore';
import { logger } from '../../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This replaces the old in-memory map
export const PostgresProvider = {
    addMessage: async (userId: string, contextId: string, message: ChatMessage) => {
        try {
            await prisma.message.create({
                data: {
                    userId,
                    contextId,
                    role: message.role,
                    parts: message.parts
                }
            });
            logger.info(`Message saved for context ${contextId}`);
        } catch (error) {
            logger.error('Error in PostgresProvider.addMessage', error);
        }
    },

    getHistory: async (contextId: string): Promise<ChatMessage[]> => {
        try {
            const messages = await prisma.message.findMany({
                where: { contextId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            
            return messages.reverse().map(m => ({
                role: m.role as 'user' | 'model',
                parts: m.parts
            }));
        } catch (error) {
            logger.error('Error in PostgresProvider.getHistory', error);
            return [];
        }
    },

    getContext: async (userId: string, contextId: string, query: string) => {
        return await getRelevantContext(userId, contextId, query);
    },

    clearMemory: async (contextId: string) => {
        try {
            await prisma.message.deleteMany({ where: { contextId } });
            logger.info(`Cleared history for context ${contextId}`);
        } catch (error) {
            logger.error('Error in PostgresProvider.clearMemory', error);
        }
    }
};
