// src/bot/commands.ts
import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('See what I can do! ✨'),

  new SlashCommandBuilder()
    .setName('french')
    .setDescription('Ask about a French phrase or get a correction 🇫🇷')
    .addStringOption(option => 
      option.setName('text')
        .setDescription('The text you want checked/explained')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate something')
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Target language (en/fr)')
        .setRequired(true)
        .addChoices({ name: 'English', value: 'en' }, { name: 'French', value: 'fr' }))
    .addStringOption(option =>
      option.setName('text')
        .setDescription('The text to translate')
        .setRequired(true)),
    
  new SlashCommandBuilder()
    .setName('practice')
    .setDescription('Start a casual practice sesh? (Not implemented fully yet, just chats normally)'),

  new SlashCommandBuilder()
    .setName('resetmemory')
    .setDescription('Clear our chat history 🧹'),
];

export const commandData = commands.map(c => c.toJSON());
