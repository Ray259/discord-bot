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

import http from 'http';
// Keep-alive server for PaaS (Render, etc.)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is alive');
}).listen(port, () => {
    logger.info(`Keep-alive server listening on port ${port}`);
});
