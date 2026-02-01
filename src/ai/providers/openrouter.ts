import { AIProvider, BrainResponse } from '../types';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { SYSTEM_INSTRUCTION } from '../promptBuilder';

export class OpenRouterProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private baseUrl: string = 'https://openrouter.ai/api/v1';

    constructor(model?: string) {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.model = model || process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
        
        if (!this.apiKey) {
            logger.warn('OPENROUTER_API_KEY is not set.');
        }
    }

    private async request(path: string, body: any) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://github.com/ray259/bot', // Local dev/Render
                'X-Title': 'Discord bot fr',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OpenRouter API Error (${response.status}): ${errBody}`);
        }

        return await response.json();
    }

    async getChatResponse(userId: string, contextId: string, userInput: string): Promise<string> {
        // Simple chat implementation
        const data = await this.request('/chat/completions', {
            model: this.model,
            messages: [{ role: 'user', content: userInput }]
        });
        return data.choices[0].message.content;
    }

    async getDirectCorrection(text: string): Promise<string> {
        const prompt = config.prompts.correction.replace('{text}', text);
        const data = await this.request('/chat/completions', {
            model: this.model,
            messages: [{ role: 'user', content: prompt }]
        });
        return data.choices[0].message.content;
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

        const data = await this.request('/chat/completions', {
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' }
        });

        const text = data.choices[0].message.content;
        const parsed = JSON.parse(text) as BrainResponse;
        if (!Array.isArray(parsed.actions)) {
            logger.warn(`OpenRouter BrainResponse missing 'actions'. Raw: ${text.substring(0, 200)}`);
            parsed.actions = [];
        }
        return parsed;
    }
}
