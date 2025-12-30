export interface AIProvider {
    getChatResponse(userId: string, userInput: string): Promise<string>;
    getDirectCorrection(text: string): Promise<string>;
}
