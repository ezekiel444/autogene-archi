import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_ICON_NAMES,
  ICON_CATALOG,
  buildIconSelectionRules,
  formatIconCatalogForPrompt,
  getIconPlatform,
} from '@/domain/icon-catalog.js';

// ─── Catalog structure ───────────────────────────────────────────────────────

describe('Icon catalog — structure', () => {
  it('exposes the four platform groups in canonical order', () => {
    expect(ICON_CATALOG.map((g) => g.platform)).toEqual([
      'aws',
      'azure',
      'gcp',
      'generic',
    ]);
  });

  it('every entry has a non-empty name and description', () => {
    for (const group of ICON_CATALOG) {
      for (const cat of group.categories) {
        for (const icon of cat.icons) {
          expect(icon.name).toMatch(/^[a-z][a-z0-9-]*$/);
          expect(icon.description.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('icon names are unique across the whole catalog', () => {
    const seen = new Set<string>();
    for (const name of ALL_ICON_NAMES) {
      expect(seen.has(name), `duplicate icon name: ${name}`).toBe(false);
      seen.add(name);
    }
  });

  it('every AWS / Azure / GCP icon resolves to its platform', () => {
    for (const group of ICON_CATALOG) {
      for (const cat of group.categories) {
        for (const icon of cat.icons) {
          expect(getIconPlatform(icon.name)).toBe(group.platform);
        }
      }
    }
  });

  it('catalog includes broad coverage across AWS, Azure, and GCP', () => {
    const counts: Record<string, number> = {};
    for (const group of ICON_CATALOG) {
      counts[group.platform] = group.categories.reduce((n, c) => n + c.icons.length, 0);
    }
    expect(counts.aws).toBeGreaterThanOrEqual(20);
    expect(counts.azure).toBeGreaterThanOrEqual(20);
    expect(counts.gcp).toBeGreaterThanOrEqual(20);
  });
});

// ─── Prompt formatters ───────────────────────────────────────────────────────

describe('Icon catalog — prompt output', () => {
  it('formatIconCatalogForPrompt groups icons by platform with descriptions', () => {
    const prompt = formatIconCatalogForPrompt();
    expect(prompt).toContain('AWS icons:');
    expect(prompt).toContain('Azure icons:');
    expect(prompt).toContain('Google Cloud (GCP) icons:');
    expect(prompt).toContain('Generic / cloud-agnostic icons:');

    // Spot-check that descriptions are included alongside names.
    expect(prompt).toContain('aws-lambda (serverless function)');
    expect(prompt).toContain('azure-cosmos-db (globally distributed NoSQL DB)');
    expect(prompt).toContain('gcp-bigquery (serverless data warehouse)');
  });

  it('buildIconSelectionRules contains explicit no-mixing instruction', () => {
    const rules = buildIconSelectionRules();
    expect(rules).toContain('ICON SELECTION');
    expect(rules).toMatch(/Do NOT mix AWS, Azure, and GCP/);
    expect(rules).toMatch(/most specific/i);
    expect(rules).toMatch(/Generic icons/);
  });
});

// ─── Drift detection: backend catalog ↔ frontend SVG registry ────────────────

describe('Icon catalog — frontend / backend drift', () => {
  /**
   * Read the frontend SVG registry as plain text and extract every key.
   * We can't import it directly (different tsconfig + JSX) so we parse the
   * file with a regex over the object literal entries.
   */
  function readFrontendIconKeys(): string[] {
    const path = resolve(__dirname, '../../frontend/src/utils/cloudIcons.ts');
    const source = readFileSync(path, 'utf-8');

    // Locate the registry literal
    const start = source.indexOf('const CLOUD_ICONS: Record<string, string> = {');
    expect(start, 'CLOUD_ICONS registry not found in cloudIcons.ts').toBeGreaterThanOrEqual(0);

    // Match keys: either "key-with-dashes": ...  OR  bareIdentifier: ...
    // Stop at the closing brace of the registry to avoid eating helpers below.
    const tail = source.slice(start);
    const end = tail.indexOf('};');
    expect(end).toBeGreaterThan(0);
    const body = tail.slice(0, end);

    const keys = new Set<string>();
    const quotedKey = /['"]([a-z][a-z0-9-]*)['"]\s*:/gi;
    const bareKey = /(?:^|[\s,{])([a-z][a-z0-9]*)\s*:/gi;
    let m: RegExpExecArray | null;
    while ((m = quotedKey.exec(body))) keys.add(m[1]);
    while ((m = bareKey.exec(body))) keys.add(m[1]);
    return Array.from(keys);
  }

  it('every catalog icon has a matching SVG in cloudIcons.ts', () => {
    const frontendKeys = new Set(readFrontendIconKeys());
    const missing = ALL_ICON_NAMES.filter((name) => !frontendKeys.has(name));
    expect(missing, `Missing SVGs for: ${missing.join(', ')}`).toEqual([]);
  });

  it('cloudIcons.ts defines a "default" fallback', () => {
    const frontendKeys = new Set(readFrontendIconKeys());
    expect(frontendKeys.has('default')).toBe(true);
  });
});
