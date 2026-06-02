import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage, TextCompletionOptions, ImageInput, VisionAnalysisOptions } from '@/infrastructure/ai-client.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the env module to avoid requiring actual secrets
vi.mock('@/env.js', () => ({
  loadEnvConfig: () => ({
    GROQ_API_KEY: 'test-groq-key',
    GEMINI_API_KEY: 'test-gemini-key',
  }),
}));

// Mock Groq SDK
const mockGroqCreate = vi.fn();
vi.mock('groq-sdk', () => {
  return {
    default: class MockGroq {
      chat = {
        completions: {
          create: mockGroqCreate,
        },
      };
    },
  };
});

// Mock Google GenAI
const mockGeminiGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGeminiGenerateContent,
      };
    },
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AI Client - generateText', () => {
  let generateText: (
    messages: ChatMessage[],
    options?: TextCompletionOptions,
  ) => Promise<string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/infrastructure/ai-client.js');
    generateText = mod.generateText;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleMessages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, world!' },
  ];

  describe('successful Groq calls', () => {
    it('returns content from Groq on success', async () => {
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello from Groq!' } }],
      });

      const result = await generateText(sampleMessages);
      expect(result).toBe('Hello from Groq!');
      expect(mockGroqCreate).toHaveBeenCalledTimes(1);
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });

    it('passes temperature and maxTokens to Groq', async () => {
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await generateText(sampleMessages, {
        temperature: 0.5,
        maxTokens: 2048,
      });

      expect(mockGroqCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 2048,
        }),
        expect.anything(),
      );
    });

    it('uses default options when none provided', async () => {
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await generateText(sampleMessages);

      expect(mockGroqCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 4096,
        }),
        expect.anything(),
      );
    });
  });

  describe('Groq retry on transient errors', () => {
    it('retries once on a 500 error then succeeds', async () => {
      const error500 = new Error('Internal Server Error');
      (error500 as any).status = 500;

      mockGroqCreate
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'retry success' } }],
        });

      const result = await generateText(sampleMessages);
      expect(result).toBe('retry success');
      expect(mockGroqCreate).toHaveBeenCalledTimes(2);
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });

    it('retries once on network error then succeeds', async () => {
      const networkError = new Error('ECONNREFUSED');

      mockGroqCreate
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'retry success' } }],
        });

      const result = await generateText(sampleMessages);
      expect(result).toBe('retry success');
      expect(mockGroqCreate).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 rate limit then succeeds', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockGroqCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'after rate limit' } }],
        });

      const result = await generateText(sampleMessages);
      expect(result).toBe('after rate limit');
      expect(mockGroqCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('no Gemini fallback for text', () => {
    it('throws with provider name on non-transient error without Gemini fallback', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockGroqCreate.mockRejectedValue(authError);

      await expect(generateText(sampleMessages)).rejects.toThrow(
        'Groq text generation failed: Invalid API key',
      );
      // Groq called once (no retry for non-transient), Gemini never called
      expect(mockGroqCreate).toHaveBeenCalledTimes(1);
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });

    it('throws with provider name after transient retry fails', async () => {
      const error500 = new Error('Server Error');
      (error500 as any).status = 500;

      mockGroqCreate.mockRejectedValue(error500);

      await expect(generateText(sampleMessages)).rejects.toThrow(
        'Groq text generation failed: Server Error',
      );
      // Transient: Groq called twice (initial + retry), Gemini never called
      expect(mockGroqCreate).toHaveBeenCalledTimes(2);
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('empty response handling', () => {
    it('throws with provider name when Groq returns empty content', async () => {
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      });

      await expect(generateText(sampleMessages)).rejects.toThrow(
        'Groq text generation failed: Groq returned an empty response',
      );
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });

    it('throws with provider name when Groq returns null content', async () => {
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(generateText(sampleMessages)).rejects.toThrow(
        'Groq text generation failed: Groq returned an empty response',
      );
      expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('message formatting', () => {
    it('sends all message roles to Groq correctly', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'What is 2+2?' },
      ];

      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: '4' } }],
      });

      await generateText(messages);

      const callArgs = mockGroqCreate.mock.calls[0][0];
      expect(callArgs.messages).toEqual([
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'What is 2+2?' },
      ]);
    });
  });
});


describe('AI Client - analyzeImage', () => {
  let analyzeImage: (
    prompt: string,
    image: ImageInput,
    options?: VisionAnalysisOptions,
  ) => Promise<string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/infrastructure/ai-client.js');
    analyzeImage = mod.analyzeImage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleImage: ImageInput = {
    data: Buffer.from([0x89, 0x50, 0x4E, 0x47]),
    mimeType: 'image/png',
  };

  describe('successful Gemini vision calls', () => {
    it('returns content from Gemini on success', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        text: 'This image shows a flowchart.',
      });

      const result = await analyzeImage('Describe this image', sampleImage);
      expect(result).toBe('This image shows a flowchart.');
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGroqCreate).not.toHaveBeenCalled();
    });

    it('passes image data as base64 inline data', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        text: 'description',
      });

      await analyzeImage('Describe this', sampleImage);

      expect(mockGeminiGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Describe this' },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: sampleImage.data.toString('base64'),
                  },
                },
              ],
            },
          ],
        }),
      );
    });

    it('passes temperature and maxTokens to Gemini', async () => {
      mockGeminiGenerateContent.mockResolvedValue({
        text: 'description',
      });

      await analyzeImage('Describe this', sampleImage, {
        temperature: 0.3,
        maxTokens: 1024,
      });

      expect(mockGeminiGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            temperature: 0.3,
            maxOutputTokens: 1024,
          }),
        }),
      );
    });
  });

  describe('Gemini retry on transient errors', () => {
    it('retries once on a 500 error then succeeds', async () => {
      const error500 = new Error('Internal Server Error');
      (error500 as any).status = 500;

      mockGeminiGenerateContent
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({
          text: 'retry success',
        });

      const result = await analyzeImage('Describe this', sampleImage);
      expect(result).toBe('retry success');
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockGroqCreate).not.toHaveBeenCalled();
    });

    it('retries once on network error then succeeds', async () => {
      const networkError = new Error('ECONNREFUSED');

      mockGeminiGenerateContent
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          text: 'retry success',
        });

      const result = await analyzeImage('Describe this', sampleImage);
      expect(result).toBe('retry success');
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 rate limit then succeeds', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockGeminiGenerateContent
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          text: 'after rate limit',
        });

      const result = await analyzeImage('Describe this', sampleImage);
      expect(result).toBe('after rate limit');
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('no Groq fallback for vision', () => {
    it('throws with provider name on non-transient error without Groq fallback', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      mockGeminiGenerateContent.mockRejectedValue(authError);

      await expect(analyzeImage('Describe this', sampleImage)).rejects.toThrow(
        'Gemini vision analysis failed: Invalid API key',
      );
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGroqCreate).not.toHaveBeenCalled();
    });

    it('throws with provider name after transient retry fails', async () => {
      const error500 = new Error('Server Error');
      (error500 as any).status = 500;

      mockGeminiGenerateContent.mockRejectedValue(error500);

      await expect(analyzeImage('Describe this', sampleImage)).rejects.toThrow(
        'Gemini vision analysis failed: Server Error',
      );
      expect(mockGeminiGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockGroqCreate).not.toHaveBeenCalled();
    });
  });

  describe('empty response handling', () => {
    it('throws with provider name when Gemini returns empty content', async () => {
      mockGeminiGenerateContent.mockResolvedValue({ text: '' });

      await expect(analyzeImage('Describe this', sampleImage)).rejects.toThrow(
        'Gemini vision analysis failed: Gemini returned an empty response',
      );
      expect(mockGroqCreate).not.toHaveBeenCalled();
    });

    it('throws with provider name when Gemini returns null text', async () => {
      mockGeminiGenerateContent.mockResolvedValue({ text: null });

      await expect(analyzeImage('Describe this', sampleImage)).rejects.toThrow(
        'Gemini vision analysis failed: Gemini returned an empty response',
      );
      expect(mockGroqCreate).not.toHaveBeenCalled();
    });
  });
});


describe('AI Client - generateCompletion (deprecated alias)', () => {
  let generateCompletion: (
    messages: ChatMessage[],
    options?: TextCompletionOptions,
  ) => Promise<string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/infrastructure/ai-client.js');
    generateCompletion = mod.generateCompletion;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleMessages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, world!' },
  ];

  it('works as an alias for generateText', async () => {
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello from deprecated alias!' } }],
    });

    const result = await generateCompletion(sampleMessages);
    expect(result).toBe('Hello from deprecated alias!');
    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
  });

  it('does not fall back to Gemini (no longer has fallback behavior)', async () => {
    const authError = new Error('Invalid API key');
    (authError as any).status = 401;

    mockGroqCreate.mockRejectedValue(authError);

    await expect(generateCompletion(sampleMessages)).rejects.toThrow(
      'Groq text generation failed: Invalid API key',
    );
    expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
  });
});
