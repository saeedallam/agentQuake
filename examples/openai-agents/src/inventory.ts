import { Agent, Runner, tool } from '@openai/agents';
import {
  ScriptedModel,
  assistantMessage,
  functionCall,
  modelResponder,
} from '@openai/agents/testing';
import { quake } from 'agentquake';
import { z } from 'zod';

const sku = 'tea-01';
const toolName = 'get_stock';
const stockSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().nonnegative(),
});

async function fetchStock(requestedSku: string) {
  return { sku: requestedSku, quantity: 12 };
}

export async function runInventoryAgent(
  variant: 'naive' | 'careful',
  preset?: 'silent',
) {
  const chaos = quake({ preset, seed: 1 });
  const getStock = chaos.tool(toolName, fetchStock, { critical: true });
  const model = new ScriptedModel([
    [functionCall(toolName, { sku }, { callId: 'stock-1' })],
    modelResponder(({ request }) => {
      const result = Array.isArray(request.input)
        ? request.input.find(
            (item) =>
              item.type === 'function_call_result' && item.callId === 'stock-1',
          )
        : undefined;
      if (
        result?.type !== 'function_call_result' ||
        typeof result.output !== 'object' ||
        !('text' in result.output)
      ) {
        throw new Error('Expected the inventory tool to return JSON text');
      }
      const stock = JSON.parse(result.output.text) as
        z.infer<typeof stockSchema> | { error: string };
      return [
        assistantMessage(
          'error' in stock
            ? stock.error
            : `Stock for ${stock.sku}: ${stock.quantity} units.`,
        ),
      ];
    }),
  ]);
  const agent = new Agent({
    name: 'Inventory assistant',
    instructions: 'Look up stock for the requested item.',
    model,
    tools: [
      tool({
        name: toolName,
        description: 'Look up the available quantity for an SKU',
        parameters: z.object({ sku: z.string() }),
        execute: async ({ sku: requestedSku }) => {
          const response = await getStock(requestedSku);
          if (variant === 'naive') return response;
          const parsed = stockSchema.safeParse(response);
          if (!parsed.success || parsed.data.sku !== requestedSku) {
            return {
              error:
                'Stock is unavailable because the tool returned invalid data.',
            };
          }
          return parsed.data;
        },
      }),
    ],
  });
  const runner = new Runner({ tracingDisabled: true });
  const answer = await chaos.agent(async () => {
    const result = await runner.run(agent, `How much ${sku} is in stock?`);
    return result.finalOutput;
  });
  model.assertComplete();
  return { answer, report: chaos.report() };
}
