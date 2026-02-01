import { AIProvider, BrainResponse } from '../types';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export class G4FProvider implements AIProvider {

    constructor() {
        logger.info("Initializing G4FProvider (Python Adapter Mode)");
    }

    private async callPythonAdapter(prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const path = require('path');

            // Adjust path to adapter if necessary based on where the bot is run
            const scriptPath = path.join(process.cwd(), 'g4f_adapter', 'adapter.py');

            const pythonProcess = spawn('python3', [scriptPath, prompt]);

            let dataString = '';
            let errorString = '';

            pythonProcess.stdout.on('data', (data: any) => {
                dataString += data.toString();
            });

            pythonProcess.stderr.on('data', (data: any) => {
                errorString += data.toString();
            });

            pythonProcess.on('close', (code: number) => {
                if (code !== 0) {
                    logger.error(`Python adapter exited with code ${code}: ${errorString}`);
                    reject(new Error(`Python adapter failed: ${errorString}`));
                } else {
                    // Filter out noise. We expect the adapter to print the response.
                    // If we added a delimiter in adapter.py, we would split on it.
                    // For now, let's try to identify if the output contains the version check.
                    let cleanOutput = dataString;
                    if (cleanOutput.includes('---G4F_RESPONSE---')) {
                        const parts = cleanOutput.split('---G4F_RESPONSE---');
                        cleanOutput = parts[1];
                    }
                    resolve(cleanOutput.trim());
                }
            });

            pythonProcess.on('error', (err: any) => {
                reject(err);
            });
        });
    }

    async getChatResponse(userId: string, contextId: string, userInput: string): Promise<string> {
        try {
            logger.info(`Using provider: G4F for context ${contextId}`);
            return await this.callPythonAdapter(userInput);
        } catch (error) {
            logger.error("Error in getChatResponse G4F:", error);
            throw error; // Propagate to FallbackProvider
        }
    }

    async getDirectCorrection(text: string): Promise<string> {
        try {
            const prompt = config.prompts.correction.replace('{text}', text);
            return await this.callPythonAdapter(prompt);
        } catch (e) {
            logger.error("Error in getDirectCorrection G4F", e);
            throw e;
        }
    }

    async getBrainResponse(userId: string, userInput: string, history: any[], memoryContext: string): Promise<BrainResponse> {
        try {
            const prompt = `
System: ${config.coordinatorInstruction}

Context:
${memoryContext}

User Message: ${userInput}
History: ${JSON.stringify(history)}

Respond ONLY with a JSON object following the BrainResponse schema.
`;
            const responseText = await this.callPythonAdapter(prompt);
            // Try to extract JSON if there's noise
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as BrainResponse;
            }
            return JSON.parse(responseText) as BrainResponse;
        } catch (error) {
            logger.error("Error in getBrainResponse G4F:", error);
            return {
                thought: "Failover in G4F brain.",
                actions: [{ type: 'SPEAK', content: "Mmm, I'm thinking... give me a moment.", thought: "Fallback speak" }, { type: 'FINISH', thought: "Done" }]
            };
        }
    }
}
