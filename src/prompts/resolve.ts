import { DateTime } from 'luxon';
import type { PromptConfig } from './schema.js';
import {
  isoWeekKey,
  isDateInInclusiveRange,
  monthKey,
  monthNameKey,
  parseDateKey,
} from './dates.js';
import { pickIndex } from './hash.js';

export type ResolvedPrompt = {
  word: string;
  dateKey: string;
  generatorId: string;
};

function getLetterForUnit(
  dateKey: string,
  timezone: string,
  unit: 'weekday' | 'month',
): string {
  const dt = parseDateKey(dateKey, timezone).setLocale('en');
  const label = unit === 'weekday' ? dt.toFormat('cccc') : dt.toFormat('LLLL');
  const first = label.charAt(0);
  return first.toUpperCase();
}

function pickFromList(words: string[], seed: string): string {
  const index = pickIndex(seed, words.length);
  return words[index] ?? words[0]!;
}

function runGenerator(
  config: PromptConfig,
  generatorId: string,
  dateKey: string,
  seed: string,
): { word: string; generatorId: string } {
  const generator = config.generators[generatorId];
  if (!generator) {
    return runGenerator(config, 'randomColor', dateKey, seed);
  }

  if (generator.type === 'list') {
    return { word: pickFromList(generator.words, seed), generatorId };
  }

  const letter = getLetterForUnit(dateKey, config.timezone, generator.unit);
  const bucket = config.lists.byLetter[letter];
  if (!bucket || bucket.length === 0) {
    console.warn(`No words for letter ${letter}; falling back to randomColor`);
    const fallback = config.generators.randomColor;
    if (fallback?.type === 'list') {
      return { word: pickFromList(fallback.words, seed), generatorId: 'randomColor' };
    }
    return { word: 'light', generatorId: 'fallback' };
  }

  return { word: pickFromList(bucket, seed), generatorId };
}

function resolveGeneratorIdForDate(config: PromptConfig, dateKey: string): string {
  const dayOverride = config.overrides.days[dateKey];
  if (dayOverride) {
    if ('word' in dayOverride) {
      return 'fixed';
    }
    return dayOverride.generator;
  }

  const week = isoWeekKey(dateKey, config.timezone);
  const weekOverride = config.overrides.weeks[week];
  if (weekOverride) {
    return weekOverride.generator;
  }

  const monthKeys = [monthKey(dateKey, config.timezone), monthNameKey(dateKey, config.timezone)];
  for (const key of monthKeys) {
    const monthOverride = config.overrides.months[key];
    if (monthOverride) {
      if ('word' in monthOverride) {
        return 'fixed';
      }
      return monthOverride.generator;
    }
  }

  const phase = config.phases.find((entry) => isDateInInclusiveRange(dateKey, entry.from, entry.until));
  if (!phase) {
    const last = config.phases[config.phases.length - 1];
    return last?.generator ?? 'randomColor';
  }

  return phase.generator;
}

function resolveFixedWord(config: PromptConfig, dateKey: string): string | null {
  const dayOverride = config.overrides.days[dateKey];
  if (dayOverride && 'word' in dayOverride) {
    return dayOverride.word;
  }

  const monthKeys = [monthKey(dateKey, config.timezone), monthNameKey(dateKey, config.timezone)];
  for (const key of monthKeys) {
    const monthOverride = config.overrides.months[key];
    if (monthOverride && 'word' in monthOverride) {
      return monthOverride.word;
    }
  }

  return null;
}

export function resolvePrimaryPrompt(config: PromptConfig, dateKey: string): ResolvedPrompt {
  const fixed = resolveFixedWord(config, dateKey);
  if (fixed) {
    return { word: fixed, dateKey, generatorId: 'fixed' };
  }

  const generatorId = resolveGeneratorIdForDate(config, dateKey);
  if (generatorId === 'fixed') {
    return { word: 'today', dateKey, generatorId: 'fixed' };
  }

  const seed = `${dateKey}:primary`;
  const { word, generatorId: resolvedId } = runGenerator(config, generatorId, dateKey, seed);
  return { word, dateKey, generatorId: resolvedId };
}

export function resolveAlternatePrompt(
  config: PromptConfig,
  dateKey: string,
  userId: number,
  primaryWord: string,
): ResolvedPrompt | null {
  const generatorId = config.alternate.generator;
  const seed = `${userId}:${dateKey}:alternate`;
  const { word, generatorId: resolvedId } = runGenerator(config, generatorId, dateKey, seed);

  if (config.alternate.excludePrimary && word.toLowerCase() === primaryWord.toLowerCase()) {
    const altGenerator = config.generators[generatorId];
    if (altGenerator?.type === 'list' && altGenerator.words.length <= 1) {
      return null;
    }
    const retrySeed = `${userId}:${dateKey}:alternate:retry`;
    const retry = runGenerator(config, generatorId, dateKey, retrySeed);
    if (retry.word.toLowerCase() === primaryWord.toLowerCase()) {
      const pool =
        altGenerator?.type === 'list'
          ? altGenerator.words.filter((w) => w.toLowerCase() !== primaryWord.toLowerCase())
          : [];
      if (pool.length === 0) {
        return null;
      }
      return {
        word: pickFromList(pool, retrySeed),
        dateKey,
        generatorId: resolvedId,
      };
    }
    return { word: retry.word, dateKey, generatorId: retry.generatorId };
  }

  return { word, dateKey, generatorId: resolvedId };
}

export function todayDateKeyForConfig(config: PromptConfig, now = DateTime.now()): string {
  return now.setZone(config.timezone).toFormat('yyyy-MM-dd');
}
