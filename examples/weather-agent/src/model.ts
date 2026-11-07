import { anthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { scriptedModel } from './scripted-model.js';

export function chooseModel(question: { city: string; days: number }): {
  model: LanguageModel;
  name: string;
} {
  if (process.env.ANTHROPIC_API_KEY) {
    const id = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5';
    return { model: anthropic(id), name: id };
  }
  return {
    model: scriptedModel(question),
    name: 'scripted model (no API key)',
  };
}
