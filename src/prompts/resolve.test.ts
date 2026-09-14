import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { promptConfigSchema } from '../prompts/schema.js';
import { loadPromptConfig } from '../prompts/loader.js';
import { resolvePrimaryPrompt } from '../prompts/resolve.js';

describe('prompt config schema', () => {
  it('rejects empty phases', () => {
    const result = promptConfigSchema.safeParse({
      version: 1,
      timezone: 'Asia/Singapore',
      dailyAt: '08:00',
      phases: [],
      generators: {},
      lists: { byLetter: {} },
      alternate: { generator: 'randomColor', excludePrimary: true },
      overrides: { days: {}, weeks: {}, months: {} },
    });
    assert.equal(result.success, false);
  });

  it('accepts bundled prompts.yaml', () => {
    const path = resolve(process.cwd(), 'config/prompts/prompts.yaml');
    const parsed = parseYaml(readFileSync(path, 'utf8'));
    const result = promptConfigSchema.safeParse(parsed);
    assert.equal(result.success, true);
  });
});

describe('resolvePrimaryPrompt', () => {
  it('uses fixed day override', () => {
    const config = loadPromptConfig(true);
    const withOverride = {
      ...config,
      overrides: {
        ...config.overrides,
        days: { '2026-12-25': { word: 'gold' } },
      },
    };
    const resolved = resolvePrimaryPrompt(withOverride, '2026-12-25');
    assert.equal(resolved.word, 'gold');
  });

  it('is stable for the same date', () => {
    const config = loadPromptConfig(true);
    const a = resolvePrimaryPrompt(config, '2026-09-15');
    const b = resolvePrimaryPrompt(config, '2026-09-15');
    assert.equal(a.word, b.word);
  });

  it('uses weekday initial in October phase', () => {
    const config = loadPromptConfig(true);
    const resolved = resolvePrimaryPrompt(config, '2026-10-05');
    assert.equal(resolved.generatorId, 'weekdayInitial');
  });
});
