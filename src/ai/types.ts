export type ActionType = 'SEARCH_MEMORY' | 'SPEAK' | 'WAIT' | 'FINISH' | 'MEMORIZE';

export interface BrainAction {
    type: ActionType;
    content?: string; // Text to speak or query to search
    ms?: number;      // Wait time in milliseconds
    isPublic?: boolean;
    thought?: string; // Internal reasoning
}

export interface BrainResponse {
    thought: string;
    actions: BrainAction[];
}

export interface AIProvider {
    getChatResponse(userId: string, contextId: string, userInput: string): Promise<string>;
    getDirectCorrection(text: string): Promise<string>;
    getBrainResponse(userId: string, userInput: string, history: any[], memoryContext: string, isFollowUp?: boolean): Promise<BrainResponse>;
}
