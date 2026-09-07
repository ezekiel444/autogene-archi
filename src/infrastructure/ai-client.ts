/**
 * AI client with automatic provider fallback:
 * - `generateText` — Groq primary → Gemini fallback on rate limit/exhaustion.
 *                     If Groq key is missing, Gemini is used as the sole provider.
 * - `analyzeImage` — Gemini-only vision analysis (Groq doesn't support vision).
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
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
// Overridable via env so the model can be bumped without a code change.
// `gemini-2.0-flash` (and `gemini-2.5-flash`) were retired and now return HTTP
// 404. We default to `gemini-flash-lite-latest`: a stable alias that auto-tracks
// the current lite Flash model. The lite model is fast and, unlike the thinking
// "flash" models, reliably returns visible text (the thinking models can spend
// their whole token budget reasoning and return an empty response). Gemini is
// only the last-resort fallback here, so a fast, predictable model fits best.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determines if an error is transient and worth retrying.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network-related errors, timeouts/aborts, and empty/partial responses are
    // all transient — worth a retry and/or provider fallback.
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('socket') ||
      message.includes('abort') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('empty response')
    ) {
      return true;
    }
  }

  // AbortError (from the timeout AbortController)
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (name === 'AbortError' || name === 'APIUserAbortError') {
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
 * Checks if an error is specifically a rate limit (429) error.
 */
function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429;
  }
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
  }
  return false;
}

/**
 * Extracts a human-readable retry time from an error message.
 */
function extractRetryTime(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error);
  // Match patterns like "52m5.952s", "27s", "27.010685423s", "Please try again in X"
  const match = msg.match(/(?:try again in|retryDelay['":\s]*)\s*"?(\d+[mhMs.0-9]+s?)"?/i)
    || msg.match(/(\d+m[\d.]+s)/i)
    || msg.match(/(\d+s)/i);
  return match ? match[1] : null;
}

/**
 * Calls Google Gemini API for text-only chat completion (fallback for rate limits).
 */
async function callGeminiText(
  messages: ChatMessage[],
  options: Required<TextCompletionOptions>,
  apiKey: string,
): Promise<string> {
  const client = new GoogleGenAI({ apiKey });

  const { controller, cleanup } = createTimeoutController(options.timeoutMs);

  try {
    // Build the contents for Gemini from messages.
    // Gemini uses "user" and "model" roles; system instructions are separate.
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Ensure there's at least one user message
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: '' }] });
    }

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
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

/**
 * A single named step in the text-generation failover chain.
 * `run` performs one attempt (already includes its own single retry).
 */
interface ProviderAttempt {
  label: string;
  run: () => Promise<string>;
}

/**
 * Runs one provider call with a single retry on transient errors.
 * - Non-transient errors (bad request, auth, unknown model) throw immediately
 *   so the caller can decide whether to fail fast or move to the next provider.
 * - Rate-limit (429) and transient errors are retried once, then rethrown.
 */
async function attemptWithRetry(
  call: () => Promise<string>,
  label: string,
): Promise<string> {
  try {
    return await call();
  } catch (error) {
    // Only retry transient / rate-limit errors. A hard failure (e.g. invalid
    // request or retired model) won't be fixed by retrying the same key.
    if (!isTransientError(error) && !isRateLimitError(error)) {
      throw error;
    }
    const retryTime = extractRetryTime(error);
    console.warn(
      `[ai-client] ${label} transient error${retryTime ? ` (retry in ${retryTime})` : ''}, retrying once...`,
    );
    return await call();
  }
}

/**
 * Builds the ordered failover chain of text-generation attempts:
 * every configured Groq key (in order) followed by Gemini when available.
 * Each Groq key ideally belongs to a separate account so it has its own
 * rate-limit quota, letting a 429 on one key fail over to the next.
 */
function buildTextProviderChain(
  config: ReturnType<typeof loadEnvConfig>,
  messages: ChatMessage[],
  options: Required<TextCompletionOptions>,
): ProviderAttempt[] {
  const chain: ProviderAttempt[] = [];
  const groqKeys = config.GROQ_API_KEYS;

  groqKeys.forEach((key, index) => {
    const label = groqKeys.length > 1 ? `Groq[key ${index + 1}]` : 'Groq';
    chain.push({
      label,
      run: () => attemptWithRetry(() => callGroq(messages, options, key), label),
    });
  });

  if (config.GEMINI_API_KEY) {
    chain.push({
      label: 'Gemini',
      run: () =>
        attemptWithRetry(
          () => callGeminiText(messages, options, config.GEMINI_API_KEY!),
          'Gemini',
        ),
    });
  }

  return chain;
}

/**
 * Generates text completion with automatic multi-key, multi-provider fallback.
 *
 * Provider strategy (in order):
 * 1. Each configured Groq key — GROQ_API_KEY, GROQ_API_KEY_2, ... Separate
 *    accounts give independent rate-limit quotas, so a 429 on one key fails
 *    over to the next before leaving Groq at all.
 * 2. Gemini (if GEMINI_API_KEY is set) as the final fallback.
 *
 * For each attempt: one retry on transient/rate-limit errors, then move to the
 * next provider in the chain. A non-transient error on a Groq key still moves
 * to the next provider (the next key or Gemini may succeed); only when the
 * entire chain is exhausted does this throw.
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

  const chain = buildTextProviderChain(config, messages, resolvedOptions);
  if (chain.length === 0) {
    throw new Error('No API keys configured. Cannot generate text.');
  }

  let lastError: unknown;
  let sawRateLimit = false;

  for (let i = 0; i < chain.length; i++) {
    const attempt = chain[i];
    const isLast = i === chain.length - 1;
    try {
      if (i > 0) {
        console.warn(`[ai-client] Switching to ${attempt.label}.`);
      }
      return await attempt.run();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error)) sawRateLimit = true;

      if (!isLast) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[ai-client] ${attempt.label} failed: ${reason.slice(0, 160)}`);
        continue;
      }
    }
  }

  // Entire chain exhausted.
  const retryTime = extractRetryTime(lastError);
  if (sawRateLimit) {
    const retryMsg = retryTime
      ? ` Try again in ${retryTime}.`
      : ' All providers are rate limited or unavailable. Please wait and try again.';
    throw new Error(`Rate limited/unavailable on all providers.${retryMsg}`);
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Text generation failed on all providers: ${reason}`);
}

/**
 * Analyzes an image using Gemini (vision provider).
 * Retries once on transient error, then fails with provider-specific error.
 * Never falls back to Groq (Groq doesn't support vision).
 */
export async function analyzeImage(
  prompt: string,
  image: ImageInput,
  options?: VisionAnalysisOptions,
): Promise<string> {
  const config = loadEnvConfig();

  if (!config.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is required for image analysis. Please add it to your secrets.env file.'
    );
  }

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
