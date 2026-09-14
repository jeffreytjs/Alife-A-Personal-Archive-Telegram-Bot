import { loadPromptConfig } from '../src/prompts/loader.js';

try {
  loadPromptConfig(true);
  console.log('Prompt config is valid.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
