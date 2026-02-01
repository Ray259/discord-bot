import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { SYSTEM_INSTRUCTION } from '../promptBuilder';
import { PostgresProvider } from '../../memory/providers/postgres';
import { logger } from '../../utils/logger';
import { AIProvider, BrainResponse } from '../types';
import { config } from '../../config';
import dotenv from 'dotenv';

dotenv.config();

export class GeminiProvider implements AIProvider {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private safetySettings: any;
    private modelName: string;

    constructor(modelName?: string) {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            logger.warn('GEMINI_API_KEY is not set in environment variables.');
        }

        this.modelName = modelName || 'gemini-2.5-flash';
        this.genAI = new GoogleGenerativeAI(API_KEY || '');
        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            systemInstruction: SYSTEM_INSTRUCTION,
        });

        this.safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];
    }


    async getChatResponse(userId: string, contextId: string, userInput: string): Promise<string> {
        // 1. Fetch Recent History (Short-term)
        const recentHistory = await PostgresProvider.getHistory(contextId);

        // 2. RAG Retrieval (Long-term context)
        const relevantDocs = await PostgresProvider.getContext(userId, contextId, userInput);
        const contextText = relevantDocs.map((d: any) => d.pageContent).join("\n---\n");

        logger.info(`Using Gemini (${this.modelName}) | User: ${userId} | Context Docs: ${relevantDocs.length}`);

        // 3. Construct Prompt with Context
        const augmentedPrompt = `Context from previous conversations:\n${contextText}\n\nUser Input: ${userInput}`;

        const chatHistory = recentHistory.map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.parts }],
        }));

        // 4. Start Chat with History
        const chat = this.model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7,
            },
            safetySettings: this.safetySettings,
        });

        const result = await chat.sendMessage(augmentedPrompt);
        const responseText = result.response.text();

        // 5. Save interactions
        await PostgresProvider.addMessage(userId, contextId, { role: 'user', parts: augmentedPrompt });
        await PostgresProvider.addMessage(userId, contextId, { role: 'model', parts: responseText });

        return responseText;
    }

    async getDirectCorrection(text: string): Promise<string> {
        const prompt = config.prompts.correction.replace('{text}', text);
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    async getBrainResponse(userId: string, userInput: string, history: any[], memoryContext: string): Promise<BrainResponse> {
        const systemPrompt = `${SYSTEM_INSTRUCTION}\n\n${config.coordinatorInstruction}`;
        const userPrompt = `
Context from previous conversations:
${memoryContext}

User Message: ${userInput}

Recent History:
${JSON.stringify(history, null, 2)}

Respond with JSON.
`;

        const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: systemPrompt,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const text = result.response.text();
        const parsed = JSON.parse(text) as BrainResponse;
        // Normalize: ensure actions is always an array
        if (!Array.isArray(parsed.actions)) {
            logger.warn(`BrainResponse missing 'actions' array. Raw: ${text.substring(0, 200)}`);
            parsed.actions = [];
        }
        return parsed;
    }
}
