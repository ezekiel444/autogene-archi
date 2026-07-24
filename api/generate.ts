/**
 * Vercel Serverless Function: POST /api/generate
 * Handles diagram and document generation with AI.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

import { validateInput, classifyPrompt } from '../src/application/prompt-engine.js';
import { SessionManagerRedis } from '../src/application/session-manager-redis.js';
import { TemplateManagerRedis } from '../src/application/template-manager-redis.js';
import { generate as generateDiagram, refine as refineDiagram } from '../src/domain/diagram-generator.js';
import { generate as generateDocument, refine as refineDocument } from '../src/domain/document-generator.js';
import { validateAll as validateAttachments, process as processAttachment } from '../src/domain/attachment-processor.js';
import type {
  APIGenerateRequest,
  APIAttachment,
  Attachment,
  GenerationRequest,
  GenerationResponse,
  GenerationContext,
  AttachmentContext,
  ErrorResponse,
} from '../src/types/index.js';
import { ErrorCode } from '../src/types/index.js';

// ─── Module-level instances (reused across warm invocations) ─────────────────

const sessionManager = new SessionManagerRedis();
const templateManager = new TemplateManagerRedis();

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' } });
  }

  const body = req.body as APIGenerateRequest;

  // 1. Build GenerationRequest
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
    return res.status(400).json(
      createErrorResponse(
        validation.errors[0].code as ErrorCode,
        validation.errors[0].message,
        validation.errors[0].details,
      ),
    );
  }

  // 3. Decode and validate attachments
  let attachments: Attachment[] = [];
  let attachmentContexts: AttachmentContext[] = [];

  if (body.attachments && body.attachments.length > 0) {
    attachments = decodeAttachments(body.attachments);
    const attachmentValidation = validateAttachments(attachments);
    if (!attachmentValidation.isValid) {
      return res.status(400).json(
        createErrorResponse(
          attachmentValidation.errors[0].code as ErrorCode,
          attachmentValidation.errors[0].message,
          attachmentValidation.errors[0].details,
        ),
      );
    }

    try {
      attachmentContexts = await Promise.all(
        attachments.map((a) => processAttachment(a)),
      );
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      return res.status(400).json(
        createErrorResponse(
          (err.code as ErrorCode) ?? ErrorCode.INTERNAL_ERROR,
          err.message ?? 'Attachment processing failed',
        ),
      );
    }
  }

  // 4. Get/create session
  let sessionId = body.sessionId;
  let sessionHistory: GenerationContext['sessionHistory'] = undefined;

  if (sessionId) {
    const sessionResult = await sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      return res.status(404).json(
        createErrorResponse(
          ErrorCode.SESSION_NOT_FOUND,
          `Session '${sessionId}' not found`,
        ),
      );
    }
    sessionHistory = sessionResult.data!.exchanges;
  }

  // 5. Resolve template
  let template: GenerationContext['template'] = undefined;
  if (body.templateId) {
    const foundTemplate = await templateManager.getTemplate(body.templateId);
    if (!foundTemplate) {
      return res.status(404).json(
        createErrorResponse(
          ErrorCode.TEMPLATE_NOT_FOUND,
          `Template '${body.templateId}' not found`,
        ),
      );
    }
    template = foundTemplate;
  }

  // 6. Determine output type
  let outputType: 'diagram' | 'document';

  if (body.diagramType) {
    outputType = 'diagram';
  } else if ((req.body as any).mode === 'diagram') {
    outputType = 'diagram';
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
    const classification = await classifyPrompt(body.prompt);
    if (classification.type === 'diagram') {
      outputType = 'diagram';
      if (!generationRequest.diagramType && classification.inferredDiagramType) {
        generationRequest.diagramType = classification.inferredDiagramType;
      }
    } else if (classification.type === 'document') {
      outputType = 'document';
    } else {
      outputType = 'document';
    }
  }

  // 7. Validate template compatibility
  if (template) {
    const compat = templateManager.checkCompatibility(template, outputType);
    if (!compat.isValid) {
      return res.status(400).json(
        createErrorResponse(
          compat.errors[0].code as ErrorCode,
          compat.errors[0].message,
          compat.errors[0].details,
        ),
      );
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

  // 9. Route to appropriate generator
  try {
    let response: GenerationResponse;

    if (outputType === 'diagram') {
      const isRefinement = sessionHistory != null && sessionHistory.length > 0;
      const lastContent = isRefinement
        ? sessionHistory![sessionHistory!.length - 1].response.content
        : undefined;

      const result = isRefinement && lastContent
        ? await refineDiagram(body.prompt, lastContent, context)
        : await generateDiagram(body.prompt, context);

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
      const isRefinement = sessionHistory != null && sessionHistory.length > 0;
      const lastContent = isRefinement
        ? sessionHistory![sessionHistory!.length - 1].response.content
        : undefined;

      const result = isRefinement && lastContent
        ? await refineDocument(body.prompt, lastContent, context)
        : await generateDocument(body.prompt, context);

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

    // 10. Add exchange to session
    await sessionManager.addExchange(sessionId, body.prompt, response);

    // 11. Return response
    return res.status(200).json({
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
    return res.status(500).json(
      createErrorResponse(code, err.message ?? 'Generation failed'),
    );
  }
}
