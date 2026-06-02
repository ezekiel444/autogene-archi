# Requirements Document

## Introduction

This feature provides a local AI-powered tool for generating diagrams-as-code and structured technical documents from natural language prompts. Inspired by Eraser.io, the system enables users to describe diagrams or documents in plain English (or provide code snippets) and receive editable output in diagram DSL (e.g., Mermaid) or Markdown format. Users can iterate on generated outputs through follow-up prompts, use templates for consistent formatting, and attach files for additional context.

## Glossary

- **Diagram_Generator**: The component responsible for converting natural language prompts into diagram-as-code output
- **Document_Generator**: The component responsible for converting natural language prompts into structured Markdown documents
- **Prompt_Engine**: The component that processes user input (natural language, code snippets, or file attachments) and routes requests to the appropriate generator
- **Diagram_Code**: Textual representation of a diagram in a supported DSL syntax (e.g., Mermaid, PlantUML) that can be rendered visually
- **Diagram_Renderer**: The component that renders Diagram_Code into a visual representation for preview
- **Template_Manager**: The component that manages reusable templates for diagrams and documents
- **Session**: A conversation context that tracks the history of prompts and generated outputs for iterative refinement
- **Attachment_Processor**: The component that extracts context from uploaded files (images, PDFs, code files) to inform generation

## Requirements

### Requirement 1: Natural Language Prompt Input

**User Story:** As a user, I want to describe what I need in natural language, so that I can generate diagrams or documents without learning specialized syntax.

#### Acceptance Criteria

1. WHEN a user submits a text prompt, THE Prompt_Engine SHALL accept the input, classify it as a diagram request or a document request, and route it to the corresponding generator
2. WHEN a user submits a code snippet as input, THE Prompt_Engine SHALL extract structural information (e.g., classes, functions, relationships) from the code and include it as context for the generation request
3. THE Prompt_Engine SHALL support prompts up to 10,000 characters in length
4. IF a prompt is empty or contains only whitespace, THEN THE Prompt_Engine SHALL return a validation error with a message indicating that the prompt must contain non-whitespace content
5. IF a prompt exceeds 10,000 characters in length, THEN THE Prompt_Engine SHALL reject the input and return a validation error indicating the maximum allowed length
6. IF the Prompt_Engine cannot determine whether a prompt is requesting a diagram or a document, THEN THE Prompt_Engine SHALL prompt the user to clarify whether they want a diagram or a document

### Requirement 2: Diagram-as-Code Generation

**User Story:** As a user, I want to generate editable diagram code from my descriptions, so that I can create visual diagrams without manually writing DSL syntax.

#### Acceptance Criteria

1. WHEN a diagram generation request is received, THE Diagram_Generator SHALL produce syntactically parseable Diagram_Code in the specified output format within 30 seconds
2. THE Diagram_Generator SHALL support the following diagram types: flowcharts, entity relationship diagrams, cloud architecture diagrams, sequence diagrams, BPMN diagrams, UML class diagrams, network diagrams, state diagrams, and data flow diagrams
3. WHEN no diagram type is specified in the prompt, THE Diagram_Generator SHALL infer the diagram type from the prompt content and include the selected diagram type in the response
4. THE Diagram_Generator SHALL produce Diagram_Code that conforms to the syntax rules of the selected DSL and contains at least one node or entity derived from the prompt content
5. IF the Diagram_Generator cannot produce a valid diagram from the given prompt, THEN THE Diagram_Generator SHALL return an error message indicating the reason for failure within 30 seconds
6. IF diagram generation exceeds 30 seconds, THEN THE Diagram_Generator SHALL abort the operation and return a timeout error to the user

### Requirement 3: Diagram Code Output Formats

**User Story:** As a user, I want diagram output in standard DSL formats, so that I can use the output with existing rendering tools and version control.

#### Acceptance Criteria

1. IF no output format is specified in the prompt, THEN THE Diagram_Generator SHALL generate Diagram_Code in Mermaid syntax as the default format
2. WHERE PlantUML output is configured, THE Diagram_Generator SHALL produce valid PlantUML syntax
3. WHEN a user specifies an output format in the prompt, THE Diagram_Generator SHALL generate Diagram_Code in that format, where supported formats are: Mermaid and PlantUML
4. IF an unsupported output format is requested, THEN THE Diagram_Generator SHALL return an error message listing the supported formats (Mermaid, PlantUML)
5. THE Diagram_Generator SHALL produce Diagram_Code output as plain text that is compatible with standard text-based version control systems

### Requirement 4: Diagram Visual Rendering

**User Story:** As a user, I want to see a visual preview of my generated diagram, so that I can verify the diagram matches my intent before exporting.

#### Acceptance Criteria

1. WHEN Diagram_Code is generated, THE Diagram_Renderer SHALL render a visual preview displaying all diagram elements (nodes, edges, and labels) defined in the code within 3 seconds of generation completing
2. WHEN Diagram_Code is edited by the user, THE Diagram_Renderer SHALL update the visual preview within 2 seconds of the edit
3. IF the Diagram_Code contains syntax errors, THEN THE Diagram_Renderer SHALL display an error indicator identifying the line number of the first syntax error and SHALL render all valid elements preceding the error
4. THE Diagram_Renderer SHALL provide zoom and pan controls allowing the user to inspect any element's label text at readable size

### Requirement 5: Iterative Diagram Refinement

**User Story:** As a user, I want to refine my diagram through follow-up prompts, so that I can incrementally improve the output without starting over.

#### Acceptance Criteria

1. WHEN a follow-up prompt is submitted within an existing Session, THE Diagram_Generator SHALL produce an updated version of the existing Diagram_Code that incorporates the new instructions while preserving unchanged elements, and the updated Diagram_Code SHALL conform to the syntax rules of the selected DSL
2. WHILE a Session is active, THE Prompt_Engine SHALL maintain the conversation history including all prior prompts and their corresponding generated outputs for context
3. WHEN a user requests to undo the last change, THE Session SHALL restore the previous version of the Diagram_Code and remove the undone exchange from the conversation history
4. IF a user requests to undo when no previous version exists, THEN THE Session SHALL return an error message indicating that no prior version is available to restore
5. THE Session SHALL retain up to 50 prompt-response exchanges per session
6. IF a follow-up prompt is submitted and the Session has reached 50 prompt-response exchanges, THEN THE Prompt_Engine SHALL reject the request and return an error message indicating the session exchange limit has been reached

### Requirement 6: Document Generation

**User Story:** As a user, I want to generate structured technical documents from prompts, so that I can quickly create design docs, SOPs, and documentation outlines.

#### Acceptance Criteria

1. WHEN a document generation request is received, THE Document_Generator SHALL produce a Markdown document containing a title heading, at least 2 section headings, and descriptive content of at least one sentence under each section heading
2. THE Document_Generator SHALL support the following document types: design documents, documentation outlines, standard operating procedures, API documentation, and technical specifications
3. WHEN no document type is specified, THE Document_Generator SHALL infer the document type from the prompt content and indicate the selected document type in the response
4. THE Document_Generator SHALL produce valid Markdown conforming to the CommonMark specification
5. IF the Document_Generator cannot produce a document from the given prompt because the prompt lacks sufficient subject matter or context, THEN THE Document_Generator SHALL return an error message indicating the reason generation failed and suggesting how the user can improve the prompt
6. WHEN a document generation request is received, THE Document_Generator SHALL produce the complete document within 30 seconds

### Requirement 7: Markdown Editor

**User Story:** As a user, I want to view and edit generated documents in a Markdown editor, so that I can refine the output manually.

#### Acceptance Criteria

1. WHEN a document is generated, THE Document_Generator SHALL display the output in an editable Markdown editor that supports documents up to 100,000 characters in length
2. THE Markdown editor SHALL provide a split view with raw Markdown on one side and rendered preview on the other
3. WHEN the user edits the Markdown content, THE Markdown editor SHALL update the rendered preview within 1 second
4. THE Markdown editor SHALL support CommonMark Markdown syntax including headings (levels 1–6), ordered and unordered lists (up to 6 levels of nesting), tables, fenced code blocks, and inline links
5. WHEN the user triggers a save action, THE Markdown editor SHALL persist the current editor content and display a confirmation indicating the save succeeded
6. IF the Markdown content cannot be rendered in the preview, THEN THE Markdown editor SHALL display the raw text in the preview pane along with an indication that rendering failed
7. IF the document exceeds 100,000 characters, THEN THE Markdown editor SHALL display a notification indicating the content exceeds the supported limit and prevent further input

### Requirement 8: Iterative Document Refinement

**User Story:** As a user, I want to refine generated documents with follow-up prompts, so that I can iteratively improve content without manual rewriting.

#### Acceptance Criteria

1. WHEN a follow-up prompt is submitted for an existing document, THE Document_Generator SHALL produce an updated version of the document that incorporates the new instructions and return the complete modified document to the user
2. WHILE a Session is active, THE Prompt_Engine SHALL include all prior prompt-response exchanges from the current document session as context when processing each new follow-up prompt
3. WHEN a user requests to undo the last change, THE Session SHALL restore the document to the version immediately prior to the most recent modification, supporting sequential undo up to the original generated version
4. IF a user requests to undo when no previous version exists, THEN THE Session SHALL indicate that no earlier version is available and retain the current document unchanged
5. THE Session SHALL retain up to 50 prompt-response exchanges per document session
6. IF a follow-up prompt would exceed the 50 prompt-response exchange limit, THEN THE Session SHALL reject the prompt and display a message indicating the session exchange limit has been reached

### Requirement 9: Template Support

**User Story:** As a user, I want to use templates for consistent output formatting, so that my diagrams and documents follow organizational standards.

#### Acceptance Criteria

1. THE Template_Manager SHALL provide at least one built-in template for each supported diagram type and document type
2. WHEN a user selects a template, THE Prompt_Engine SHALL generate output that conforms to the template's defined section headings, layout ordering, and formatting rules
3. WHEN a user creates a custom template, THE Template_Manager SHALL validate the template structure and persist the template for future use, up to a maximum of 100 custom templates
4. THE Template_Manager SHALL allow users to list, edit, and delete custom templates, and SHALL NOT allow modification or deletion of built-in templates
5. IF a selected template is incompatible with the requested output type, THEN THE Template_Manager SHALL return an error indicating the template type and the requested output type that conflict
6. IF a user submits a custom template that contains invalid structure or is empty, THEN THE Template_Manager SHALL return a validation error indicating the reason the template was rejected

### Requirement 10: File Attachment Context

**User Story:** As a user, I want to attach files to provide additional context for generation, so that the AI can produce more accurate outputs based on existing materials.

#### Acceptance Criteria

1. WHEN a user attaches a text-based file with a prompt, THE Attachment_Processor SHALL extract the text content from the file and include it as generation context
2. WHEN a user attaches an image file (PNG or JPEG) with a prompt, THE Attachment_Processor SHALL pass the image to the AI model as visual context for generation
3. THE Attachment_Processor SHALL support the following file types: PNG, JPEG, PDF, plain text (.txt), Markdown (.md), and source code files (.py, .js, .ts, .java, .c, .cpp, .go, .rb, .rs, .html, .css, .json, .yaml, .yml, .xml, .sh)
4. THE Attachment_Processor SHALL support file attachments up to 10 MB in size and reject files that exceed this limit with an error indicating the maximum allowed size
5. THE Attachment_Processor SHALL support up to 5 file attachments per prompt
6. IF an unsupported file type is attached, THEN THE Attachment_Processor SHALL reject the attachment and return an error listing the supported file types
7. IF a file cannot be processed due to corruption, encoding issues, or password protection, THEN THE Attachment_Processor SHALL return an error indicating the specific reason the file could not be processed
8. IF an attached file is empty (0 bytes), THEN THE Attachment_Processor SHALL return an error indicating that the file contains no content

### Requirement 11: Diagram Code Editability

**User Story:** As a user, I want to directly edit generated diagram code, so that I can make fine-grained adjustments that are difficult to express in natural language.

#### Acceptance Criteria

1. WHEN Diagram_Code is generated, THE Diagram_Generator SHALL display the code in an editable text editor with syntax highlighting corresponding to the selected DSL format
2. WHEN the user modifies the Diagram_Code manually and no further keystrokes occur within 1 second, THE Diagram_Renderer SHALL re-render the visual preview based on the updated code within 2 seconds
3. IF manually edited Diagram_Code contains syntax errors, THEN THE text editor SHALL highlight the errors at their corresponding line and column positions and THE Diagram_Renderer SHALL retain the last successfully rendered preview
4. IF manually edited Diagram_Code is syntactically valid but produces a rendering error, THEN THE Diagram_Renderer SHALL display an error message indicating the rendering failure and retain the last successfully rendered preview
5. THE text editor SHALL support undo and redo of manual edits, restoring both the code content and the corresponding rendered preview state

### Requirement 12: API Integration

**User Story:** As a developer, I want an API to access diagram and document generation programmatically, so that I can integrate the tool into automated workflows.

#### Acceptance Criteria

1. THE Prompt_Engine SHALL expose a REST API for submitting generation requests
2. WHEN a generation request is submitted via the API, THE Prompt_Engine SHALL return a JSON response containing the generated output content, the output type (diagram or document), and the diagram DSL format or document type used within 60 seconds of request submission
3. THE API SHALL support specifying diagram type, output format, and template selection as request parameters
4. THE API SHALL return HTTP status codes: 200 for success, 400 for invalid input, 404 for a session identifier that does not correspond to an existing Session, and 500 for internal errors
5. WHEN a session identifier is included in an API request, THE Prompt_Engine SHALL use the existing Session context for iterative refinement
6. IF a generation request submitted via the API does not complete within 60 seconds, THEN THE Prompt_Engine SHALL return a timeout error response indicating the request exceeded the allowed processing duration
7. IF a session identifier included in an API request does not correspond to an existing or active Session, THEN THE Prompt_Engine SHALL return an error response indicating the session is invalid or expired
