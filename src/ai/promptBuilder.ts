// src/ai/promptBuilder.ts
import { config } from '../config';

export const SYSTEM_INSTRUCTION = config.systemInstruction;

export function buildPrompt(history: string, userInput: string): string {
    return `
Conversation History:
${history}

User: ${userInput}
Model:
`;
}
