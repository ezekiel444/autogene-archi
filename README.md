# AI Diagram & Document Generator

A local AI-powered tool that generates diagrams-as-code and structured technical documents from natural language prompts. Inspired by [Eraser.io](https://www.eraser.io/), this tool runs entirely on your machine using cloud AI APIs (Groq + Gemini) for intelligent generation with privacy-first design.

![Node.js](https://img.shields.io/badge/Node.js-22+-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **AI Diagram Generation** — Describe a diagram in plain English, get rendered Mermaid or PlantUML code with live visual preview
- **AI Document Generation** — Generate structured technical documents (design docs, API docs, SOPs, specs) with split-pane Markdown editor
- **Cloud Architecture Icons** — AWS, Azure, GCP, and Kubernetes icons rendered directly in diagrams via Mermaid's architecture-beta syntax
- **Iterative Refinement** — Follow-up prompts to modify diagrams/documents without starting over
- **File Attachments** — Attach code, images, or PDFs for AI-informed generation
- **Template System** — Built-in templates for consistent formatting, plus custom template support
- **Live Rendering** — Mermaid diagrams render in-browser with zoom/pan controls
- **Dual AI Strategy** — Groq for fast text generation, Gemini for image/vision analysis

## Quick Start

### Prerequisites

- Node.js 22+ 
- pnpm (`npm install -g pnpm`)
- API keys for [Groq](https://console.groq.com/keys) and [Google AI (Gemini)](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd autogene-archi

# Install dependencies
pnpm install

# Create your secrets file
cp secrets.env.example secrets.env
# Edit secrets.env and add your API keys
```

Your `secrets.env` should contain:
```env
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run

```bash
# Production: build once, then serve everything from port 3000
pnpm build
pnpm start
# → open http://localhost:3000

# Development: run backend and frontend in separate terminals
pnpm dev            # terminal 1 — backend on :3000 (hot reload)
pnpm dev:frontend   # terminal 2 — frontend on :5173 (proxies /api to :3000)
# → open http://localhost:5173
```

> Opening `http://localhost:3000` directly during development will fail to load
> the UI unless you have run `pnpm build:frontend` at least once. The backend
> serves the built UI from `public/`, which is git-ignored.

### Run Tests

```bash
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:property     # Property-based tests
```

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   Web Browser                        │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Prompt    │  │ Diagram      │  │ Markdown    │  │
│  │ Input     │  │ Preview      │  │ Editor      │  │
│  └───────────┘  └──────────────┘  └─────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │ REST API
┌────────────────────────┼────────────────────────────┐
│                   Express Server                     │
│  ┌─────────────────────┼─────────────────────────┐  │
│  │            Prompt Engine                       │  │
│  │  validate → classify → route → generate       │  │
│  └───────────────┬───────────────┬───────────────┘  │
│          ┌───────┴───┐   ┌───────┴───────┐          │
│          │  Diagram  │   │   Document    │          │
│          │ Generator │   │  Generator    │          │
│          └─────┬─────┘   └───────┬───────┘          │
│                │                  │                   │
│  ┌─────────────┴──────────────────┴──────────────┐  │
│  │              AI Client                         │  │
│  │  generateText (Groq)  │  analyzeImage (Gemini)│  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Diagram Types

The tool supports **9 diagram types**. Here's when to use each:

| Diagram Type | Best For | Example Prompt |
|---|---|---|
| **Flowchart** | Processes, workflows, decision trees | "Create a flowchart for user registration with email verification" |
| **Cloud Architecture** | AWS/Azure/GCP infrastructure with service icons | "Design an AWS architecture with API Gateway, Lambda, DynamoDB, and S3" |
| **Sequence** | API calls, message flows between systems | "Show the OAuth2 authorization code flow between client, auth server, and API" |
| **ER Diagram** | Database schemas, entity relationships | "Create an ER diagram for an e-commerce system with users, orders, and products" |
| **Class Diagram** | OOP design, code structure | "Design class hierarchy for a notification system with email, SMS, and push" |
| **Network** | Network topology, infrastructure layout | "Map out a corporate network with DMZ, internal zones, and VPN access" |
| **State Diagram** | State machines, lifecycle management | "Show order states: pending, confirmed, shipped, delivered, cancelled" |
| **Data Flow** | Data pipelines, ETL processes | "Design a real-time analytics pipeline from Kafka to data warehouse" |
| **BPMN** | Business processes, cross-team workflows | "Model the employee onboarding process across HR, IT, and management" |

### Which diagram type should I use?

- **Building cloud infrastructure?** → Use **Cloud Architecture** (gets you AWS/Azure/GCP icons)
- **Showing how systems talk to each other?** → Use **Sequence** diagram
- **Modeling a database?** → Use **ER Diagram**
- **Describing a process/workflow?** → Use **Flowchart** or **BPMN** (BPMN for cross-team processes)
- **Designing code structure?** → Use **Class Diagram**
- **Not sure?** → Leave it on **Auto-detect** and the AI will pick the best type

## Templates

Templates provide consistent structure and formatting rules. They guide the AI to produce output following specific patterns.

### Diagram Templates (9 built-in)

| Template | What It Enforces |
|---|---|
| Default Flowchart | Top-down flow, decision diamonds, start/end terminals, subgraph grouping |
| Default Cloud Architecture | Layer separation, service icons, network boundaries, data flow arrows |
| Default Sequence | Participant declarations, message labels, activation bars |
| Default ER Diagram | PascalCase entities, PK notation, cardinality, attribute types |
| Default Class Diagram | Visibility modifiers, type annotations, relationship types |
| Default Network | Network segments, device identification, security zones |
| Default State Diagram | Initial/final states, transition labels, guard conditions |
| Default Data Flow | External entities, process numbering, data store notation |
| Default BPMN | Start/end events, gateway notation, swim lanes |

### Document Templates (5 built-in)

| Template | Sections Included |
|---|---|
| Default Design Document | Overview, Goals, Architecture, Data Model, API Design, Security, Trade-offs, Open Questions |
| Default Documentation Outline | Introduction, Getting Started, Installation, Usage, Examples, API Reference, Troubleshooting, FAQ |
| Default SOP | Purpose, Scope, Responsibilities, Prerequisites, Procedure, Verification, Exception Handling |
| Default API Documentation | Overview, Authentication, Base URL, Endpoints, Request/Response, Error Codes, Rate Limiting |
| Default Technical Specification | Summary, Requirements, Architecture, Data Specs, Interfaces, Performance, Testing, Deployment |

### When to use templates vs free-form

- **Use a template** when you want consistent structure (team standards, repeatable formats)
- **Use free-form (None)** when you want the AI to decide the best structure for your prompt
- Templates don't restrict content — they guide the AI's output structure

### Custom Templates

Create your own templates via the API:

```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Doc Template",
    "type": "document",
    "subType": "api-documentation",
    "structure": {
      "sections": [
        { "heading": "Service Overview", "level": 2, "required": true },
        { "heading": "Authentication", "level": 2, "required": true },
        { "heading": "Endpoints", "level": 2, "required": true }
      ],
      "formattingRules": [
        { "rule": "use-tables", "description": "Use tables for endpoint parameters" }
      ]
    }
  }'
```

## Output Formats

| Format | Best For | Rendering |
|---|---|---|
| **Mermaid** (default) | Most diagrams, renders in-browser | Live preview with zoom/pan |
| **PlantUML** | Complex UML, sequence diagrams with detailed notation | Server-side via PlantUML public server |

## API Reference

### Generate Content
```
POST /api/generate
```

Request body:
```json
{
  "prompt": "Create a flowchart for user login",
  "diagramType": "flowchart",
  "outputFormat": "mermaid",
  "templateId": "flowchart-default",
  "sessionId": "optional-session-id",
  "attachments": [
    {
      "filename": "schema.ts",
      "mimeType": "text/typescript",
      "contentBase64": "base64-encoded-content"
    }
  ]
}
```

### Session Management
```
GET  /api/sessions/:sessionId     # Get session history
POST /api/sessions/:sessionId/undo  # Undo last change
```

### Template Management
```
GET    /api/templates              # List all templates
POST   /api/templates              # Create custom template
PUT    /api/templates/:id          # Update custom template
DELETE /api/templates/:id          # Delete custom template
```

### DSL Validation
```
POST /api/validate
```
```json
{
  "code": "graph TD\n  A --> B",
  "format": "mermaid"
}
```

## Project Structure

```
├── src/
│   ├── api/                    # Express routes and middleware
│   │   ├── routes.ts           # REST API endpoints
│   │   └── error-handler.ts    # Error mapping and response formatting
│   ├── application/            # Business logic orchestration
│   │   ├── prompt-engine.ts    # Input validation, classification, orchestration
│   │   ├── session-manager.ts  # Session persistence and history
│   │   └── template-manager.ts # Template CRUD and validation
│   ├── domain/                 # Core generation logic
│   │   ├── diagram-generator.ts    # AI-powered diagram code generation
│   │   ├── document-generator.ts   # AI-powered document generation
│   │   ├── attachment-processor.ts # File validation and content extraction
│   │   └── dsl-validator.ts        # Mermaid/PlantUML syntax validation
│   ├── infrastructure/         # External service integrations
│   │   ├── ai-client.ts       # Groq (text) + Gemini (vision) AI client
│   │   └── diagram-renderer.ts # Server-side rendering support
│   ├── types/                  # TypeScript type definitions
│   │   ├── index.ts           # All shared types and constants
│   │   └── errors.ts          # Error codes enum
│   ├── env.ts                 # Environment configuration
│   └── index.ts               # Application entry point
├── public/                     # Frontend (vanilla HTML/CSS/JS)
│   ├── index.html             # Main page
│   ├── styles.css             # Styling
│   └── app.js                 # Client-side logic
├── data/
│   └── templates/built-in/    # Built-in template JSON files
├── tests/
│   ├── unit/                  # Unit tests (308 tests)
│   └── property/              # Property-based tests
├── secrets.env                # API keys (git-ignored)
├── package.json
├── tsconfig.json
└── README.md
```

## AI Provider Strategy

| Provider | Used For | Why |
|---|---|---|
| **Groq** (LLama 3.3 70B) | Text generation: diagram code, documents, prompt classification | Extremely fast inference (~200ms), great for structured output, cheap |
| **Gemini** (2.0 Flash) | Image analysis: interpreting attached screenshots/diagrams | Multimodal vision capabilities, understands images natively |

This split means:
- Fast diagram generation (Groq's speed)
- Rich image understanding when you attach reference screenshots (Gemini's vision)
- No wasted API calls (each provider only does what it's best at)

## Tips for Better Results

1. **Be specific** — "Create a flowchart for user login with email verification, password reset, and 2FA" beats "make a login diagram"
2. **Mention the cloud provider** — "AWS Lambda + DynamoDB" gets you proper icons vs just "serverless function + database"
3. **Use templates** for consistent team output
4. **Iterate** — Generate first, then refine with follow-up prompts ("add error handling", "make the database section more detailed")
5. **Attach context** — Drop in a code file or existing diagram image for the AI to reference

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for text generation |
| `GEMINI_API_KEY` | Yes | Google AI API key for vision analysis |
| `PORT` | No | Server port (default: 3000) |

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript 5.8
- **Server**: Express 5
- **AI**: Groq SDK + Google GenAI SDK
- **Rendering**: Mermaid.js 11 (client-side), PlantUML (server via public API)
- **Icons**: Iconify (AWS, Azure, GCP, Logos packs)
- **Testing**: Vitest + fast-check (property-based testing)
- **Package Manager**: pnpm

## License

MIT
