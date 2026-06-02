import { v4 as uuidv4 } from 'uuid';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Session, Exchange, GenerationResponse } from '../types/index.js';
import { ErrorCode, MAX_SESSION_EXCHANGES } from '../types/index.js';

/**
 * Serializable session format stored as JSON.
 * Dates are stored as ISO strings for JSON compatibility.
 */
interface SerializedSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  exchanges: SerializedExchange[];
  outputType: 'diagram' | 'document';
  currentVersion: number;
}

interface SerializedExchange {
  index: number;
  prompt: string;
  response: GenerationResponse;
  timestamp: string;
}

/**
 * Result type for session operations that may fail.
 */
export interface SessionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

/**
 * Manages conversation sessions for iterative refinement.
 * Sessions are persisted as JSON files in a configurable data directory.
 */
export class SessionManager {
  private readonly dataDir: string;

  constructor(dataDir: string = './data/sessions') {
    this.dataDir = dataDir;
  }

  /**
   * Ensures the data directory exists, creating it if necessary.
   */
  private async ensureDataDir(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
  }

  /**
   * Returns the file path for a given session ID.
   */
  private getSessionPath(sessionId: string): string {
    return join(this.dataDir, `${sessionId}.json`);
  }

  /**
   * Serializes a Session to JSON-compatible format.
   */
  private serialize(session: Session): SerializedSession {
    return {
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      exchanges: session.exchanges.map((exchange) => ({
        index: exchange.index,
        prompt: exchange.prompt,
        response: exchange.response,
        timestamp: exchange.timestamp.toISOString(),
      })),
      outputType: session.outputType,
      currentVersion: session.currentVersion,
    };
  }

  /**
   * Deserializes a JSON session back to a Session object with Date instances.
   */
  private deserialize(data: SerializedSession): Session {
    return {
      id: data.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      exchanges: data.exchanges.map((exchange) => ({
        index: exchange.index,
        prompt: exchange.prompt,
        response: exchange.response,
        timestamp: new Date(exchange.timestamp),
      })),
      outputType: data.outputType,
      currentVersion: data.currentVersion,
    };
  }

  /**
   * Persists a session to disk as a JSON file.
   */
  private async saveSession(session: Session): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.getSessionPath(session.id);
    const serialized = this.serialize(session);
    await writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
  }

  /**
   * Creates a new session with a unique ID.
   */
  async createSession(outputType: 'diagram' | 'document'): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      exchanges: [],
      outputType,
      currentVersion: 0,
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Retrieves a session by ID.
   * Returns null if the session does not exist.
   */
  async getSession(sessionId: string): Promise<SessionResult<Session>> {
    try {
      const filePath = this.getSessionPath(sessionId);
      const content = await readFile(filePath, 'utf-8');
      const data: SerializedSession = JSON.parse(content);
      return { success: true, data: this.deserialize(data) };
    } catch {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' not found`,
        },
      };
    }
  }

  /**
   * Adds a new exchange to a session.
   * Enforces the 50 exchange limit per session.
   */
  async addExchange(
    sessionId: string,
    prompt: string,
    response: GenerationResponse
  ): Promise<SessionResult<Exchange>> {
    const sessionResult = await this.getSession(sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' not found`,
        },
      };
    }

    const session = sessionResult.data;

    if (session.exchanges.length >= MAX_SESSION_EXCHANGES) {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_LIMIT_REACHED,
          message: `Session has reached the maximum of ${MAX_SESSION_EXCHANGES} exchanges`,
        },
      };
    }

    const exchange: Exchange = {
      index: session.exchanges.length,
      prompt,
      response,
      timestamp: new Date(),
    };

    session.exchanges.push(exchange);
    session.currentVersion = session.exchanges.length;
    session.updatedAt = new Date();

    await this.saveSession(session);
    return { success: true, data: exchange };
  }

  /**
   * Undoes the last exchange in a session.
   * Removes the last exchange and returns the exchange that was removed.
   * Returns an error if no exchanges exist to undo.
   */
  async undo(sessionId: string): Promise<SessionResult<Exchange>> {
    const sessionResult = await this.getSession(sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' not found`,
        },
      };
    }

    const session = sessionResult.data;

    if (session.exchanges.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCode.UNDO_NOT_AVAILABLE,
          message: 'No previous version available to restore',
        },
      };
    }

    const removedExchange = session.exchanges.pop()!;
    session.currentVersion = session.exchanges.length;
    session.updatedAt = new Date();

    await this.saveSession(session);
    return { success: true, data: removedExchange };
  }

  /**
   * Returns the full exchange history for a session.
   */
  async getHistory(sessionId: string): Promise<SessionResult<Exchange[]>> {
    const sessionResult = await this.getSession(sessionId);
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' not found`,
        },
      };
    }

    return { success: true, data: sessionResult.data.exchanges };
  }
}
