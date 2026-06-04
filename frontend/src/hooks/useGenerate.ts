import { useState } from 'react';

interface GenerateResult {
  content: string;
  outputType: 'diagram' | 'document';
  format: string;
  sessionId: string;
  diagramType?: string;
  documentType?: string;
}

export function useGenerate() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (
    prompt: string,
    options: Record<string, string>
  ): Promise<GenerateResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = {
        prompt,
        mode: options.mode,
      };

      if (options.diagramType) body.diagramType = options.diagramType;
      if (options.templateId) body.templateId = options.templateId;
      if (options.outputFormat) body.outputFormat = options.outputFormat;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.error?.message || `Request failed (${response.status})`
        );
      }

      const data = await response.json();
      return data as GenerateResult;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error };
}
