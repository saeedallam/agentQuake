import { quake, type QuakeOptions } from 'agentquake';
import { carefulAgent, naiveAgent } from './agents.js';
import { fetchForecast } from './forecast-api.js';
import { chooseModel } from './model.js';

const question = { city: 'Cairo', days: 4 };
const prompt = 'What is the 4-day forecast for Cairo?';

const scenarios: [string, QuakeOptions][] = [
  ['no faults', {}],
  ['outage (every call fails)', { preset: 'outage' }],
  [
    'empty answer (200, no data)',
    {
      faults: [
        {
          id: 'empty',
          type: 'empty_response',
          target: { tool: 'getForecast' },
        },
      ],
    },
  ],
  [
    'truncated answer (200, half the data)',
    {
      faults: [
        {
          id: 'cut',
          type: 'truncated_response',
          target: { tool: 'getForecast' },
          config: { keep: 0.5 },
        },
      ],
    },
  ],
];

const agents = [
  ['naive', naiveAgent],
  ['careful', carefulAgent],
] as const;

console.log(`Model: ${chooseModel(question).name}\n`);

for (const [scenario, options] of scenarios) {
  console.log(`== ${scenario}`);
  for (const [name, build] of agents) {
    const run = quake({ seed: 1, ...options });
    const agent = build(
      chooseModel(question).model,
      run.tool('getForecast', fetchForecast, { critical: true }),
    );
    const answer = await run.agent(
      async () => (await agent.generate({ prompt })).text,
    );
    const report = run.report();
    const flags = [
      report.falseSuccess ? 'FALSE SUCCESS' : '',
      report.leakedGarbage ? 'LEAKED GARBAGE' : '',
      report.corruptedCalls.length > 0
        ? `${report.corruptedCalls.length} corrupted call(s)`
        : '',
    ].filter(Boolean);
    console.log(`  ${name.padEnd(8)} ${answer.trim()}`);
    console.log(
      `  ${''.padEnd(8)} -> ${flags.length > 0 ? flags.join(', ') : 'ok'}`,
    );
  }
  console.log('');
}
