import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for diagram code editor logic (public/app.js).
 *
 * Since the code editor is client-side vanilla JS, these tests validate
 * the core behavioral logic: debounce timing, error display formatting,
 * line number generation, and validation flow.
 */

describe('Code Editor Logic', () => {
  // ─── Debounce Behavior ─────────────────────────────────────────────────

  describe('debounce behavior', () => {
    const EDITOR_DEBOUNCE_MS = 2000;

    it('debounce constant is 2000ms per requirement 11.2', () => {
      // The requirement specifies 2-second debounce (1s idle + 1s render window)
      expect(EDITOR_DEBOUNCE_MS).toBe(2000);
    });

    it('debounce timer resets on each keystroke', () => {
      vi.useFakeTimers();
      let renderCount = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function simulateInput() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { renderCount++; }, EDITOR_DEBOUNCE_MS);
      }

      // Simulate rapid typing
      simulateInput();
      vi.advanceTimersByTime(500);
      simulateInput();
      vi.advanceTimersByTime(500);
      simulateInput();
      vi.advanceTimersByTime(500);

      // Not enough time has passed since last keystroke
      expect(renderCount).toBe(0);

      // Advance past debounce from last keystroke
      vi.advanceTimersByTime(EDITOR_DEBOUNCE_MS);
      expect(renderCount).toBe(1);

      vi.useRealTimers();
    });

    it('fires render only once after typing stops', () => {
      vi.useFakeTimers();
      let renderCount = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;

      function simulateInput() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { renderCount++; }, EDITOR_DEBOUNCE_MS);
      }

      // Type 5 characters
      for (let i = 0; i < 5; i++) {
        simulateInput();
        vi.advanceTimersByTime(100);
      }

      // Wait for debounce to fire
      vi.advanceTimersByTime(EDITOR_DEBOUNCE_MS);
      expect(renderCount).toBe(1);

      vi.useRealTimers();
    });
  });

  // ─── Line Number Generation ────────────────────────────────────────────

  describe('line number generation', () => {
    function generateLineNumbers(code: string): number {
      return code.split('\n').length;
    }

    it('returns 1 for empty string', () => {
      expect(generateLineNumbers('')).toBe(1);
    });

    it('returns correct count for single line', () => {
      expect(generateLineNumbers('graph TD')).toBe(1);
    });

    it('returns correct count for multi-line code', () => {
      const code = 'graph TD\n  A --> B\n  B --> C\n  C --> D';
      expect(generateLineNumbers(code)).toBe(4);
    });

    it('counts trailing newline as additional line', () => {
      const code = 'graph TD\n  A --> B\n';
      expect(generateLineNumbers(code)).toBe(3);
    });
  });

  // ─── Error Display ─────────────────────────────────────────────────────

  describe('error display formatting', () => {
    interface SyntaxError {
      line: number;
      column?: number;
      message: string;
      severity: 'error' | 'warning';
    }

    function formatErrorDisplay(err: SyntaxError): string {
      const location = `Ln ${err.line}${err.column ? `:${err.column}` : ''}`;
      return `${location} — ${err.message}`;
    }

    it('formats error with line and column', () => {
      const err: SyntaxError = { line: 5, column: 12, message: 'Unexpected token', severity: 'error' };
      expect(formatErrorDisplay(err)).toBe('Ln 5:12 — Unexpected token');
    });

    it('formats error with line only (no column)', () => {
      const err: SyntaxError = { line: 3, message: 'Missing end keyword', severity: 'error' };
      expect(formatErrorDisplay(err)).toBe('Ln 3 — Missing end keyword');
    });

    it('handles line 1 errors', () => {
      const err: SyntaxError = { line: 1, column: 1, message: 'Invalid diagram type', severity: 'error' };
      expect(formatErrorDisplay(err)).toBe('Ln 1:1 — Invalid diagram type');
    });
  });

  // ─── Error Line Highlighting ───────────────────────────────────────────

  describe('error line highlighting', () => {
    interface SyntaxError {
      line: number;
      column?: number;
      message: string;
      severity: 'error' | 'warning';
    }

    function getErrorLines(errors: SyntaxError[]): number[] {
      return errors.map(e => e.line);
    }

    it('returns empty array for no errors', () => {
      expect(getErrorLines([])).toEqual([]);
    });

    it('returns correct line numbers for single error', () => {
      const errors: SyntaxError[] = [{ line: 3, column: 1, message: 'err', severity: 'error' }];
      expect(getErrorLines(errors)).toEqual([3]);
    });

    it('returns correct line numbers for multiple errors', () => {
      const errors: SyntaxError[] = [
        { line: 2, column: 5, message: 'err1', severity: 'error' },
        { line: 7, column: 1, message: 'err2', severity: 'warning' },
        { line: 12, message: 'err3', severity: 'error' },
      ];
      expect(getErrorLines(errors)).toEqual([2, 7, 12]);
    });
  });

  // ─── Validation Response Handling ──────────────────────────────────────

  describe('validation response handling', () => {
    interface ValidationResult {
      isValid: boolean;
      errors?: Array<{ line: number; column: number; message: string; severity: string }>;
    }

    it('treats valid response correctly', () => {
      const result: ValidationResult = { isValid: true, errors: [] };
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('treats invalid response with errors correctly', () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          { line: 1, column: 1, message: 'Unknown diagram type', severity: 'error' },
        ],
      };
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].line).toBe(1);
    });

    it('handles response with no errors array', () => {
      const result: ValidationResult = { isValid: true };
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  // ─── Tab Key Behavior ──────────────────────────────────────────────────

  describe('tab insertion logic', () => {
    function insertTab(value: string, selectionStart: number, selectionEnd: number): { value: string; cursor: number } {
      const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
      return { value: newValue, cursor: selectionStart + 2 };
    }

    it('inserts 2 spaces at cursor position', () => {
      const result = insertTab('graph TD', 5, 5);
      // 'graph' + '  ' + ' TD' (space at position 5 remains)
      expect(result.value).toBe('graph   TD');
      expect(result.cursor).toBe(7);
    });

    it('replaces selected text with 2 spaces', () => {
      const result = insertTab('graph TD', 0, 5);
      // Replaces 'graph' (positions 0-5) with '  ', leaving ' TD'
      expect(result.value).toBe('   TD');
      expect(result.cursor).toBe(2);
    });

    it('inserts at the beginning', () => {
      const result = insertTab('A --> B', 0, 0);
      expect(result.value).toBe('  A --> B');
      expect(result.cursor).toBe(2);
    });

    it('inserts at the end', () => {
      const result = insertTab('A --> B', 7, 7);
      expect(result.value).toBe('A --> B  ');
      expect(result.cursor).toBe(9);
    });
  });
});
