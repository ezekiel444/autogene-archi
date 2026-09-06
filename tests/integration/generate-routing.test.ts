/**
 * Integration test for /api/generate output-type routing.
 *
 * Focus: a cloud-architecture prompt must come back as `outputType: 'diagram'`
 * with parseable node/connection JSON, so the frontend renders it on the canvas
 * instead of dumping raw JSON into the document editor.
 *
 * The AI-backed modules are mocked so the test is deterministic and needs no
 * API keys or network access.
 */
import express, { type Express } from 'express';
import request from 'supertest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/application/prompt-engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/application/prompt-engine.js')>();
  return {
    ...actual,
    // validateInput is pure — keep the real implementation.
    classifyPrompt: vi.fn(),
  };
});

vi.mock('@/domain/diagram-generator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/diagram-generator.js')>();
  return {
    ...actual, // keep the real isDiagramGraphContent
    generate: vi.fn(),
    refine: vi.fn(),
  };
});

vi.mock('@/domain/document-generator.js', () => ({
  generate: vi.fn(),
  refine: vi.fn(),
}));

// Avoid touching the filesystem for sessions.
vi.mock('@/application/session-manager.js', () => {
  return {
    SessionManager: class {
      async createSession(type: string) {
        return { id: 'test-session-id', type };
      }
      async getSession() {
        return { success: true, data: { exchanges: [] } };
      }
      async addExchange() {
        return { success: true };
      }
    },
  };
});

import { classifyPrompt } from '@/application/prompt-engine.js';
import { generate as generateDiagram } from '@/domain/diagram-generator.js';
import { generate as generateDocument } from '@/domain/document-generator.js';
import router from '@/api/routes.js';

const mockClassify = vi.mocked(classifyPrompt);
const mockGenerateDiagram = vi.mocked(generateDiagram);
const mockGenerateDocument = vi.mocked(generateDocument);

// A realistic cloud-architecture node/connection graph.
const ARCHITECTURE_JSON = JSON.stringify({
  nodes: [
    { id: 'user', label: 'User', icon: 'user', group: 'ingress', x: 100, y: 100 },
    { id: 'lb', label: 'Load Balancer', icon: 'load-balancer', group: 'ingress', x: 200, y: 100 },
    { id: 'app', label: 'App Server', icon: 'server', group: 'compute', x: 400, y: 100 },
    { id: 'db', label: 'Database', icon: 'database', group: 'data', x: 600, y: 100 },
  ],
  connections: [
    { from: 'user', to: 'lb', label: 'HTTPS' },
    { from: 'lb', to: 'app', label: 'HTTP' },
    { from: 'app', to: 'db', label: 'SQL' },
  ],
});

function makeApp(): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(router);
  return app;
}

describe('POST /api/generate — architecture routing', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
  });

  it('returns outputType "diagram" with parseable JSON when diagramType is explicit', async () => {
    mockGenerateDiagram.mockResolvedValue({
      code: ARCHITECTURE_JSON,
      format: 'node-graph',
      diagramType: 'cloud-architecture',
      isValid: true,
      validationErrors: undefined,
    });

    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'Design a production cloud architecture', diagramType: 'cloud-architecture' });

    expect(res.status).toBe(200);
    expect(res.body.outputType).toBe('diagram');
    expect(res.body.diagramType).toBe('cloud-architecture');
    expect(res.body.format).toBe('node-graph');
    // Frontend gate: content must JSON.parse into a node/connection graph.
    const parsed = JSON.parse(res.body.content);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(parsed.connections)).toBe(true);
    expect(mockClassify).not.toHaveBeenCalled();
  });

  it('routes an ambiguous-but-inferred architecture prompt to a diagram', async () => {
    mockClassify.mockResolvedValue({
      type: 'ambiguous',
      confidence: 0.5,
      inferredDiagramType: 'cloud-architecture',
      inferredDocumentType: undefined,
    });
    mockGenerateDiagram.mockResolvedValue({
      code: ARCHITECTURE_JSON,
      format: 'node-graph',
      diagramType: 'cloud-architecture',
      isValid: true,
      validationErrors: undefined,
    });

    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'the backend platform' });

    expect(res.status).toBe(200);
    expect(res.body.outputType).toBe('diagram');
    expect(res.body.diagramType).toBe('cloud-architecture');
    expect(mockGenerateDiagram).toHaveBeenCalled();
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it('reclassifies as a diagram when a document-routed prompt yields graph JSON (safety net)', async () => {
    // Classifier says document, but the produced content is actually a graph.
    mockClassify.mockResolvedValue({
      type: 'document',
      confidence: 0.9,
      inferredDiagramType: undefined,
      inferredDocumentType: 'design-document',
    });
    mockGenerateDocument.mockResolvedValue({
      content: ARCHITECTURE_JSON,
      documentType: 'design-document',
    } as never);

    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'describe the system' });

    expect(res.status).toBe(200);
    expect(res.body.outputType).toBe('diagram');
    const parsed = JSON.parse(res.body.content);
    expect(parsed.nodes.length).toBeGreaterThan(0);
  });

  it('still returns a document for genuine prose content', async () => {
    mockClassify.mockResolvedValue({
      type: 'document',
      confidence: 0.95,
      inferredDiagramType: undefined,
      inferredDocumentType: 'design-document',
    });
    mockGenerateDocument.mockResolvedValue({
      content: '# Design Document\n\nThis is a prose document, not a diagram.',
      documentType: 'design-document',
    } as never);

    const res = await request(app)
      .post('/api/generate')
      .send({ prompt: 'write a design document' });

    expect(res.status).toBe(200);
    expect(res.body.outputType).toBe('document');
    expect(res.body.documentType).toBe('design-document');
  });
});
