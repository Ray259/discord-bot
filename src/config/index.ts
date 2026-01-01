
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Default config type inference from structure would be ideal, 
// but for now let's define a basic shape or just load it as any.
// To be safe, we can use the structure from the example file.

const configPath = path.join(process.cwd(), 'src', 'config', 'messages.json');
const exampleConfigPath = path.join(process.cwd(), 'src', 'config', 'messages.example.json');

let configData: any;

try {
    if (process.env.MESSAGES_JSON) {
        // Option 2: Load from Environment Variable
        logger.info("Loading configuration from MESSAGES_JSON environment variable");
        configData = JSON.parse(process.env.MESSAGES_JSON);
    } else if (fs.existsSync(configPath)) {
        // Standard: Load from local file (ignored in git)
        const raw = fs.readFileSync(configPath, 'utf8');
        configData = JSON.parse(raw);
    } else {
        // Fallback: Load example file (committed in git)
        logger.warn("messages.json not found, falling back to messages.example.json");
        const raw = fs.readFileSync(exampleConfigPath, 'utf8');
        configData = JSON.parse(raw);
    }
} catch (error) {
    logger.error("Failed to load configuration:", error);
    process.exit(1);
}

export const config = configData;
