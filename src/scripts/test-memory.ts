import { PostgresProvider } from '../memory/providers/postgres';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function testMemory() {
    const userId = 'test-user-' + Date.now();
    logger.info(`Starting memory test for user: ${userId}`);

    try {
        logger.info('1. Adding user message...');
        await PostgresProvider.addMessage(userId, { role: 'user', parts: 'Hello, this is a test message.' });
        
        logger.info('2. Adding model response...');
        await PostgresProvider.addMessage(userId, { role: 'model', parts: 'Hello! This is a test response.' });

        logger.info('3. Fetching history...');
        const history = await PostgresProvider.getHistory(userId);
        logger.info(`History length: ${history.length}`);
        
        if (history.length !== 2) {
            logger.error('FAILED: Expected 2 messages in history.');
        } else {
             logger.info('PASSED: History count matches.');
             console.log('History:', JSON.stringify(history, null, 2));
        }

        logger.info('4. Testing RAG context...');
        const context = await PostgresProvider.getContext(userId, 'test message');
        logger.info(`Context docs found: ${context.length}`);
        if (context.length > 0) {
             logger.info('PASSED: Context retrieved.');
             console.log('Context:', context[0].pageContent);
        } else {
             logger.warn('WARNING: No context found (might take time to index or embedding failed).');
        }

    } catch (error) {
        logger.error('Test FAILED with error:', error);
    }
}

testMemory();
