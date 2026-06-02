import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { SessionManager } from '../../src/application/session-manager.js';
import { ErrorCode, MAX_SESSION_EXCHANGES } from '../../src/types/index.js';
import type { GenerationResponse } from '../../src/types/index.js';

const TEST_DATA_DIR = join(process.cwd(), 'tests', '.test-sessions');

function makeResponse(index: number): GenerationResponse {
  return {
    content: `Generated content ${index}`,
    outputType: 'diagram',
    format: 'mermaid',
    diagramType: 'flowchart',
    sessionId: 'test-session',
    exchangeIndex: index,
  };
}

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(async () => {
    manager = new SessionManager(TEST_DATA_DIR);
    await mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('should create a new session with a unique ID', async () => {
      const session = await manager.createSession('diagram');

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(session.outputType).toBe('diagram');
      expect(session.exchanges).toEqual([]);
      expect(session.currentVersion).toBe(0);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a document session', async () => {
      const session = await manager.createSession('document');
      expect(session.outputType).toBe('document');
    });

    it('should generate different IDs for multiple sessions', async () => {
      const session1 = await manager.createSession('diagram');
      const session2 = await manager.createSession('diagram');
      expect(session1.id).not.toBe(session2.id);
    });

    it('should persist session to disk', async () => {
      const session = await manager.createSession('diagram');
      const result = await manager.getSession(session.id);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(session.id);
    });
  });

  describe('getSession', () => {
    it('should return SESSION_NOT_FOUND for non-existent session', async () => {
      const result = await manager.getSession('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    });

    it('should return a previously created session', async () => {
      const session = await manager.createSession('diagram');
      const result = await manager.getSession(session.id);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(session.id);
      expect(result.data?.outputType).toBe('diagram');
    });

    it('should deserialize dates correctly', async () => {
      const session = await manager.createSession('diagram');
      const result = await manager.getSession(session.id);

      expect(result.data?.createdAt).toBeInstanceOf(Date);
      expect(result.data?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('addExchange', () => {
    it('should add an exchange to a session', async () => {
      const session = await manager.createSession('diagram');
      const response = makeResponse(0);

      const result = await manager.addExchange(session.id, 'Create a flowchart', response);

      expect(result.success).toBe(true);
      expect(result.data?.index).toBe(0);
      expect(result.data?.prompt).toBe('Create a flowchart');
      expect(result.data?.response).toEqual(response);
      expect(result.data?.timestamp).toBeInstanceOf(Date);
    });

    it('should increment exchange index', async () => {
      const session = await manager.createSession('diagram');

      await manager.addExchange(session.id, 'First', makeResponse(0));
      const result = await manager.addExchange(session.id, 'Second', makeResponse(1));

      expect(result.data?.index).toBe(1);
    });

    it('should update session currentVersion', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));

      const result = await manager.getSession(session.id);
      expect(result.data?.currentVersion).toBe(1);
    });

    it('should return SESSION_NOT_FOUND for non-existent session', async () => {
      const result = await manager.addExchange('non-existent', 'prompt', makeResponse(0));

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    });

    it('should reject exchange when session has reached 50 exchanges', async () => {
      const session = await manager.createSession('diagram');

      // Add 50 exchanges
      for (let i = 0; i < MAX_SESSION_EXCHANGES; i++) {
        await manager.addExchange(session.id, `Prompt ${i}`, makeResponse(i));
      }

      // Attempt to add the 51st exchange
      const result = await manager.addExchange(
        session.id,
        'One too many',
        makeResponse(MAX_SESSION_EXCHANGES)
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SESSION_LIMIT_REACHED);
    });

    it('should preserve all exchanges in order', async () => {
      const session = await manager.createSession('diagram');

      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));
      await manager.addExchange(session.id, 'Third', makeResponse(2));

      const result = await manager.getSession(session.id);
      expect(result.data?.exchanges).toHaveLength(3);
      expect(result.data?.exchanges[0].prompt).toBe('First');
      expect(result.data?.exchanges[1].prompt).toBe('Second');
      expect(result.data?.exchanges[2].prompt).toBe('Third');
    });
  });

  describe('undo', () => {
    it('should remove the last exchange', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));

      const result = await manager.undo(session.id);

      expect(result.success).toBe(true);
      expect(result.data?.prompt).toBe('Second');
      expect(result.data?.index).toBe(1);
    });

    it('should leave the session with N-1 exchanges after undo', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));

      await manager.undo(session.id);

      const result = await manager.getSession(session.id);
      expect(result.data?.exchanges).toHaveLength(1);
      expect(result.data?.exchanges[0].prompt).toBe('First');
    });

    it('should return UNDO_NOT_AVAILABLE on empty session', async () => {
      const session = await manager.createSession('diagram');

      const result = await manager.undo(session.id);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.UNDO_NOT_AVAILABLE);
    });

    it('should return SESSION_NOT_FOUND for non-existent session', async () => {
      const result = await manager.undo('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    });

    it('should support sequential undos', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));
      await manager.addExchange(session.id, 'Third', makeResponse(2));

      await manager.undo(session.id);
      await manager.undo(session.id);

      const result = await manager.getSession(session.id);
      expect(result.data?.exchanges).toHaveLength(1);
      expect(result.data?.exchanges[0].prompt).toBe('First');
    });

    it('should update currentVersion after undo', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));

      await manager.undo(session.id);

      const result = await manager.getSession(session.id);
      expect(result.data?.currentVersion).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for new session', async () => {
      const session = await manager.createSession('diagram');
      const result = await manager.getHistory(session.id);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return all exchanges in order', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));

      const result = await manager.getHistory(session.id);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].prompt).toBe('First');
      expect(result.data![1].prompt).toBe('Second');
    });

    it('should return SESSION_NOT_FOUND for non-existent session', async () => {
      const result = await manager.getHistory('non-existent');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    });

    it('should reflect state after undo', async () => {
      const session = await manager.createSession('diagram');
      await manager.addExchange(session.id, 'First', makeResponse(0));
      await manager.addExchange(session.id, 'Second', makeResponse(1));

      await manager.undo(session.id);

      const result = await manager.getHistory(session.id);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].prompt).toBe('First');
    });
  });

  describe('data directory configuration', () => {
    it('should create the data directory if it does not exist', async () => {
      const customDir = join(TEST_DATA_DIR, 'custom', 'nested');
      const customManager = new SessionManager(customDir);

      const session = await customManager.createSession('diagram');
      const result = await customManager.getSession(session.id);

      expect(result.success).toBe(true);
    });
  });
});
