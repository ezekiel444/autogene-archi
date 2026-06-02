import dotenv from 'dotenv';
import path from 'path';

// Load secrets from secrets.env file
dotenv.config({ path: path.resolve(process.cwd(), 'secrets.env') });

export interface EnvConfig {
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
}

export function loadEnvConfig(): EnvConfig {
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!groqApiKey) {
    throw new Error(
      'GROQ_API_KEY is not set. Please add it to your secrets.env file.'
    );
  }

  if (!geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please add it to your secrets.env file.'
    );
  }

  return {
    GROQ_API_KEY: groqApiKey,
    GEMINI_API_KEY: geminiApiKey,
  };
}
