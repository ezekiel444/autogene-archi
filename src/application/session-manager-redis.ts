/**
 * Redis-backed Session Manager for Vercel serverless deployment.
 * Replaces the file-based SessionManager with Upstash Redis storage.
 * API contract is identical to the original SessionManager.
 */

import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../infrastructure/redis-client.js';
import type { Session, Exchange, GenerationResponse } from '../types/index.js';
import { ErrorCode, MAX_SESSION_EXCHANGES } from '../types/index.js';

/**
 * Serializable session format stored in Redis.
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

/** Redis key prefix for sessions */
const SESSION_PREFIX = 'session:';

/** Session TTL: 7 days (in seconds) — keeps Upstash usage low */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Returns the Redis key for a given session ID.
 */
function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

/**
 * Serializes a Session to a JSON-compatible format.
 */
function serialize(session: Session): SerializedSession {
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
 * Deserializes a stored session back to a Session object with Date instances.
 */
function deserialize(data: SerializedSession): Session {
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
 * Redis-backed SessionManager with the same API as the file-based version.
 */
export class SessionManagerRedis {
  /**
   * Creates a new session with a unique ID.
   */
  async createSession(outputType: 'diagram' | 'document'): Promise<Session> {
    const redis = getRedisClient();
    const now = new Date();
    const session: Session = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      exchanges: [],
      outputType,
      currentVersion: 0,
    };

    const serialized = serialize(session);
    await redis.set(sessionKey(session.id), JSON.stringify(serialized), {
      ex: SESSION_TTL_SECONDS,
    });

    return session;
  }

  /**
   * Retrieves a session by ID.
   */
  async getSession(sessionId: string): Promise<SessionResult<Session>> {
    const redis = getRedisClient();

    const raw = await redis.get<string>(sessionKey(sessionId));
    if (!raw) {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' not found`,
        },
      };
    }

    try {
      const data: SerializedSession = typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as SerializedSession;
      return { success: true, data: deserialize(data) };
    } catch {
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: `Session '${sessionId}' is corrupted`,
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

    const redis = getRedisClient();
    await redis.set(sessionKey(session.id), JSON.stringify(serialize(session)), {
      ex: SESSION_TTL_SECONDS,
    });

    return { success: true, data: exchange };
  }

  /**
   * Undoes the last exchange in a session.
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

    const redis = getRedisClient();
    await redis.set(sessionKey(session.id), JSON.stringify(serialize(session)), {
      ex: SESSION_TTL_SECONDS,
    });

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
