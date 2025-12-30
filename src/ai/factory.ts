import { AIProvider } from './types';
import { GeminiProvider } from './providers/gemini';
import { G4FProvider } from './providers/g4f';
import { FallbackProvider } from './providers/fallback';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

let instance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
    if (instance) return instance;

    const providerType = process.env.AI_PROVIDER || 'gemini';

    logger.info(`Initializing AI Provider: ${providerType}`);

    if (providerType.toLowerCase() === 'g4f') {
        instance = new G4FProvider();
    } else if (providerType.toLowerCase() === 'gemini') {
        instance = new GeminiProvider();
    } else {
        // Default to Fallback strategy if not explicitly set to single provider
        // or if set to 'fallback' or 'auto'
        const gemini = new GeminiProvider();
        const g4f = new G4FProvider();
        instance = new FallbackProvider(gemini, g4f);
    }

    return instance;
}
