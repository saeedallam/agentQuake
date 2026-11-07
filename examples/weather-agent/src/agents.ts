import { ToolLoopAgent, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { Forecast } from './forecast-api.js';

export type ForecastTool = (city: string, days: number) => Promise<Forecast>;

const INSTRUCTIONS =
  'You answer weather questions with the getForecast tool. ' +
  'If the tool fails or its data looks incomplete, say you could not get ' +
  'the forecast. Never guess numbers.';

const inputSchema = z.object({
  city: z.string().describe('City name, for example Cairo'),
  days: z.number().int().min(1).max(7).describe('Number of days'),
});

const forecastSchema = z.object({
  city: z.string().min(1),
  days: z.array(z.object({ day: z.number(), tempC: z.number() })).min(1),
});

export function naiveAgent(model: LanguageModel, getForecast: ForecastTool) {
  return new ToolLoopAgent({
    model,
    instructions: INSTRUCTIONS,
    tools: {
      getForecast: tool({
        description: 'Daily forecast for a city',
        inputSchema,
        execute: ({ city, days }) => getForecast(city, days),
      }),
    },
  });
}

export function carefulAgent(model: LanguageModel, getForecast: ForecastTool) {
  return new ToolLoopAgent({
    model,
    instructions: INSTRUCTIONS,
    tools: {
      getForecast: tool({
        description: 'Daily forecast for a city',
        inputSchema,
        execute: ({ city, days }) => checkedForecast(getForecast, city, days),
      }),
    },
  });
}

async function checkedForecast(
  getForecast: ForecastTool,
  city: string,
  days: number,
): Promise<Forecast> {
  let lastProblem = 'no answer';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const forecast = forecastSchema.parse(await getForecast(city, days));
      if (forecast.city !== city || forecast.days.length !== days) {
        lastProblem = `asked for ${days} days in ${city}, got ${forecast.days.length} days in ${forecast.city}`;
        continue;
      }
      return forecast;
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(
    `The forecast service gave an unusable answer: ${lastProblem}`,
  );
}
