
import { config } from './src/config';
import { getAIProvider } from './src/ai/factory';

console.log("System Instruction loaded:", config.systemInstruction.slice(0, 50) + "...");
console.log("Help command loaded:", config.bot.commands.help.slice(0, 50) + "...");

async function testConfig() {
    try {
        const provider = getAIProvider();
        console.log("Provider initialized:", provider.constructor.name);
        
        // Just checking if it runs without crashing due to missing config
        console.log("Config verification passed.");
    } catch (e) {
        console.error("Config verification failed:", e);
    }
}

testConfig();
