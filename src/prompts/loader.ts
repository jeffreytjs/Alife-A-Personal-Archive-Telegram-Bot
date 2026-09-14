import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { config } from '../utils/config.js';
import { promptConfigSchema, type PromptConfig } from './schema.js';

let cachedConfig: PromptConfig | null = null;

export function getPromptConfigPath(): string {
  return resolve(process.cwd(), config.prompts.configPath);
}

export function loadPromptConfig(forceReload = false): PromptConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const path = getPromptConfigPath();
  const raw = readFileSync(path, 'utf8');
  const parsed = parseYaml(raw);
  const result = promptConfigSchema.safeParse(parsed);

  if (!result.success) {
    const lines = result.error.errors.map((err) => `  - ${err.path.join('.')}: ${err.message}`);
    throw new Error(`Invalid prompt config at ${path}:\n${lines.join('\n')}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getLoadedPromptConfig(): PromptConfig {
  if (!cachedConfig) {
    throw new Error('Prompt config not loaded. Call loadPromptConfig() at startup.');
  }
  return cachedConfig;
}
