# Implementation Plan: AI Diagram & Document Generator

## Overview

This plan implements a local AI-powered tool that generates diagrams-as-code and structured technical documents from natural language prompts. The implementation follows a layered architecture with TypeScript/Node.js backend, Ollama for AI inference, Mermaid/PlantUML for diagram rendering, and markdown-it for document rendering. Tasks are organized to build foundational layers first, then progressively wire components together.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Initialize TypeScript project with build configuration
    - Create package.json with dependencies (express, uuid, mermaid, plantuml-wasm, markdown-it, fast-check, vitest, msw, supertest)
    - Configure tsconfig.json with strict mode
    - Create directory structure: src/{api, application, domain, infrastructure}, tests/{unit, property, integration}
    - Set up vitest configuration
    - _Requirements: 12.1_

  - [x] 1.2 Define core type definitions and interfaces
    - Create src/types/index.ts with all shared types: DiagramType, OutputFormat, DocumentType, GenerationRequest, GenerationResponse, ValidationResult, ErrorResponse
    - Create src/types/errors.ts with error codes enum and ErrorResponse interface
    - _Requirements: 1.1, 2.2, 3.3, 6.2, 12.4_

- [x] 2. Implement input validation layer
  - [x] 2.1 Implement prompt validation in the Prompt Engine
    - Create src/application/prompt-engine.ts with validateInput method
    - Validate prompt length (1–10,000 characters), reject empty/whitespace-only prompts
    - Return appropriate error codes: PROMPT_EMPTY, PROMPT_TOO_LONG
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property tests for prompt validation
    - **Property 1: Prompt length validation boundary**
    - **Property 2: Whitespace-only prompts are rejected**
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [x] 2.3 Implement attachment validation in the Attachment Processor
    - Create src/domain/attachment-processor.ts
    - Validate file type against supported extensions list
    - Validate file size (≤ 10 MB per file)
    - Validate attachment count (≤ 5 per prompt)
    - Validate non-empty files (reject 0-byte files)
    - Return error codes: ATTACHMENT_TOO_LARGE, ATTACHMENT_TYPE_UNSUPPORTED, ATTACHMENT_LIMIT_EXCEEDED, ATTACHMENT_EMPTY
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.8_

  - [ ]* 2.4 Write property tests for attachment validation
    - **Property 9: Attachment file type validation**
    - **Property 10: Attachment file size validation**
    - **Property 11: Attachment count limit enforcement**
    - **Validates: Requirements 10.3, 10.4, 10.5, 10.6**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement session management
  - [x] 4.1 Implement Session Manager
    - Create src/application/session-manager.ts
    - Implement createSession, getSession, addExchange, undo, getHistory
    - Store sessions as JSON files in a configurable data directory
    - Enforce 50 exchange limit per session
    - Implement undo that removes the last exchange and returns the previous state
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 4.2 Write property tests for session management
    - **Property 6: Session history preservation**
    - **Property 7: Session undo restores previous state**
    - **Property 8: Session exchange limit enforcement**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 8.2, 8.3, 8.4, 8.5, 8.6**

- [x] 5. Implement template management
  - [x] 5.1 Implement Template Manager
    - Create src/application/template-manager.ts
    - Implement listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, validateTemplate
    - Store templates as JSON files
    - Enforce built-in template immutability (reject update/delete on isBuiltIn=true)
    - Enforce 100 custom template limit
    - Validate template structure (non-empty, required fields)
    - Check template type compatibility with generation request type
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 5.2 Create built-in templates
    - Create default templates for each diagram type (flowchart, ER, cloud architecture, sequence, BPMN, class, network, state, data flow)
    - Create default templates for each document type (design doc, documentation outline, SOP, API doc, technical spec)
    - Store in a built-in templates directory marked as isBuiltIn=true
    - _Requirements: 9.1_

  - [ ]* 5.3 Write property tests for template management
    - **Property 13: Template type compatibility validation**
    - **Property 14: Built-in template immutability**
    - **Property 15: Custom template validation and persistence round-trip**
    - **Property 16: Custom template count limit**
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.6**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement AI inference and generation layer
  - [x] 7.1 Implement Ollama AI client
    - Create src/infrastructure/ollama-client.ts
    - Implement chat completion call to Ollama REST API (OpenAI-compatible format)
    - Handle timeouts (30s for generation), retries (1 automatic retry on transient failure)
    - Handle connection errors with clear error messages when Ollama is unavailable
    - _Requirements: 2.1, 2.5, 2.6, 6.6_

  - [x] 7.2 Implement prompt classification
    - Add classifyPrompt method to src/application/prompt-engine.ts
    - Use Ollama to classify prompts as 'diagram', 'document', or 'ambiguous'
    - Return ambiguous classification when confidence is below threshold (0.7)
    - _Requirements: 1.1, 1.6_

  - [ ]* 7.3 Write property test for classification
    - **Property 3: Classification always produces a valid result**
    - **Validates: Requirements 1.1**

  - [x] 7.4 Implement Diagram Generator
    - Create src/domain/diagram-generator.ts
    - Implement generate and refine methods
    - Construct structured prompts including diagram type, output format, template constraints, and session context
    - Infer diagram type when not specified
    - Default to Mermaid format when no format specified
    - Include attachment context in prompts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 5.1_

  - [x] 7.5 Implement Document Generator
    - Create src/domain/document-generator.ts
    - Implement generate and refine methods
    - Construct structured prompts for document generation including template structure
    - Infer document type when not specified
    - Ensure output contains title heading, ≥2 section headings, and content under each section
    - Produce valid CommonMark Markdown
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_

  - [ ]* 7.6 Write property test for output format routing
    - **Property 4: Output format routing correctness**
    - **Property 5: Diagram output is valid plain text**
    - **Validates: Requirements 3.3, 3.4, 3.5**

- [x] 8. Implement DSL validation and rendering
  - [x] 8.1 Implement DSL Validator
    - Create src/domain/dsl-validator.ts
    - Validate Mermaid syntax using mermaid parse API
    - Validate PlantUML syntax using plantuml-wasm
    - Return SyntaxError with line/column information
    - _Requirements: 2.1, 2.4, 11.3_

  - [x] 8.2 Implement Diagram Renderer
    - Create src/infrastructure/diagram-renderer.ts
    - Render Mermaid diagrams to SVG using mermaid npm package
    - Render PlantUML diagrams to SVG using plantuml-wasm
    - Enforce 3-second render timeout
    - Retain last valid render on error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.2, 11.3, 11.4_

  - [ ]* 8.3 Write property test for diagram syntax error handling
    - **Property 17: Diagram syntax error identification preserves last valid render**
    - **Validates: Requirements 4.3, 11.3**

- [x] 9. Implement attachment processing
  - [x] 9.1 Implement text content extraction in Attachment Processor
    - Add process method to src/domain/attachment-processor.ts
    - Extract text content from .txt, .md, and source code files (direct read)
    - Extract text from PDF files using a PDF parsing library
    - Pass image files as binary data for AI model context
    - Handle corrupt, encoding-error, and password-protected files with specific error codes
    - _Requirements: 10.1, 10.2, 10.7_

  - [ ]* 9.2 Write property test for text extraction
    - **Property 12: Text attachment content extraction round-trip**
    - **Validates: Requirements 10.1**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement REST API layer
  - [x] 11.1 Implement API endpoints
    - Create src/api/routes.ts with Express router
    - POST /api/generate — accepts GenerationRequest, returns GenerationResponse
    - POST /api/sessions/:sessionId/undo — performs undo on session
    - GET /api/sessions/:sessionId — returns session history
    - GET /api/templates — lists templates with optional filter
    - POST /api/templates — creates custom template
    - PUT /api/templates/:templateId — updates custom template
    - DELETE /api/templates/:templateId — deletes custom template
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

  - [x] 11.2 Implement API error handling and status codes
    - Create src/api/error-handler.ts middleware
    - Map domain errors to HTTP status codes (200, 400, 404, 500)
    - Enforce 60-second API timeout
    - Return structured ErrorResponse JSON with error code, message, details, timestamp, requestId
    - _Requirements: 12.4, 12.6, 12.7_

  - [ ]* 11.3 Write property test for API status codes
    - **Property 19: API status code correctness**
    - **Validates: Requirements 12.4, 12.7**

- [x] 12. Implement web UI components
  - [x] 12.1 Implement prompt input interface
    - Create frontend component for natural language prompt input
    - Add file attachment upload (drag-and-drop and file picker, max 5 files)
    - Add template selection dropdown
    - Add diagram type and output format selectors
    - Display validation errors inline
    - _Requirements: 1.1, 1.2, 10.5_

  - [x] 12.2 Implement diagram code editor with syntax highlighting
    - Create code editor component with syntax highlighting for Mermaid and PlantUML
    - Support undo/redo of manual edits
    - Highlight syntax errors at line/column positions
    - Trigger re-render on edit with 2-second debounce (1-second idle detection + rendering)
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [ ]* 12.3 Write property test for editor undo/redo
    - **Property 18: Editor undo/redo round-trip**
    - **Validates: Requirements 11.5**

  - [x] 12.4 Implement diagram visual renderer panel
    - Create diagram preview panel that renders SVG output from Diagram Renderer
    - Add zoom and pan controls for inspecting diagram elements
    - Display error indicator on syntax errors while retaining last valid render
    - Fall back to displaying raw code when rendering fails
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 12.5 Implement split-pane Markdown editor
    - Create split-view component: raw Markdown on left, rendered preview on right
    - Use markdown-it for CommonMark rendering (headings, lists, tables, code blocks, links)
    - Update preview within 1 second of edits
    - Enforce 100,000 character limit with notification
    - Add save action with confirmation feedback
    - Display raw text in preview when rendering fails
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 12.6 Write property tests for document editor
    - **Property 20: Document editor character limit enforcement**
    - **Property 21: CommonMark rendering validity**
    - **Validates: Requirements 7.4, 7.7**

- [x] 13. Wire components together and implement request flow
  - [x] 13.1 Implement full Prompt Engine orchestration
    - Wire Prompt Engine submitRequest to call: validateInput → AttachmentProcessor.process → classifyPrompt → route to DiagramGenerator or DocumentGenerator
    - Integrate session context retrieval and update via Session Manager
    - Apply template constraints via Template Manager
    - Handle ambiguous classification by returning clarification request to user
    - Include code snippet structural extraction for code-based prompts
    - _Requirements: 1.1, 1.2, 1.6, 2.3, 5.1, 5.2, 6.3, 8.1, 8.2, 9.2_

  - [x] 13.2 Create application entry point and server configuration
    - Create src/index.ts with Express server setup
    - Mount API routes
    - Configure CORS, body parsing (JSON + multipart for attachments), request ID generation
    - Add global error handling middleware
    - Add startup check for Ollama availability
    - _Requirements: 12.1_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout (backend and frontend) as specified in the design
- Ollama must be running locally for AI inference integration tests
- fast-check is used for property-based testing with minimum 100 iterations per property

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.3"] },
    { "id": 3, "tasks": ["2.2", "2.4"] },
    { "id": 4, "tasks": ["4.1", "5.1"] },
    { "id": 5, "tasks": ["4.2", "5.2", "5.3"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.4", "7.5", "9.1"] },
    { "id": 8, "tasks": ["7.3", "7.6", "8.1", "9.2"] },
    { "id": 9, "tasks": ["8.2", "8.3"] },
    { "id": 10, "tasks": ["11.1", "12.1"] },
    { "id": 11, "tasks": ["11.2", "11.3", "12.2", "12.5"] },
    { "id": 12, "tasks": ["12.3", "12.4", "12.6"] },
    { "id": 13, "tasks": ["13.1"] },
    { "id": 14, "tasks": ["13.2"] }
  ]
}
```
