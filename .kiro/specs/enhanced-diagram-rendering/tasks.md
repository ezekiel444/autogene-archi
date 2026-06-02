# Implementation Plan: Enhanced Diagram Rendering

## Overview

This plan implements four enhancements: (1) refactoring the AI client to split Groq (text) and Gemini (vision) into separate purpose-specific functions, (2) adding Mermaid architecture-beta icon pack support, (3) restructuring the UI to a preview-first layout with collapsible code editor, and (4) fixing the display mode bug. The implementation progresses from infrastructure (AI client) through domain callers, then frontend changes, ensuring backward compatibility via a deprecated `generateCompletion` alias.

## Tasks

- [ ] 1. Refactor AI Client — split into generateText and analyzeImage
  - [ ] 1.1 Refactor `src/infrastructure/ai-client.ts` to export `generateText` and `analyzeImage`
    - Rename `generateCompletion` implementation to `generateText` (Groq-only, no Gemini fallback)
    - Add new `analyzeImage` function that calls Gemini with image buffer and prompt
    - Add `ImageInput` and `VisionAnalysisOptions` interfaces
    - Rename `CompletionOptions` to `TextCompletionOptions` (keep `CompletionOptions` as alias)
    - Export `generateCompletion` as a deprecated alias for `generateText` for backward compatibility
    - Remove Gemini fallback logic from text generation path
    - Add retry-once logic for `analyzeImage` on transient errors (same pattern as Groq retry)
    - Error messages must include provider name and task type: `"Groq text generation failed: ..."` or `"Gemini vision analysis failed: ..."`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 1.2 Update `src/domain/diagram-generator.ts` to use `generateText`
    - Replace `import { generateCompletion }` with `import { generateText }`
    - Replace all `generateCompletion(...)` calls with `generateText(...)`
    - _Requirements: 1.1, 1.5_

  - [ ] 1.3 Update `src/domain/document-generator.ts` to use `generateText`
    - Replace `import { generateCompletion }` with `import { generateText }`
    - Replace all `generateCompletion(...)` calls with `generateText(...)`
    - _Requirements: 1.1, 1.5_

  - [ ] 1.4 Update `src/application/prompt-engine.ts` to use `generateText`
    - Replace `import { generateCompletion, type ChatMessage }` with `import { generateText, type ChatMessage }`
    - Replace `generateCompletion(...)` call in `classifyPrompt` with `generateText(...)`
    - _Requirements: 1.1, 1.5_

  - [ ] 1.5 Update `src/domain/attachment-processor.ts` to use `analyzeImage` for image attachments
    - Import `analyzeImage` and `ImageInput` from `ai-client.ts`
    - In the `process` function, for image files, call `analyzeImage` with the image buffer and a descriptive prompt to extract visual context
    - Store the AI-generated description in `AttachmentContext.extractedText`
    - Handle errors gracefully (if vision analysis fails, fall back to metadata-only context)
    - _Requirements: 1.2, 1.6_

  - [ ]* 1.6 Write property tests for AI client routing (Properties 1–4)
    - **Property 1: Text tasks route exclusively to Groq**
    - **Property 2: Vision tasks route exclusively to Gemini**
    - **Property 3: Transient failure triggers exactly one retry on designated provider**
    - **Property 4: Provider failure error includes provider name and task type**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

  - [ ]* 1.7 Update unit tests in `tests/unit/ai-client.test.ts`
    - Update existing tests that mock `generateCompletion` to test `generateText` instead
    - Add tests for `analyzeImage` (success, transient retry, failure)
    - Verify `generateCompletion` deprecated alias still works
    - Verify Gemini is never called for text tasks
    - Verify Groq is never called for vision tasks
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 2. Checkpoint — AI client refactoring complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Add Mermaid icon pack registration for architecture-beta diagrams
  - [ ] 3.1 Add icon pack registration to `public/app.js`
    - Add `ICON_PACKS` constant array: `['aws', 'azure', 'gcp', 'logos']`
    - Implement `registerIconPacks()` async function that fetches icon JSON from `https://unpkg.com/@iconify-json/{pack}/icons.json`
    - Call `mermaid.registerIconPacks()` with loaded icon data
    - Handle fetch failures gracefully (log warning, continue without icons)
    - Call `registerIconPacks()` after `mermaid.initialize()` in `initMermaid()`
    - Add `isArchitectureBeta(code)` helper that checks if first non-empty line starts with `architecture-beta`
    - Use `isArchitectureBeta` check before triggering icon-aware rendering paths
    - _Requirements: 2.1, 2.3, 2.5, 2.6_

  - [ ] 3.2 Update diagram generation system prompt in `src/domain/diagram-generator.ts` for cloud-architecture
    - When `diagramType` is `cloud-architecture`, add instructions to generate `architecture-beta` syntax
    - Include guidance to use iconify icon identifiers (e.g., `aws:ec2`, `azure:vm`, `gcp:compute-engine`, `logos:kubernetes`)
    - Map common cloud service names to iconify identifiers in the prompt instructions
    - _Requirements: 2.2, 2.4_

  - [ ]* 3.3 Write property test for architecture-beta detection (Property 5)
    - **Property 5: Architecture-beta detection validates first line keyword**
    - **Validates: Requirements 2.6**

  - [ ]* 3.4 Write unit tests for icon pack registration and architecture-beta detection
    - Test `isArchitectureBeta()` with various inputs (valid, invalid, empty, whitespace)
    - Test `registerIconPacks()` handles CDN failures gracefully
    - _Requirements: 2.1, 2.5, 2.6_

- [ ] 4. Implement preview-first UI layout with collapsible code editor
  - [ ] 4.1 Restructure `public/index.html` results section for preview-first layout
    - Move `diagram-preview-section` above `code-editor-section` in DOM order
    - Add collapse toggle button to code editor header with chevron SVG icon
    - Add `id="code-editor-toggle"` button with `aria-expanded="false"` and `aria-controls="code-editor-body"`
    - Wrap code editor content in `<div id="code-editor-body" class="code-editor-body collapsed">`
    - Hide raw `results-content` pre element by default when preview or editor is active
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.2 Add CSS for preview-first layout and collapsible editor in `public/styles.css`
    - Set `min-height: 400px` on `.diagram-preview-panel` and `.diagram-preview-viewport`
    - Add `.code-editor-body.collapsed { display: none; }` and `.code-editor-body.expanded { display: block; }`
    - Style `.code-editor-toggle` button (flex, gap, background none, cursor pointer)
    - Add chevron rotation for expanded state: `.code-editor-toggle[aria-expanded="true"] .toggle-chevron { transform: rotate(180deg); }`
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [ ] 4.3 Add collapse/expand toggle logic in `public/app.js`
    - Implement `setCodeEditorCollapsed(collapsed)` function
    - Add event listener on `code-editor-toggle` button to toggle collapsed/expanded state
    - Ensure preview panel remains visible when code editor is collapsed or expanded
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.4 Write property tests for code editor collapse behavior (Properties 9, 10)
    - **Property 9: Code editor starts collapsed for diagram output**
    - **Property 10: Collapsing code editor preserves preview panel visibility**
    - **Validates: Requirements 3.2, 3.4, 3.5**

- [ ] 5. Fix display mode bug in `public/app.js`
  - [ ] 5.1 Rewrite `displayResults` function as a single unified implementation
    - Remove the override chain (`_originalDisplayResults`, `displayResultsWithEditor`, `displayResultsWithPreview`)
    - Implement single `displayResults(data)` function that evaluates `data.outputType` first
    - For `outputType === 'diagram'`: show preview panel (hero), init code editor (collapsed), hide markdown editor, hide raw results
    - For `outputType === 'document'`: show markdown editor, hide preview panel, hide code editor
    - For unknown outputType: show raw content only, hide all specialized panels
    - Add helper functions: `hideDiagramPreview()`, `hideCodeEditor()`, `showDiagramPreview(code, format)`
    - Ensure panel activation triggers diagram rendering within 100ms
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property tests for display mode (Properties 7, 8)
    - **Property 7: Diagram output activates preview and hides markdown editor**
    - **Property 8: Document output activates markdown editor and hides diagram panels**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 5.3 Write unit tests for display mode transitions
    - Test diagram → document switching hides diagram panels before showing markdown
    - Test document → diagram switching hides markdown before showing preview
    - Test unknown outputType shows raw content
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

- [ ] 6. Update existing test mocks for callers
  - [ ] 6.1 Update `tests/unit/diagram-generator.test.ts` mock from `generateCompletion` to `generateText`
    - Change mock target from `generateCompletion` to `generateText` in the ai-client mock
    - Verify all existing test assertions still pass
    - _Requirements: 1.1_

  - [ ] 6.2 Update `tests/unit/document-generator.test.ts` mock from `generateCompletion` to `generateText`
    - Change mock target from `generateCompletion` to `generateText` in the ai-client mock
    - Verify all existing test assertions still pass
    - _Requirements: 1.1_

  - [ ] 6.3 Update `tests/unit/prompt-engine.test.ts` mock from `generateCompletion` to `generateText`
    - Change mock target from `generateCompletion` to `generateText` in the ai-client mock
    - Verify all existing test assertions still pass
    - _Requirements: 1.1_

- [ ] 7. Final checkpoint — all features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The deprecated `generateCompletion` alias ensures existing code continues to work during migration
- Frontend changes use vanilla HTML/CSS/JS consistent with the existing architecture
- Icon packs are loaded from CDN (unpkg.com) — no npm dependencies needed for client-side icons

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "1.7", "6.1", "6.2", "6.3"] },
    { "id": 3, "tasks": ["3.1", "3.2", "4.1", "4.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "4.3", "5.1"] },
    { "id": 5, "tasks": ["4.4", "5.2", "5.3"] }
  ]
}
```
