import { AIProvider, BrainResponse } from '../types';
import { logger } from '../../utils/logger';

export class ManagedPoolProvider implements AIProvider {
    private priorityProvider: AIProvider;
    private pool: AIProvider[];
    private maxRetries: number;
    private pinnedProvider: AIProvider | null = null;

    constructor(priority: AIProvider, pool: AIProvider[], maxRetries: number = 2) {
        this.priorityProvider = priority;
        this.pool = pool;
        this.maxRetries = maxRetries;
    }

    /**
     * Executes the operation against providers using the following priority:
     *
     * 1. If a provider was pinned from the last successful response, use it directly.
     *    - If it fails, clear the pin and fall through to the normal cascade.
     * 2. Try the priority provider.
     * 3. Try pool providers up to maxRetries.
     *
     * On any success, the successful provider becomes pinned for subsequent calls.
     */
    private async executeWithPool<T>(
        operation: (provider: AIProvider) => Promise<T>,
        operationName: string,
        skipFallback: boolean = false
    ): Promise<T> {
        const errors: Error[] = [];

        // 1. Try pinned provider first (last known working)
        if (this.pinnedProvider) {
            try {
                const result = await operation(this.pinnedProvider);
                logger.info(`[Pool] Pinned provider succeeded for ${operationName}.`);
                return result;
            } catch (error: any) {
                logger.warn(`[Pool] Pinned provider failed: ${error.message}. Clearing pin.`);
                this.pinnedProvider = null;
                errors.push(error);
                // If within follow-up loop, do not try fallback — fail immediately
                if (skipFallback) {
                    throw new Error(`Pinned provider failed and fallback is disabled for this loop. Primary error: ${error.message}`);
                }
            }
        }

        // 2. Try priority provider
        if (!this.pinnedProvider) {
            try {
                const result = await operation(this.priorityProvider);
                this.pinnedProvider = this.priorityProvider;
                logger.info(`[Pool] Priority provider succeeded. Pinned.`);
                return result;
            } catch (error: any) {
                errors.push(error);
                logger.warn(`[Pool] Priority provider failed for ${operationName}: ${error.message}. Entering pool...`);
            }
        }

        // 3. Try pool providers
        const tried = new Set<AIProvider>();
        tried.add(this.priorityProvider);
        const shuffledPool = [...this.pool].sort(() => Math.random() - 0.5);
        let retryCount = 0;

        for (const provider of shuffledPool) {
            if (retryCount >= this.maxRetries || tried.has(provider)) continue;
            tried.add(provider);
            retryCount++;

            try {
                logger.info(`[Pool] Fallback attempt ${retryCount}/${this.maxRetries}...`);
                const result = await operation(provider);
                this.pinnedProvider = provider;
                logger.info(`[Pool] Pool provider succeeded. Pinned.`);
                return result;
            } catch (error: any) {
                errors.push(error);
                logger.warn(`[Pool] Pool provider failed: ${error.message}`);
            }
        }

        const combinedError = new Error(`All providers exhausted for ${operationName}. Primary error: ${errors[0]?.message}`);
        logger.error(combinedError.message);
        throw combinedError;
    }

    async getChatResponse(userId: string, contextId: string, userInput: string): Promise<string> {
        return this.executeWithPool(p => p.getChatResponse(userId, contextId, userInput), 'getChatResponse');
    }

    async getDirectCorrection(text: string): Promise<string> {
        return this.executeWithPool(p => p.getDirectCorrection(text), 'getDirectCorrection');
    }

    async getBrainResponse(userId: string, userInput: string, history: any[], memoryContext: string, isFollowUp: boolean = false): Promise<BrainResponse> {
        return this.executeWithPool(p => p.getBrainResponse(userId, userInput, history, memoryContext, isFollowUp), 'getBrainResponse');
    }

    /**
     * Returns a version of getBrainResponse that skips pool fallback if the pinned provider fails.
     * Used by the Brain loop for follow-up iterations.
     */
    async getBrainResponseFollowUp(userId: string, userInput: string, history: any[], memoryContext: string, isFollowUp: boolean = false): Promise<BrainResponse> {
        return this.executeWithPool(
            p => p.getBrainResponse(userId, userInput, history, memoryContext, isFollowUp),
            'getBrainResponseFollowUp',
            true // skipFallback
        );
    }
}
