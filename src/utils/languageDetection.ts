// src/utils/languageDetection.ts

// Simple heuristic: if > 30% of words are common French words, or specific patterns.
// For a robust solution, we'd use a library or let Gemini decide, but this is a quick pre-check if needed.
// Actually, relying on Gemini is better for "soft corrections", but we might want a quick check for something.
// The requirements say "Detect if a message contains French or English".

const commonFrenchWords = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'sont', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'mon', 'ton', 'son', 'ce', 'cette', 'que', 'qui', 'quoi', 'oui', 'non', 'bonjour', 'salut', 'merci'
]);

export function detectLanguage(text: string): 'fr' | 'en' | 'unknown' {
  const words = text.toLowerCase().split(/\s+/).filter(w => /^[a-zà-ÿ]+$/.test(w));
  if (words.length === 0) return 'unknown';

  let frenchCount = 0;
  for (const word of words) {
    if (commonFrenchWords.has(word)) frenchCount++;
  }

  const ratio = frenchCount / words.length;
  // If more than 20% are very common French words, it's likely French.
  if (ratio > 0.2) return 'fr';
  
  return 'en'; // Default to English for now, or 'unknown'.
}
