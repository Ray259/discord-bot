// src/memory/userMemory.ts

// Since we need to maintain "short conversational memory per user (last N messages)",
// we will use a simple in-memory Map.
// NOTE: This will reset on restart. For persistence, we'd need a database (SQLite/Redis),
// but requirements say "Simple".

export interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

const MAX_HISTORY = 10;
const memory = new Map<string, ChatMessage[]>();

export const userMemory = {
  addMessage: (userId: string, message: ChatMessage) => {
    const history = memory.get(userId) || [];
    history.push(message);
    if (history.length > MAX_HISTORY) {
      history.shift(); // Remove oldest
    }
    memory.set(userId, history);
  },

  getHistory: (userId: string): ChatMessage[] => {
    return memory.get(userId) || [];
  },

  clearMemory: (userId: string) => {
    memory.delete(userId);
  }
};
