# Requirements Document

## Introduction

This feature enhances the existing AI Diagram & Document Generator with four improvements: (1) a purposeful AI provider split where Groq handles all text generation and Gemini handles image/vision tasks, (2) cloud icon rendering using Mermaid architecture-beta syntax with iconify icon packs, (3) a preview-first UI layout that shows the rendered diagram as the hero element with a collapsed code editor, and (4) a bug fix ensuring the diagram preview panel displays immediately when a diagram is generated rather than showing the document editor.

## Glossary

- **AI_Client**: The infrastructure module (`src/infrastructure/ai-client.ts`) that manages communication with AI providers (Groq and Gemini).
- **Groq_Provider**: The Groq API service used for text generation tasks including diagram code generation, document generation, and prompt classification.
- **Gemini_Provider**: The Google Gemini API service used exclusively for image and vision analysis tasks such as interpreting attached images.
- **Diagram_Renderer**: The client-side module responsible for rendering Mermaid and PlantUML code into visual SVG output.
- **Preview_Panel**: The UI section (`diagram-preview-section`) that displays the rendered visual diagram.
- **Code_Editor**: The UI section (`code-editor-section`) that displays and allows editing of raw diagram code.
- **Architecture_Beta**: Mermaid's `architecture-beta` diagram syntax supporting iconify icon packs for cloud service icons.
- **Iconify_Icons**: Icon identifiers from iconify icon packs (e.g., `aws:ec2`, `azure:vm`, `gcp:compute-engine`, `logos:kubernetes`) used within architecture-beta diagrams.
- **Cloud_Diagram**: A diagram of type `cloud-architecture` that represents cloud infrastructure using service-specific icons.
- **Display_Mode**: The UI state determining which panel (Preview_Panel, Code_Editor, or Markdown_Editor) is shown to the user based on the generated output type.

## Requirements

### Requirement 1: Purposeful AI Provider Split

**User Story:** As a developer, I want Groq to handle text generation and Gemini to handle image analysis, so that each provider is used for what it does best rather than as a fallback chain.

#### Acceptance Criteria

1. WHEN a text generation task is requested (diagram code, document content, or prompt classification), THE AI_Client SHALL route the request to the Groq_Provider.
2. WHEN an image or vision analysis task is requested (interpreting an attached image file), THE AI_Client SHALL route the request to the Gemini_Provider.
3. IF the Groq_Provider fails with a transient error during a text generation task, THEN THE AI_Client SHALL retry the request once with the Groq_Provider before reporting failure.
4. IF the Gemini_Provider fails with a transient error during a vision analysis task, THEN THE AI_Client SHALL retry the request once with the Gemini_Provider before reporting failure.
5. THE AI_Client SHALL NOT use Gemini_Provider as a fallback for text generation tasks.
6. THE AI_Client SHALL NOT use Groq_Provider for image or vision analysis tasks.
7. IF the designated provider for a task fails after retry, THEN THE AI_Client SHALL return an error indicating the specific provider and task type that failed.

### Requirement 2: Cloud Icon Rendering with Architecture-Beta Syntax

**User Story:** As a user, I want cloud architecture diagrams to display recognizable service icons (AWS, Azure, GCP, Kubernetes), so that the visual output clearly communicates which cloud services are involved.

#### Acceptance Criteria

1. WHEN the user requests a cloud-architecture diagram, THE Diagram_Renderer SHALL support rendering Mermaid architecture-beta syntax that includes iconify icon references.
2. WHEN generating a Cloud_Diagram, THE Groq_Provider SHALL produce Mermaid architecture-beta code that uses iconify icon identifiers for recognized cloud services (AWS, Azure, GCP, Kubernetes).
3. THE Diagram_Renderer SHALL register iconify icon packs (aws, azure, gcp, logos) with the Mermaid instance before rendering architecture-beta diagrams.
4. IF the user prompt mentions specific cloud services (e.g., EC2, S3, Lambda, Azure Functions, GKE), THEN THE Groq_Provider SHALL map those services to their corresponding iconify icon identifiers in the generated architecture-beta code.
5. IF an iconify icon identifier referenced in the diagram code is unavailable or fails to load, THEN THE Diagram_Renderer SHALL render the diagram with a placeholder shape instead of the icon and display the node label.
6. THE Diagram_Renderer SHALL validate that architecture-beta code contains the `architecture-beta` keyword on its first line before attempting icon-aware rendering.

### Requirement 3: Preview-First UI Layout

**User Story:** As a user, I want to see the rendered diagram prominently when it is generated, so that I can immediately evaluate the visual output without needing to expand panels manually.

#### Acceptance Criteria

1. WHEN a diagram is generated successfully, THE Preview_Panel SHALL be displayed as the primary hero element occupying the full width of the results area.
2. WHEN a diagram is generated successfully, THE Code_Editor SHALL be in a collapsed state by default, showing only a header bar with an expand toggle.
3. WHEN the user clicks the expand toggle on the collapsed Code_Editor, THE Code_Editor SHALL expand to reveal the full editable code view.
4. WHEN the user collapses the Code_Editor, THE Preview_Panel SHALL remain visible and continue occupying the primary display area.
5. WHILE the Code_Editor is expanded, THE Preview_Panel SHALL remain visible above or alongside the Code_Editor so the user can see both simultaneously.
6. THE Preview_Panel SHALL occupy a minimum height of 400 pixels when displayed as the hero element.

### Requirement 4: Fix Diagram Preview Display Bug

**User Story:** As a user, I want the diagram preview to appear immediately when a diagram is generated, so that I see the visual output instead of the document editor.

#### Acceptance Criteria

1. WHEN a diagram generation response is received with `outputType` equal to `diagram`, THE Display_Mode SHALL activate the Preview_Panel and Code_Editor sections.
2. WHEN a diagram generation response is received with `outputType` equal to `diagram`, THE Display_Mode SHALL hide the Markdown_Editor section.
3. WHEN a document generation response is received with `outputType` equal to `document`, THE Display_Mode SHALL activate the Markdown_Editor section and hide the Preview_Panel and Code_Editor.
4. THE Display_Mode SHALL evaluate the `outputType` field of the generation response before deciding which panels to show.
5. IF the Preview_Panel is activated, THEN THE Diagram_Renderer SHALL initiate rendering of the diagram code within 100 milliseconds of the panel becoming visible.
6. WHEN the Display_Mode switches from document to diagram output, THE Display_Mode SHALL fully hide the Markdown_Editor before showing the Preview_Panel.
