// src/bot/client.ts
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { registerEvents } from './events';
import { commandData } from './commands';
import { logger } from '../utils/logger';

export async function startBot() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    logger.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables.');
    process.exit(1);
  }

  const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent 
    ],
  });

  // register event handlers
  registerEvents(client);

  // Deploy commands
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData },
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }

  // Login
  await client.login(token);
}
