import { AIProvider, BrainResponse } from '../types';
import { logger } from '../../utils/logger';

export class ManagedPoolProvider implements AIProvider {
    private priorityProvider: AIProvider;
    private pool: AIProvider[];
    private maxRetries: number;

    constructor(priority: AIProvider, pool: AIProvider[], maxRetries: number = 2) {
        this.priorityProvider = priority;
        this.pool = pool;
        this.maxRetries = maxRetries;
    }

    private async executeWithPool<T>(
        operation: (provider: AIProvider) => Promise<T>,
        operationName: string
    ): Promise<T> {
        let triedProviders = new Set<AIProvider>();
        let errors: Error[] = [];

        // 1. Try Priority
        try {
            return await operation(this.priorityProvider);
        } catch (error: any) {
            triedProviders.add(this.priorityProvider);
            errors.push(error);
            logger.warn(`Priority provider failed for ${operationName}: ${error.message}. Entering pool fallback...`);
        }

        // 2. Try Pool until success or limit reached
        let retryCount = 0;
        const availablePool = this.pool.filter(p => !triedProviders.has(p));
        
        // Shuffle pool for better load distribution if multiple models available
        const shuffledPool = [...availablePool].sort(() => Math.random() - 0.5);

        for (const provider of shuffledPool) {
            if (retryCount >= this.maxRetries) break;
            
            try {
                logger.info(`Fallback attempt ${retryCount + 1}/${this.maxRetries} using pool provider...`);
                return await operation(provider);
            } catch (error: any) {
                triedProviders.add(provider);
                errors.push(error);
                retryCount++;
                logger.warn(`Pool provider failed: ${error.message}`);
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

    async getBrainResponse(userId: string, userInput: string, history: any[], memoryContext: string): Promise<BrainResponse> {
        return this.executeWithPool(p => p.getBrainResponse(userId, userInput, history, memoryContext), 'getBrainResponse');
    }
}
