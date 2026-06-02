import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should resolve path aliases', async () => {
    const envModule = await import('@/env');
    expect(envModule.loadEnvConfig).toBeDefined();
  });
});
