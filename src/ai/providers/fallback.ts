import { AIProvider } from '../types';
import { logger } from '../../utils/logger';

export class FallbackProvider implements AIProvider {
    private primary: AIProvider;
    private secondary: AIProvider;

    constructor(primary: AIProvider, secondary: AIProvider) {
        this.primary = primary;
        this.secondary = secondary;
    }

    async getChatResponse(userId: string, userInput: string): Promise<string> {
        try {
            return await this.primary.getChatResponse(userId, userInput);
        } catch (error) {
            logger.warn(`Primary provider failed, switching to fallback. Error: ${error}`);
            try {
                return await this.secondary.getChatResponse(userId, userInput);
            } catch (fallbackError) {
                logger.error(`Fallback provider also failed. Error: ${fallbackError}`);
                throw fallbackError; // Or return a safe error message
            }
        }
    }

    async getDirectCorrection(text: string): Promise<string> {
        try {
            return await this.primary.getDirectCorrection(text);
        } catch (error) {
            logger.warn(`Primary provider failed for correction, switching to fallback. Error: ${error}`);
            try {
                return await this.secondary.getDirectCorrection(text);
            } catch (fallbackError) {
                logger.error(`Fallback provider also failed for correction. Error: ${fallbackError}`);
                throw fallbackError;
            }
        }
    }
}
