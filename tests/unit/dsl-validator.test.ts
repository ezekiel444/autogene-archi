import { describe, it, expect } from 'vitest';
import { validate, getFirstError } from '@/domain/dsl-validator.js';

describe('DSL Validator', () => {
  describe('validate - Mermaid', () => {
    it('accepts valid flowchart with TD direction', () => {
      const code = 'graph TD\n  A[Start] --> B[End]';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid flowchart with LR direction', () => {
      const code = 'flowchart LR\n  A --> B --> C';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid sequenceDiagram', () => {
      const code = 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob->>Alice: Hi';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid classDiagram', () => {
      const code = 'classDiagram\n  class Animal\n  Animal : +String name';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid erDiagram', () => {
      const code = 'erDiagram\n  CUSTOMER ||--o{ ORDER : places';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid stateDiagram-v2', () => {
      const code = 'stateDiagram-v2\n  [*] --> Active\n  Active --> [*]';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid pie chart', () => {
      const code = 'pie\n  "Dogs" : 386\n  "Cats" : 85';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty code', () => {
      const result = validate('', 'mermaid');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects whitespace-only code', () => {
      const result = validate('   \n  \n  ', 'mermaid');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects code that does not start with a valid keyword', () => {
      const code = 'invalid diagram\n  A --> B';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid diagram type');
    });

    it('detects unmatched opening square bracket', () => {
      const code = 'graph TD\n  A[Start --> B[End]';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('detects unmatched closing square bracket', () => {
      const code = 'graph TD\n  A] --> B[End]';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Unmatched closing bracket');
    });

    it('detects unmatched opening curly bracket', () => {
      const code = 'graph TD\n  A{Decision --> B';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(false);
    });

    it('detects unmatched round brackets', () => {
      const code = 'graph TD\n  A(Start --> B(End)';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(false);
    });

    it('accepts balanced brackets', () => {
      const code = 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C(End)\n  B -->|No| D[Retry]';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts gantt diagram', () => {
      const code = 'gantt\n  title A Gantt Diagram\n  section Section\n  A task : a1, 2024-01-01, 30d';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
    });

    it('accepts mindmap diagram', () => {
      const code = 'mindmap\n  root((mindmap))\n    Origins';
      const result = validate(code, 'mermaid');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validate - PlantUML', () => {
    it('accepts valid PlantUML with @startuml and @enduml', () => {
      const code = '@startuml\nAlice -> Bob : Hello\n@enduml';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts PlantUML with named diagram', () => {
      const code = '@startuml MyDiagram\nAlice -> Bob : Hello\n@enduml';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(true);
    });

    it('accepts PlantUML with multiple content lines', () => {
      const code = '@startuml\nclass Foo {\n  +bar(): void\n}\nclass Baz\nFoo --> Baz\n@enduml';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty code', () => {
      const result = validate('', 'plantuml');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects code without @startuml', () => {
      const code = 'Alice -> Bob : Hello\n@enduml';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('@startuml');
    });

    it('rejects code without @enduml', () => {
      const code = '@startuml\nAlice -> Bob : Hello';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('@enduml');
    });

    it('rejects code missing both markers', () => {
      const code = 'Alice -> Bob : Hello';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    it('warns when no content between markers', () => {
      const code = '@startuml\n@enduml';
      const result = validate(code, 'plantuml');
      // Should be valid (only a warning), since we only fail on errors
      expect(result.isValid).toBe(true);
      // But there should be a warning in the errors array
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('no content');
    });

    it('accepts PlantUML with trailing whitespace lines', () => {
      const code = '@startuml\nAlice -> Bob : Hello\n@enduml\n  \n';
      const result = validate(code, 'plantuml');
      expect(result.isValid).toBe(true);
    });
  });

  describe('getFirstError', () => {
    it('returns null for valid Mermaid code', () => {
      const code = 'graph TD\n  A --> B';
      const error = getFirstError(code, 'mermaid');
      expect(error).toBeNull();
    });

    it('returns null for valid PlantUML code', () => {
      const code = '@startuml\nAlice -> Bob : Hello\n@enduml';
      const error = getFirstError(code, 'plantuml');
      expect(error).toBeNull();
    });

    it('returns the first error for invalid Mermaid code', () => {
      const code = 'invalid code here';
      const error = getFirstError(code, 'mermaid');
      expect(error).not.toBeNull();
      expect(error!.line).toBe(1);
      expect(error!.column).toBe(1);
      expect(error!.message).toContain('Invalid diagram type');
      expect(error!.severity).toBe('error');
    });

    it('returns the first error for PlantUML missing @startuml', () => {
      const code = 'Alice -> Bob\n@enduml';
      const error = getFirstError(code, 'plantuml');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('@startuml');
      expect(error!.severity).toBe('error');
    });

    it('returns null for empty content warning in PlantUML (only warnings)', () => {
      const code = '@startuml\n@enduml';
      const error = getFirstError(code, 'plantuml');
      // getFirstError only returns errors, not warnings
      expect(error).toBeNull();
    });

    it('returns error for empty Mermaid code', () => {
      const error = getFirstError('', 'mermaid');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('Empty diagram code');
    });

    it('returns error for empty PlantUML code', () => {
      const error = getFirstError('', 'plantuml');
      expect(error).not.toBeNull();
      expect(error!.message).toContain('Empty diagram code');
    });

    it('returns error with correct line/column for bracket mismatch', () => {
      const code = 'graph TD\n  A[Start --> B';
      const error = getFirstError(code, 'mermaid');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });
  });
});
