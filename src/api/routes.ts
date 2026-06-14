/**
 * REST API routes for the AI Diagram & Document Generator.
 * Defines Express router with endpoints for generation, sessions, and templates.
 */

import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { validateInput, classifyPrompt } from '../application/prompt-engine.js';
import { SessionManager } from '../application/session-manager.js';
import { TemplateManager } from '../application/template-manager.js';
import { generate as generateDiagram, refine as refineDiagram } from '../domain/diagram-generator.js';
import { generate as generateDocument, refine as refineDocument } from '../domain/document-generator.js';
import { validateAll as validateAttachments, process as processAttachment } from '../domain/attachment-processor.js';
import type {
  APIGenerateRequest,
  APIAttachment,
  Attachment,
  GenerationRequest,
  GenerationResponse,
  GenerationContext,
  AttachmentContext,
  TemplateFilter,
  ErrorResponse,
} from '../types/index.js';
import { ErrorCode } from '../types/index.js';

// ─── Module-level instances (MVP defaults) ───────────────────────────────────

const sessionManager = new SessionManager('./data/sessions');
const templateManager = new TemplateManager('./data/templates');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a structured error response.
 */
function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  return {
    error: { code, message, details },
    timestamp: new Date().toISOString(),
    requestId: uuidv4(),
  };
}

/**
 * Decodes base64 API attachments into internal Attachment objects.
 */
function decodeAttachments(apiAttachments: APIAttachment[]): Attachment[] {
  return apiAttachments.map((a) => {
    const content = Buffer.from(a.contentBase64, 'base64');
    return {
      filename: a.filename,
      mimeType: a.mimeType,
      size: content.length,
      content,
    };
  });
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// ─── POST /api/generate ──────────────────────────────────────────────────────

router.post('/api/generate', async (req: Request, res: Response) => {
  const body = req.body as APIGenerateRequest;

  // 1. Build GenerationRequest from API body
  const generationRequest: GenerationRequest = {
    prompt: body.prompt,
    sessionId: body.sessionId,
    diagramType: body.diagramType,
    outputFormat: body.outputFormat,
    templateId: body.templateId,
  };

  // 2. Validate input
  const validation = validateInput(generationRequest);
  if (!validation.isValid) {
    res.status(400).json(
      createErrorResponse(
        validation.errors[0].code as ErrorCode,
        validation.errors[0].message,
        validation.errors[0].details,
      ),
    );
    return;
  }

  // 3. Decode and validate attachments if present
  let attachments: Attachment[] = [];
  let attachmentContexts: AttachmentContext[] = [];

  if (body.attachments && body.attachments.length > 0) {
    attachments = decodeAttachments(body.attachments);
    const attachmentValidation = validateAttachments(attachments);
    if (!attachmentValidation.isValid) {
      res.status(400).json(
        createErrorResponse(
          attachmentValidation.errors[0].code as ErrorCode,
          attachmentValidation.errors[0].message,
          attachmentValidation.errors[0].details,
        ),
      );
      return;
    }

    // Process attachments to extract context
    try {
      attachmentContexts = await Promise.all(
        attachments.map((a) => processAttachment(a)),
      );
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      res.status(400).json(
        createErrorResponse(
          (err.code as ErrorCode) ?? ErrorCode.INTERNAL_ERROR,
          err.message ?? 'Attachment processing failed',
        ),
      );
      return;
    }
  }

  // 4. Get/create session if sessionId provided
  let sessionId = body.sessionId;
  let sessionHistory: GenerationContext['sessionHistory'] = undefined;

  if (sessionId) {
    const sessionResult = await sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      res.status(404).json(
        createErrorResponse(
          ErrorCode.SESSION_NOT_FOUND,
          `Session '${sessionId}' not found`,
        ),
      );
      return;
    }
    sessionHistory = sessionResult.data!.exchanges;
  }

  // 5. Resolve template if templateId provided
  let template: GenerationContext['template'] = undefined;
  if (body.templateId) {
    const foundTemplate = await templateManager.getTemplate(body.templateId);
    if (!foundTemplate) {
      res.status(404).json(
        createErrorResponse(
          ErrorCode.TEMPLATE_NOT_FOUND,
          `Template '${body.templateId}' not found`,
        ),
      );
      return;
    }
    template = foundTemplate;
  }

  // 6. Determine output type
  let outputType: 'diagram' | 'document';

  if (body.diagramType) {
    outputType = 'diagram';
  } else if ((req.body as any).mode === 'diagram') {
    // User explicitly chose diagram mode — always produce a diagram
    outputType = 'diagram';
    // Try to infer the best diagram type from the prompt
    if (!generationRequest.diagramType) {
      try {
        const classification = await classifyPrompt(body.prompt);
        if (classification.inferredDiagramType) {
          generationRequest.diagramType = classification.inferredDiagramType;
        }
      } catch {
        // If classification fails, let the generator infer
      }
    }
  } else if ((req.body as any).mode === 'document') {
    outputType = 'document';
  } else {
    // No mode specified (API call) — classify via AI
    const classification = await classifyPrompt(body.prompt);
    if (classification.type === 'diagram') {
      outputType = 'diagram';
      // Use inferred diagram type if no explicit type was given
      if (!generationRequest.diagramType && classification.inferredDiagramType) {
        generationRequest.diagramType = classification.inferredDiagramType;
      }
    } else if (classification.type === 'document') {
      outputType = 'document';
    } else {
      // Ambiguous — default to document for API (UI would ask user)
      outputType = 'document';
    }
  }

  // 7. Validate template compatibility with the resolved request type
  if (template) {
    const compat = templateManager.checkCompatibility(template, outputType);
    if (!compat.isValid) {
      res.status(400).json(
        createErrorResponse(
          compat.errors[0].code as ErrorCode,
          compat.errors[0].message,
          compat.errors[0].details,
        ),
      );
      return;
    }
  }

  // 8. Build generation context
  const context: GenerationContext = {
    sessionHistory,
    attachmentContexts: attachmentContexts.length > 0 ? attachmentContexts : undefined,
    template,
    diagramType: generationRequest.diagramType,
    outputFormat: generationRequest.outputFormat,
  };

  // 8. Route to appropriate generator
  try {
    let response: GenerationResponse;

    if (outputType === 'diagram') {
      // Check if this is a refinement (session has history)
      const isRefinement = sessionHistory != null && sessionHistory.length > 0;
      const lastContent = isRefinement
        ? sessionHistory![sessionHistory!.length - 1].response.content
        : undefined;

      const result = isRefinement && lastContent
        ? await refineDiagram(body.prompt, lastContent, context)
        : await generateDiagram(body.prompt, context);

      // Create or use existing session
      if (!sessionId) {
        const newSession = await sessionManager.createSession('diagram');
        sessionId = newSession.id;
      }

      response = {
        content: result.code,
        outputType: 'diagram',
        format: result.format,
        diagramType: result.diagramType,
        sessionId,
        exchangeIndex: sessionHistory ? sessionHistory.length : 0,
      };
    } else {
      // Document generation
      const isRefinement = sessionHistory != null && sessionHistory.length > 0;
      const lastContent = isRefinement
        ? sessionHistory![sessionHistory!.length - 1].response.content
        : undefined;

      const result = isRefinement && lastContent
        ? await refineDocument(body.prompt, lastContent, context)
        : await generateDocument(body.prompt, context);

      // Create or use existing session
      if (!sessionId) {
        const newSession = await sessionManager.createSession('document');
        sessionId = newSession.id;
      }

      response = {
        content: result.content,
        outputType: 'document',
        format: result.documentType,
        documentType: result.documentType,
        sessionId,
        exchangeIndex: sessionHistory ? sessionHistory.length : 0,
      };
    }

    // 9. Add exchange to session
    await sessionManager.addExchange(sessionId, body.prompt, response);

    // 10. Return response
    res.status(200).json({
      content: response.content,
      outputType: response.outputType,
      format: response.format,
      sessionId: response.sessionId,
      diagramType: response.diagramType,
      documentType: response.documentType,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = (err.code as ErrorCode) ?? ErrorCode.GENERATION_FAILED;
    res.status(500).json(
      createErrorResponse(code, err.message ?? 'Generation failed'),
    );
  }
});

// ─── POST /api/sessions/:sessionId/undo ──────────────────────────────────────

router.post('/api/sessions/:sessionId/undo', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  const result = await sessionManager.undo(sessionId);

  if (!result.success) {
    const statusCode = result.error!.code === ErrorCode.SESSION_NOT_FOUND ? 404 : 400;
    res.status(statusCode).json(
      createErrorResponse(result.error!.code, result.error!.message),
    );
    return;
  }

  res.status(200).json({
    undoneExchange: result.data,
    message: 'Last exchange undone successfully',
  });
});

// ─── GET /api/sessions/:sessionId ────────────────────────────────────────────

router.get('/api/sessions/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  const result = await sessionManager.getSession(sessionId);

  if (!result.success) {
    res.status(404).json(
      createErrorResponse(
        ErrorCode.SESSION_NOT_FOUND,
        `Session '${sessionId}' not found`,
      ),
    );
    return;
  }

  res.status(200).json(result.data);
});

// ─── GET /api/templates ──────────────────────────────────────────────────────

router.get('/api/templates', async (req: Request, res: Response) => {
  const filter: TemplateFilter = {};

  if (req.query.type) {
    filter.type = req.query.type as 'diagram' | 'document';
  }
  if (req.query.subType) {
    filter.subType = req.query.subType as TemplateFilter['subType'];
  }
  if (req.query.isBuiltIn !== undefined) {
    filter.isBuiltIn = req.query.isBuiltIn === 'true';
  }

  const templates = await templateManager.listTemplates(
    Object.keys(filter).length > 0 ? filter : undefined,
  );

  res.status(200).json(templates);
});

// ─── POST /api/templates ─────────────────────────────────────────────────────

router.post('/api/templates', async (req: Request, res: Response) => {
  try {
    const template = await templateManager.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; validationErrors?: unknown[] };
    const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
    const statusCode = code === ErrorCode.TEMPLATE_LIMIT_REACHED ? 400 : 400;
    res.status(statusCode).json(
      createErrorResponse(code, err.message ?? 'Template creation failed'),
    );
  }
});

// ─── PUT /api/templates/:templateId ──────────────────────────────────────────

router.put('/api/templates/:templateId', async (req: Request, res: Response) => {
  const templateId = req.params.templateId as string;

  try {
    const updated = await templateManager.updateTemplate(templateId, req.body);
    res.status(200).json(updated);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
    let statusCode = 400;
    if (code === ErrorCode.TEMPLATE_NOT_FOUND) statusCode = 404;
    if (code === ErrorCode.TEMPLATE_BUILTIN_READONLY) statusCode = 403;
    res.status(statusCode).json(
      createErrorResponse(code, err.message ?? 'Template update failed'),
    );
  }
});

// ─── DELETE /api/templates/:templateId ────────────────────────────────────────

router.delete('/api/templates/:templateId', async (req: Request, res: Response) => {
  const templateId = req.params.templateId as string;

  try {
    await templateManager.deleteTemplate(templateId);
    res.status(204).send();
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = (err.code as ErrorCode) ?? ErrorCode.TEMPLATE_INVALID;
    let statusCode = 400;
    if (code === ErrorCode.TEMPLATE_NOT_FOUND) statusCode = 404;
    if (code === ErrorCode.TEMPLATE_BUILTIN_READONLY) statusCode = 403;
    res.status(statusCode).json(
      createErrorResponse(code, err.message ?? 'Template deletion failed'),
    );
  }
});

export default router;
