import { Client, Events, Interaction, Message, ChannelType } from 'discord.js';
import { getAIProvider } from '../ai/factory';
import { userMemory } from '../memory/userMemory';
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
            userMemory.clearMemory(interaction.user.id);
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
            
            const response = await ai.getChatResponse(interaction.user.id, prompt);
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

  // Message Create (Chat)
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bots
    if (message.author.bot) return;

    // Trigger conditions:
    // 1. Direct Message
    // 2. Mentioned in a server
    const isDM = message.channel.type === ChannelType.DM;
    const isMentioned = client.user && message.mentions.has(client.user);
    


    if (isDM || isMentioned) {
        // Show typing indicator
        if ('sendTyping' in message.channel) await message.channel.sendTyping();

        // Clean content: Remove mention from text if mentioned
        let cleanText = message.content;
        if (isMentioned && client.user) {
            cleanText = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
        }

        if (!cleanText) return; // Ignore empty mentions

        const ai = getAIProvider();

        try {
            const response = await ai.getChatResponse(message.author.id, cleanText);
            
            // In servers, maybe thread or reply? Let's reply.
            await message.reply(response);
        } catch (error) {
            logger.error("Error responding to message", error);
            await message.reply(config.bot.errors.connection);
        }
    }
  });
}
