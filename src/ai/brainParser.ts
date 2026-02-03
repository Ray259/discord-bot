import { BrainResponse } from './types';
import { logger } from '../utils/logger';

/**
 * Parses a raw JSON string into a BrainResponse.
 * Handles two cases:
 *   1. Correct format: { "thought": "...", "actions": [...] }
 *   2. Model wraps in array: [{ "thought": "...", "actions": [...] }]
 */
export function parseBrainResponse(raw: string, source: string): BrainResponse {
    let parsed: any;

    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        logger.error(`[${source}] Failed to parse JSON: ${raw.substring(0, 200)}`);
        return { thought: 'Parse error', actions: [] };
    }

    // Case 2: model returned an array — unwrap first element
    if (Array.isArray(parsed)) {
        logger.warn(`[${source}] Response was an array, unwrapping first element.`);
        parsed = parsed[0];
    }

    // Defensive guard: ensure actions is always an array
    if (!Array.isArray(parsed?.actions)) {
        logger.warn(`[${source}] 'actions' missing or not an array. Raw: ${raw.substring(0, 200)}`);
        parsed.actions = [];
    }

    return parsed as BrainResponse;
}
