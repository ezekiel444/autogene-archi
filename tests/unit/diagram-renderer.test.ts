import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OutputFormat, RenderResult } from '@/types/index.js';
import { RENDER_TIMEOUT_MS } from '@/types/index.js';

describe('Diagram Renderer', () => {
  let render: (code: string, format: OutputFormat) => Promise<RenderResult>;
  let isValid: (code: string, format: OutputFormat) => boolean;
  let canRenderServerSide: (format: OutputFormat) => boolean;
  let getLastValidRender: () => RenderResult | null;
  let resetLastValidRender: () => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    const mod = await import('@/infrastructure/diagram-renderer.js');
    render = mod.render;
    isValid = mod.isValid;
    canRenderServerSide = mod.canRenderServerSide;
    getLastValidRender = mod.getLastValidRender;
    resetLastValidRender = mod.resetLastValidRender;
    resetLastValidRender();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── isValid ─────────────────────────────────────────────────────────────

  describe('isValid', () => {
    describe('Mermaid format', () => {
      it('returns true for valid flowchart code', () => {
        expect(isValid('graph TD\n  A --> B', 'mermaid')).toBe(true);
      });

      it('returns true for flowchart keyword', () => {
        expect(isValid('flowchart LR\n  A --> B', 'mermaid')).toBe(true);
      });

      it('returns true for sequenceDiagram', () => {
        expect(isValid('sequenceDiagram\n  Alice->>Bob: Hello', 'mermaid')).toBe(true);
      });

      it('returns true for classDiagram', () => {
        expect(isValid('classDiagram\n  class Animal', 'mermaid')).toBe(true);
      });

      it('returns true for stateDiagram', () => {
        expect(isValid('stateDiagram\n  [*] --> Still', 'mermaid')).toBe(true);
      });

      it('returns true for stateDiagram-v2 (starts with stateDiagram keyword)', () => {
        expect(isValid('stateDiagram-v2\n  [*] --> Still', 'mermaid')).toBe(true);
      });

      it('returns true for erDiagram', () => {
        expect(isValid('erDiagram\n  CUSTOMER ||--o{ ORDER : places', 'mermaid')).toBe(true);
      });

      it('returns true for gantt', () => {
        expect(isValid('gantt\n  title A Gantt Diagram', 'mermaid')).toBe(true);
      });

      it('returns true for pie chart', () => {
        expect(isValid('pie\n  "Dogs" : 50', 'mermaid')).toBe(true);
      });

      it('returns false for empty string', () => {
        expect(isValid('', 'mermaid')).toBe(false);
      });

      it('returns false for whitespace-only', () => {
        expect(isValid('   \n\t  ', 'mermaid')).toBe(false);
      });

      it('returns false for unrecognized syntax', () => {
        expect(isValid('hello world this is not a diagram', 'mermaid')).toBe(false);
      });
    });

    describe('PlantUML format', () => {
      it('returns true for valid PlantUML with @startuml and @enduml', () => {
        expect(isValid('@startuml\nAlice -> Bob : Hello\n@enduml', 'plantuml')).toBe(true);
      });

      it('returns false for missing @startuml', () => {
        expect(isValid('Alice -> Bob : Hello\n@enduml', 'plantuml')).toBe(false);
      });

      it('returns false for missing @enduml', () => {
        expect(isValid('@startuml\nAlice -> Bob : Hello', 'plantuml')).toBe(false);
      });

      it('returns false for empty string', () => {
        expect(isValid('', 'plantuml')).toBe(false);
      });

      it('returns false for whitespace-only', () => {
        expect(isValid('   ', 'plantuml')).toBe(false);
      });
    });
  });

  // ─── canRenderServerSide ─────────────────────────────────────────────────

  describe('canRenderServerSide', () => {
    it('returns false for mermaid (requires browser DOM)', () => {
      expect(canRenderServerSide('mermaid')).toBe(false);
    });

    it('returns true for plantuml (uses public server)', () => {
      expect(canRenderServerSide('plantuml')).toBe(true);
    });
  });

  // ─── render (Mermaid) ────────────────────────────────────────────────────

  describe('render - Mermaid', () => {
    it('returns a placeholder SVG for Mermaid diagrams', async () => {
      const result = await render('graph TD\n  A --> B', 'mermaid');

      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('data-requires-client-render="true"');
      expect(result.svg).toContain('data-mermaid-source');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('escapes special characters in SVG source attribute', async () => {
      const code = 'graph TD\n  A["<script>alert(1)</script>"] --> B';
      const result = await render(code, 'mermaid');

      expect(result.svg).not.toContain('<script>');
      expect(result.svg).toContain('&lt;script&gt;');
    });

    it('stores result as last valid render', async () => {
      expect(getLastValidRender()).toBeNull();

      await render('graph TD\n  A --> B', 'mermaid');

      expect(getLastValidRender()).not.toBeNull();
      expect(getLastValidRender()!.svg).toContain('<svg');
    });
  });

  // ─── render (PlantUML) ───────────────────────────────────────────────────

  describe('render - PlantUML', () => {
    it('fetches SVG from PlantUML server', async () => {
      const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><text>Test</text></svg>';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(mockSvg, { status: 200, headers: { 'Content-Type': 'image/svg+xml' } }),
      );

      const result = await render('@startuml\nAlice -> Bob : Hello\n@enduml', 'plantuml');

      expect(result.svg).toBe(mockSvg);
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('constructs correct PlantUML server URL with hex encoding', async () => {
      const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(mockSvg, { status: 200 }),
      );

      const code = '@startuml\nBob -> Alice\n@enduml';
      await render(code, 'plantuml');

      const expectedHex = Buffer.from(code, 'utf-8').toString('hex');
      expect(fetchSpy).toHaveBeenCalledWith(
        `http://www.plantuml.com/plantuml/svg/~h${expectedHex}`,
      );
    });

    it('throws on PlantUML server HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
      );

      resetLastValidRender();

      await expect(
        render('@startuml\ninvalid\n@enduml', 'plantuml'),
      ).rejects.toThrow('PlantUML server returned HTTP 500');
    });

    it('uses default dimensions when SVG lacks width/height', async () => {
      const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>No dims</text></svg>';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(mockSvg, { status: 200 }),
      );

      const result = await render('@startuml\nA -> B\n@enduml', 'plantuml');

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  // ─── Timeout ─────────────────────────────────────────────────────────────

  describe('render timeout', () => {
    it('rejects if render exceeds RENDER_TIMEOUT_MS', async () => {
      vi.useFakeTimers();

      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve(new Response('<svg></svg>', { status: 200 })), RENDER_TIMEOUT_MS + 1000);
        }),
      );

      resetLastValidRender();

      const renderPromise = render('@startuml\nA -> B\n@enduml', 'plantuml');

      // Advance past the timeout
      vi.advanceTimersByTime(RENDER_TIMEOUT_MS + 1);

      await expect(renderPromise).rejects.toThrow('Render timeout: exceeded 3 second limit');

      vi.useRealTimers();
    });

    it('RENDER_TIMEOUT_MS is 3000ms', () => {
      expect(RENDER_TIMEOUT_MS).toBe(3000);
    });
  });

  // ─── Last valid render retention ─────────────────────────────────────────

  describe('last valid render retention', () => {
    it('returns last valid render on error', async () => {
      // First successful render (Mermaid always succeeds)
      const successResult = await render('graph TD\n  A --> B', 'mermaid');
      expect(successResult.svg).toContain('<svg');

      // Now simulate a failed PlantUML render
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Error', { status: 500, statusText: 'Server Error' }),
      );

      const fallbackResult = await render('@startuml\nbad\n@enduml', 'plantuml');

      // Should return the last valid render
      expect(fallbackResult).toEqual(successResult);
    });

    it('throws if no last valid render exists and render fails', async () => {
      resetLastValidRender();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Error', { status: 500, statusText: 'Server Error' }),
      );

      await expect(
        render('@startuml\nbad\n@enduml', 'plantuml'),
      ).rejects.toThrow('PlantUML server returned HTTP 500');
    });

    it('updates last valid render on successful render', async () => {
      const result1 = await render('graph TD\n  A --> B', 'mermaid');
      expect(getLastValidRender()).toEqual(result1);

      const result2 = await render('flowchart LR\n  X --> Y', 'mermaid');
      expect(getLastValidRender()).toEqual(result2);
      expect(getLastValidRender()).not.toEqual(result1);
    });
  });

  // ─── resetLastValidRender ────────────────────────────────────────────────

  describe('resetLastValidRender', () => {
    it('clears the last valid render cache', async () => {
      await render('graph TD\n  A --> B', 'mermaid');
      expect(getLastValidRender()).not.toBeNull();

      resetLastValidRender();
      expect(getLastValidRender()).toBeNull();
    });
  });
});
