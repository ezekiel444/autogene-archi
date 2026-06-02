/**
 * AI client providing purpose-specific functions:
 * - `generateText` — Groq-only text completion (no Gemini fallback)
 * - `analyzeImage` — Gemini-only vision analysis (no Groq at all)
 *
 * The legacy `generateCompletion` is kept as a deprecated alias for `generateText`.
 */
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { loadEnvConfig } from '../env.js';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TextCompletionOptions {
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

/** @deprecated Use `TextCompletionOptions` instead. */
export type CompletionOptions = TextCompletionOptions;

export interface ImageInput {
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface VisionAnalysisOptions {
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determines if an error is transient and worth retrying.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network-related errors
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('socket')
    ) {
      return true;
    }
  }

  // HTTP 5xx errors
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status >= 500 && status < 600) {
      return true;
    }
  }

  // Rate limit (429) is also transient
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429) {
      return true;
    }
  }

  return false;
}

/**
 * Creates an AbortController that auto-aborts after the given timeout.
 * Returns both the controller and a cleanup function.
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cleanup = () => clearTimeout(timer);
  return { controller, cleanup };
}

// ─── Provider Implementations ────────────────────────────────────────────────

/**
 * Calls Groq API for chat completion.
 */
async function callGroq(
  messages: ChatMessage[],
  options: Required<TextCompletionOptions>,
  apiKey: string,
): Promise<string> {
  const client = new Groq({ apiKey });

  const { controller, cleanup } = createTimeoutController(options.timeoutMs);

  try {
    const response = await client.chat.completions.create(
      {
        model: GROQ_MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      },
      { signal: controller.signal },
    );

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned an empty response');
    }
    return content;
  } finally {
    cleanup();
  }
}

/**
 * Calls Google Gemini API for vision analysis with an image.
 */
async function callGeminiVision(
  prompt: string,
  image: ImageInput,
  options: Required<VisionAnalysisOptions>,
  apiKey: string,
): Promise<string> {
  const client = new GoogleGenAI({ apiKey });

  const { controller, cleanup } = createTimeoutController(options.timeoutMs);

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.data.toString('base64'),
              },
            },
          ],
        },
      ],
      config: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        abortSignal: controller.signal,
      },
    });

    const content = response.text;
    if (!content) {
      throw new Error('Gemini returned an empty response');
    }
    return content;
  } finally {
    cleanup();
  }
}

// ─── Main Exports ────────────────────────────────────────────────────────────

/**
 * Generates text completion using Groq (text-only provider).
 * Retries once on transient error, then fails with provider-specific error.
 * Never falls back to Gemini.
 */
export async function generateText(
  messages: ChatMessage[],
  options?: TextCompletionOptions,
): Promise<string> {
  const config = loadEnvConfig();

  const resolvedOptions: Required<TextCompletionOptions> = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  // Attempt 1: Groq
  try {
    return await callGroq(messages, resolvedOptions, config.GROQ_API_KEY);
  } catch (error) {
    // Only retry on transient errors
    if (!isTransientError(error)) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Groq text generation failed: ${reason}`);
    }

    // Attempt 2: Retry Groq once on transient failure
    try {
      return await callGroq(messages, resolvedOptions, config.GROQ_API_KEY);
    } catch (retryError) {
      const reason = retryError instanceof Error ? retryError.message : String(retryError);
      throw new Error(`Groq text generation failed: ${reason}`);
    }
  }
}

/**
 * Analyzes an image using Gemini (vision provider).
 * Retries once on transient error, then fails with provider-specific error.
 * Never falls back to Groq.
 */
export async function analyzeImage(
  prompt: string,
  image: ImageInput,
  options?: VisionAnalysisOptions,
): Promise<string> {
  const config = loadEnvConfig();

  const resolvedOptions: Required<VisionAnalysisOptions> = {
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  // Attempt 1: Gemini
  try {
    return await callGeminiVision(prompt, image, resolvedOptions, config.GEMINI_API_KEY);
  } catch (error) {
    // Only retry on transient errors
    if (!isTransientError(error)) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini vision analysis failed: ${reason}`);
    }

    // Attempt 2: Retry Gemini once on transient failure
    try {
      return await callGeminiVision(prompt, image, resolvedOptions, config.GEMINI_API_KEY);
    } catch (retryError) {
      const reason = retryError instanceof Error ? retryError.message : String(retryError);
      throw new Error(`Gemini vision analysis failed: ${reason}`);
    }
  }
}

/**
 * @deprecated Use `generateText` instead. This alias is kept for backward compatibility.
 * Generates a chat completion using Groq only. No Gemini fallback.
 */
export async function generateCompletion(
  messages: ChatMessage[],
  options?: CompletionOptions,
): Promise<string> {
  return generateText(messages, options);
}
