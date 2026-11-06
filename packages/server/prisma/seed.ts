import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface DemoScenario {
  name: string;
  runId: string;
  sourceYaml: string;
  definition: { version: number; name: string; seed: number; faults: object[] };
}

const demoScenarios: DemoScenario[] = [
  {
    name: 'no-faults',
    runId: '00000000-0000-7000-8000-000000000001',
    sourceYaml: `version: 1
name: no-faults
seed: 42
faults: []
`,
    definition: { version: 1, name: 'no-faults', seed: 42, faults: [] },
  },
  {
    name: 'slow-todos',
    runId: '00000000-0000-7000-8000-000000000002',
    sourceYaml: `version: 1
name: slow-todos
seed: 42
faults:
  - id: slow-todos
    type: latency
    target: { tool: todos, path: "/todos*" }
    probability: 0.5
    config: { delayMs: 2000 }
`,
    definition: {
      version: 1,
      name: 'slow-todos',
      seed: 42,
      faults: [
        {
          id: 'slow-todos',
          type: 'latency',
          target: { tool: 'todos', path: '/todos*' },
          probability: 0.5,
          config: { delayMs: 2000 },
        },
      ],
    },
  },
  {
    name: 'flaky-todos',
    runId: '00000000-0000-7000-8000-000000000003',
    sourceYaml: `version: 1
name: flaky-todos
seed: 42
faults:
  - id: flaky-todos
    type: http_error
    target: { tool: todos }
    probability: 0.3
    config: { status: 503 }
`,
    definition: {
      version: 1,
      name: 'flaky-todos',
      seed: 42,
      faults: [
        {
          id: 'flaky-todos',
          type: 'http_error',
          target: { tool: 'todos' },
          probability: 0.3,
          config: { status: 503 },
        },
      ],
    },
  },
  {
    name: 'hanging-todos',
    runId: '00000000-0000-7000-8000-000000000004',
    sourceYaml: `version: 1
name: hanging-todos
seed: 42
faults:
  - id: hanging-todos
    type: timeout
    target: { tool: todos }
    probability: 0.3
    config: { afterMs: 3000 }
`,
    definition: {
      version: 1,
      name: 'hanging-todos',
      seed: 42,
      faults: [
        {
          id: 'hanging-todos',
          type: 'timeout',
          target: { tool: 'todos' },
          probability: 0.3,
          config: { afterMs: 3000 },
        },
      ],
    },
  },
];

async function main() {
  const project = await prisma.project.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { slug: 'demo', name: 'Demo project' },
  });

  for (const slug of ['todos', 'email']) {
    await prisma.tool.upsert({
      where: { projectId_slug: { projectId: project.id, slug } },
      update: {},
      create: {
        projectId: project.id,
        slug,
        baseUrl: 'http://localhost:5000',
      },
    });
  }

  for (const demo of demoScenarios) {
    const scenario = await prisma.scenario.upsert({
      where: { projectId_name: { projectId: project.id, name: demo.name } },
      update: {},
      create: {
        projectId: project.id,
        name: demo.name,
        sourceYaml: demo.sourceYaml,
        definition: demo.definition,
        checksum: createHash('sha256').update(demo.sourceYaml).digest('hex'),
      },
    });

    await prisma.run.upsert({
      where: { id: demo.runId },
      update: { status: 'RUNNING' },
      create: {
        id: demo.runId,
        scenarioId: scenario.id,
        status: 'RUNNING',
        seed: demo.definition.seed,
        scenarioSnapshot: demo.definition,
        startedAt: new Date(),
      },
    });
  }

  await prisma.trace.deleteMany({
    where: { runId: { in: demoScenarios.map((demo) => demo.runId) } },
  });

  console.log(`Seeded project "${project.slug}" with tools todos and email:`);
  for (const demo of demoScenarios) {
    console.log(`  ${demo.runId}  ${demo.name}`);
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
