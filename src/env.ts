import dotenv from 'dotenv';
import path from 'path';

// Load secrets from secrets.env file
dotenv.config({ path: path.resolve(process.cwd(), 'secrets.env') });

export interface EnvConfig {
  GROQ_API_KEY: string | null;
  GEMINI_API_KEY: string | null;
  /** Which provider should be used for text generation */
  primaryTextProvider: 'groq' | 'gemini';
  /** Which providers are available */
  availableProviders: ('groq' | 'gemini')[];
}

/**
 * Loads environment configuration.
 * At least one API key (GROQ or GEMINI) must be present.
 * If only one is available, it becomes the primary provider.
 * If both are available, Groq is primary with Gemini as fallback.
 */
export function loadEnvConfig(): EnvConfig {
  const groqApiKey = process.env.GROQ_API_KEY || null;
  const geminiApiKey = process.env.GEMINI_API_KEY || null;

  if (!groqApiKey && !geminiApiKey) {
    throw new Error(
      'No API keys configured. Please add at least GROQ_API_KEY or GEMINI_API_KEY to your secrets.env file.'
    );
  }

  const availableProviders: ('groq' | 'gemini')[] = [];
  if (groqApiKey) availableProviders.push('groq');
  if (geminiApiKey) availableProviders.push('gemini');

  // Groq is primary when available; otherwise Gemini takes over
  const primaryTextProvider: 'groq' | 'gemini' = groqApiKey ? 'groq' : 'gemini';

  return {
    GROQ_API_KEY: groqApiKey,
    GEMINI_API_KEY: geminiApiKey,
    primaryTextProvider,
    availableProviders,
  };
}
