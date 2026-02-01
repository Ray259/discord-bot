import { AIProvider } from './types';
import { GeminiProvider } from './providers/gemini';
import { G4FProvider } from './providers/g4f';
import { OpenRouterProvider } from './providers/openrouter';
import { ManagedPoolProvider } from './providers/managedPool';
import { logger } from '../utils/logger';
import { Brain } from './brain';
import dotenv from 'dotenv';

dotenv.config();

let instance: AIProvider | null = null;

/**
 * Parses the AI_MODEL_POOL environment variable to build a list of providers.
 *
 * The format is a comma-separated list, e.g.:
 *   AI_MODEL_POOL="gemini:gemini-2.5-flash-lite, openrouter:openai/gpt-4o-mini, g4f"
 *
 * Supported prefixes:
 *   - gemini:<model>         -> GeminiProvider with a specific model override
 *   - openrouter:<model>     -> OpenRouterProvider with a specific model override
 *   - g4f                   -> G4FProvider
 */
function parseProviderFromString(key: string): AIProvider {
    const trimmed = key.trim();
    if (trimmed.startsWith('gemini:')) {
        const model = trimmed.slice(7);
        return new GeminiProvider(model);
    }
    if (trimmed.startsWith('openrouter:')) {
        const model = trimmed.slice(11);
        return new OpenRouterProvider(model);
    }
    if (trimmed === 'g4f') {
        return new G4FProvider();
    }
    // Default: treat as gemini model name
    logger.warn(`Unknown pool provider token: "${trimmed}", treating as Gemini model name.`);
    return new GeminiProvider(trimmed);
}

export function getAIProvider(): AIProvider {
    if (instance) return instance;

    const priorityModel = process.env.AI_PRIORITY_MODEL;
    const poolEnv = process.env.AI_MODEL_POOL;
    const maxRetriesStr = process.env.AI_MAX_RETRIES;
    const maxRetries = maxRetriesStr ? parseInt(maxRetriesStr, 10) : 2;

    // Build the priority provider
    const primaryProvider: AIProvider = priorityModel
        ? parseProviderFromString(priorityModel)
        : new GeminiProvider();

    logger.info(`AI Priority Provider initialized: ${priorityModel || 'gemini (default)'}`);

    // Build the pool
    const pool: AIProvider[] = [];

    if (poolEnv) {
        const entries = poolEnv.split(',').map(s => s.trim()).filter(Boolean);
        for (const entry of entries) {
            try {
                pool.push(parseProviderFromString(entry));
                logger.info(`  Added to pool: ${entry}`);
            } catch (e: any) {
                logger.warn(`  Failed to add pool entry "${entry}": ${e.message}`);
            }
        }
    } else {
        // Default pool: flash lite then G4F
        pool.push(new GeminiProvider('gemini-2.5-flash-lite'));
        pool.push(new G4FProvider());
        logger.info('  Using default pool: [gemini:gemini-2.5-flash-lite, g4f]');
    }

    instance = new ManagedPoolProvider(primaryProvider, pool, maxRetries);
    logger.info(`AI Manager: maxRetries=${maxRetries}, pool size=${pool.length}`);
    return instance;
}

export function resetAIProvider() {
    instance = null;
}

export function getBrain(userId: string, contextId: string): Brain {
    const provider = getAIProvider();
    return new Brain(provider, userId, contextId);
}
