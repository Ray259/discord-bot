import { Message } from 'discord.js';
import { AIProvider, BrainAction, ActionType } from './types';
import { PostgresProvider } from '../memory/providers/postgres';
import { saveContext } from '../memory/vectorStore';
import { logger } from '../utils/logger';

export class Brain {
    private provider: AIProvider;
    private userId: string;
    private contextId: string;
    private history: any[] = [];
    private memoryContext: string = "";

    constructor(provider: AIProvider, userId: string, contextId: string) {
        this.provider = provider;
        this.userId = userId;
        this.contextId = contextId;
    }

    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async handleMessage(message: Message, userInput: string, contextId: string) {
        let hasSentReply = false;

        try {
            this.history = await PostgresProvider.getHistory(contextId);
            
            const docs = await PostgresProvider.getContext(this.userId, contextId, userInput);
            this.memoryContext = docs.map((d: any) => d.pageContent).join("\n---\n");

            let finished = false;
            let loopCount = 0;
            const MAX_LOOPS = 5;

            while (!finished && loopCount < MAX_LOOPS) {
                loopCount++;
                
                if ('sendTyping' in message.channel) await message.channel.sendTyping();

                const response = await this.provider.getBrainResponse(
                    this.userId, 
                    userInput, 
                    this.history, 
                    this.memoryContext
                );

                const thought = response.thought || "Processing input...";
                logger.info(`Brain Thought (Loop ${loopCount}): ${thought}`);
                logger.info(`Brain Actions (Loop ${loopCount}): ${JSON.stringify(response.actions)}`);

                if (!response.actions || response.actions.length === 0) {
                    logger.warn(`Brain returned no actions on loop ${loopCount}. Terminating.`);
                    finished = true;
                    break;
                }

                for (const action of response.actions) {
                    const spoke = await this.executeAction(action, message, userInput);
                    if (spoke) hasSentReply = true;
                    if (action.type === 'FINISH') {
                        finished = true;
                    }
                }
            }

        } catch (error) {
            logger.error("Error in Brain handleMessage:", error);
            // Only send an error reply if the user hasn't received anything yet
            if (!hasSentReply) {
                await message.reply("Internal cognition error.");
            }
        }
    }

    private async executeAction(action: BrainAction, message: Message, userInput: string): Promise<boolean> {
        switch (action.type) {
            case 'SEARCH_MEMORY':
                if (action.content) {
                    logger.info(`Brain Action: Searching memory for "${action.content}"`);
                    const docs = await PostgresProvider.getContext(this.userId, this.contextId, action.content);
                    const newContext = docs.map((d: any) => d.pageContent).join("\n---\n");
                    this.memoryContext = `${this.memoryContext}\n\nSearch Result for "${action.content}":\n${newContext}`;
                }
                return false;

            case 'MEMORIZE':
                if (action.content) {
                    const isPublic = action.isPublic || false;
                    logger.info(`Brain Action: Memorizing (Public: ${isPublic}): "${action.content.substring(0, 30)}..."`);
                    await saveContext(action.content, this.userId, this.contextId, isPublic);
                }
                return false;

            case 'SPEAK':
                if (action.content) {
                    logger.info(`Brain Action: Speaking "${action.content.substring(0, 30)}..."`);
                    await message.reply(action.content);
                    
                    await PostgresProvider.addMessage(this.userId, this.contextId, { role: 'model', parts: action.content });
                    this.history.push({ role: 'model', parts: action.content });
                    return true; // User received a message
                }
                return false;

            case 'WAIT':
                if (action.ms) {
                    logger.info(`Brain Action: Waiting ${action.ms}ms`);
                    await this.delay(action.ms);
                }
                return false;

            case 'FINISH':
                logger.info("Brain Action: Finished coordination.");
                return false;

            default:
                return false;
        }
    }
}
