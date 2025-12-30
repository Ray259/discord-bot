import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { SYSTEM_INSTRUCTION } from '../promptBuilder';
import { userMemory } from '../../memory/userMemory';
import { PostgresProvider } from '../../memory/providers/postgres';
import { logger } from '../../utils/logger';
import { AIProvider } from '../types';
import { config } from '../../config';
import dotenv from 'dotenv';

dotenv.config();

export class GeminiProvider implements AIProvider {
    private model: any;
    private safetySettings: any;

    constructor() {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            logger.warn('GEMINI_API_KEY is not set in environment variables.');
        }

        const genAI = new GoogleGenerativeAI(API_KEY || '');
        this.model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-lite',
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        this.safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];
    }

    async getChatResponse(userId: string, userInput: string): Promise<string> {
        try {
            // 1. Fetch Recent History (Short-term)
            const recentHistory = await PostgresProvider.getHistory(userId);
            
            // 2. RAG Retrieval (Long-term context)
            const relevantDocs = await PostgresProvider.getContext(userId, userInput);
            const contextText = relevantDocs.map((d: any) => d.pageContent).join("\n---\n");
            
            logger.info(`Using provider: Gemini (RAG Mode) | User: ${userId} | Context Docs: ${relevantDocs.length}`);

            // 3. Construct Prompt with Context
            const augmentedPrompt = `Context from previous conversations:\n${contextText}\n\nUser Question: ${userInput}`;

            const chatHistory = recentHistory.map((msg: any) => ({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: msg.parts }],
            }));
            
            // 4. Start Chat with History
            const chat = this.model.startChat({
                history: chatHistory,
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                },
                safetySettings: this.safetySettings,
            });

            const result = await chat.sendMessage(augmentedPrompt);
            const responseText = result.response.text();

            // 5. Save interactions
            await PostgresProvider.addMessage(userId, { role: 'user', parts: userInput });
            await PostgresProvider.addMessage(userId, { role: 'model', parts: responseText });

            return responseText;
        } catch (error: any) {
            logger.error('Error getting response from Gemini:', error);
            if (error.message?.includes('429')) {
                return config.bot.errors.rateLimit;
            }
            throw error;
        }

    }

    async getDirectCorrection(text: string): Promise<string> {
        try {
            const prompt = config.prompts.correction.replace('{text}', text);

            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (e) {
            logger.error("Error in getDirectCorrection", e);
            throw e; // Enable fallback
        }
    }
}
