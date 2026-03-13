import { Client, Events, Interaction, Message, ChannelType } from 'discord.js';
import { getAIProvider, getBrain } from '../ai/factory';
import { PostgresProvider } from '../memory/providers/postgres';
import { logger } from '../utils/logger';
import { config } from '../config';

export function registerEvents(client: Client) {
  
  // Ready Event
  client.once(Events.ClientReady, c => {
    logger.info(`Ready! Logged in as ${c.user.tag}`);
  });

  // Interaction Create (Slash Commands)
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const ai = getAIProvider();

    try {
        if (commandName === 'help') {
            await interaction.reply({ 
                content: config.bot.commands.help,
                ephemeral: true 
            });
        }
        else if (commandName === 'resetmemory') {
            const contextId = interaction.guildId || interaction.user.id;
            await PostgresProvider.clearMemory(contextId);
            await interaction.reply({ content: config.bot.commands.resetStub, ephemeral: true });
        }
        else if (commandName === 'french') {
            const text = interaction.options.getString('text');
            if (text) {
                await interaction.deferReply();
                const response = await ai.getDirectCorrection(text);
                await interaction.editReply(response);
            }
        }
        else if (commandName === 'translate') {
            await interaction.deferReply();
            const lang = interaction.options.getString('language');
            const text = interaction.options.getString('text');
            // Re-use core chat for translation requests to keep personality
            const prompt = config.prompts.translation
                .replace('{targetLang}', lang === 'fr' ? 'French' : 'English')
                .replace('{text}', text || '');
            
            const contextId = interaction.guildId || interaction.user.id;
            const response = await ai.getChatResponse(interaction.user.id, contextId, prompt);
            await interaction.editReply(response);
        }
        else if (commandName === 'practice') {
             await interaction.reply(config.bot.commands.practice);
        }
    } catch (error) {
        logger.error(`Error handling command ${commandName}`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: config.bot.errors.brainDead, ephemeral: true });
        } else {
            await interaction.reply({ content: config.bot.errors.commandError, ephemeral: true });
        }
    }
  });

  // Map to track last interaction time per channel
  // Key: Channel ID, Value: Timestamp
  const recentInteractions = new Map<string, number>();
  const LISTENING_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

  // Message Create (Chat)
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bots
    if (message.author.bot) return;

    const channelId = message.channel.id;
    const now = Date.now();

    // Trigger conditions:
    // 1. Direct Message
    // 2. Mentioned in a server
    // 3. Within listening window of recent interaction in this channel
    const isDM = message.channel.type === ChannelType.DM;
    const isMentioned = client.user && message.mentions.has(client.user);
    
    const lastInteraction = recentInteractions.get(channelId) || 0;
    const isWithinListeningWindow = (now - lastInteraction) < LISTENING_WINDOW_MS;

    if (isDM || isMentioned || isWithinListeningWindow) {
        // Show typing indicator
        if ('sendTyping' in message.channel) await message.channel.sendTyping();

        // Clean content: Remove mention from text if mentioned
        let cleanText = message.content;
        if (isMentioned && client.user) {
            cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
        }

        // 1. Context ID: Guild ID for servers, User ID for DMs
        const contextId = message.guildId || message.author.id;
        const userId = message.author.id;
        const channelType = message.channel.type === ChannelType.DM ? 'DM' : 'Guild';
        const triggerReason = isMentioned ? 'MENTION' : (isDM ? 'DM' : 'WINDOW');

        logger.info(`[EVENT] Message received | User: ${userId} | Context: ${contextId} | Type: ${channelType} | Trigger: ${triggerReason}`);

        // Update listening window
        recentInteractions.set(channelId, now);

        // 2. Save USER message to history
        await PostgresProvider.addMessage(userId, contextId, { role: 'user', parts: cleanText });

        const brain = getBrain(userId, contextId);

        try {
            await brain.handleMessage(message, cleanText, contextId);
            // Re-update window after bot speaks to extend it
            recentInteractions.set(channelId, Date.now());
        } catch (error) {
            logger.error("Error executing brain logic", error);
            await message.reply(config.bot.errors.connection);
        }
    }
  });
}
