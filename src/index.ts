// src/index.ts
import dotenv from 'dotenv';
import { startBot } from './bot/client';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise); 
  console.error(reason); 
});

logger.info('Starting Bot...');
startBot();
