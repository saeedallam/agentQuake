import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
} from '@ai-sdk/provider';
import { MockLanguageModelV4 } from 'ai/test';

const usage = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

function reply(
  content: LanguageModelV4GenerateResult['content'],
  finish: 'stop' | 'tool-calls',
): LanguageModelV4GenerateResult {
  return {
    content,
    finishReason: { unified: finish, raw: undefined },
    usage,
    warnings: [],
  };
}

function lastToolOutput(options: LanguageModelV4CallOptions) {
  const last = options.prompt.at(-1);
  if (last?.role !== 'tool') {
    return undefined;
  }
  const part = last.content.find((item) => item.type === 'tool-result');
  return part?.type === 'tool-result' ? part.output : undefined;
}

interface ForecastLike {
  city?: unknown;
  days?: { tempC?: unknown }[];
}

/**
 * A stand-in for a language model, so the example runs without an API key.
 * Like many real models, it reports tool errors honestly but trusts any data
 * a tool returns and writes it into the answer without checking it.
 */
export function scriptedModel(question: { city: string; days: number }) {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      const output = lastToolOutput(options);

      if (!output) {
        return reply(
          [
            {
              type: 'tool-call',
              toolCallId: `call-${options.prompt.length}`,
              toolName: 'getForecast',
              input: JSON.stringify(question),
            },
          ],
          'tool-calls',
        );
      }

      if (output.type !== 'json') {
        return reply(
          [
            {
              type: 'text',
              text: `Sorry, I could not get the forecast for ${question.city} right now.`,
            },
          ],
          'stop',
        );
      }

      const forecast = (output.value ?? {}) as ForecastLike;
      const temperatures = (forecast.days ?? [])
        .map((day) => `${String(day.tempC)}°C`)
        .join(', ');
      return reply(
        [
          {
            type: 'text',
            text: `Forecast for ${String(forecast.city)}: ${temperatures || 'no data'}.`,
          },
        ],
        'stop',
      );
    },
  });
}
