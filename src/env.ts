import dotenv from 'dotenv';
import path from 'path';

// Load secrets from secrets.env file (local dev only; Vercel injects env vars directly)
dotenv.config({ path: path.resolve(process.cwd(), 'secrets.env') });
dotenv.config(); // Also load from .env if present

export interface EnvConfig {
  /** First Groq key (primary). Kept for backward compatibility. */
  GROQ_API_KEY: string | null;
  /**
   * All configured Groq keys in failover order. Sourced from GROQ_API_KEY,
   * GROQ_API_KEY_2, GROQ_API_KEY_3, ... Each key ideally belongs to a separate
   * Groq account so they have independent rate-limit quotas.
   */
  GROQ_API_KEYS: string[];
  GEMINI_API_KEY: string | null;
  /** Which provider should be used for text generation */
  primaryTextProvider: 'groq' | 'gemini';
  /** Which providers are available */
  availableProviders: ('groq' | 'gemini')[];
}

/**
 * Collects all Groq keys from the environment in failover order.
 * Reads GROQ_API_KEY, then GROQ_API_KEY_2, GROQ_API_KEY_3, ... until a gap.
 * Duplicate and empty values are ignored.
 */
function collectGroqKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | undefined | null) => {
    const trimmed = value?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      keys.push(trimmed);
    }
  };

  // Primary key.
  push(process.env.GROQ_API_KEY);

  // Numbered fallback keys: GROQ_API_KEY_2, GROQ_API_KEY_3, ...
  // Scan a small fixed range so a missing GROQ_API_KEY_2 doesn't hide a _3.
  for (let i = 2; i <= 10; i++) {
    push(process.env[`GROQ_API_KEY_${i}`]);
  }

  return keys;
}

/**
 * Loads environment configuration.
 * At least one API key (GROQ or GEMINI) must be present.
 * If only one is available, it becomes the primary provider.
 * If both are available, Groq is primary with Gemini as fallback.
 * Multiple Groq keys (GROQ_API_KEY, GROQ_API_KEY_2, ...) are tried in order
 * before falling back to Gemini.
 */
export function loadEnvConfig(): EnvConfig {
  const groqApiKeys = collectGroqKeys();
  const groqApiKey = groqApiKeys[0] ?? null;
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || null;

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
    GROQ_API_KEYS: groqApiKeys,
    GEMINI_API_KEY: geminiApiKey,
    primaryTextProvider,
    availableProviders,
  };
}
