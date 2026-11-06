#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { quake } from '../library/quake.js';
import { QuakeConfigError } from '../library/resolve-rules.js';
import { JsonlTraceStore, parseJsonl } from './jsonl-trace-store.js';
import { CliError, quakeOptionsFrom } from './options.js';
import { startProxy } from './proxy.js';
import { formatReport } from './report.js';
import { runStdio } from './stdio.js';

const USAGE = `agentquake: chaos testing for AI agents

Usage:
  agentquake proxy  --tool <name>=<url> [--tool ...] [--port 4000] [scenario options]
  agentquake stdio  [scenario options] -- <command> [args...]
  agentquake report [traces.jsonl]

Scenario options:
  --preset <name>     flaky, rate-limited, slow or outage
  --scenario <file>   a YAML file with "faults" (and an optional "seed")
  --seed <number>     replay the same faults
  --traces <file>     where to write traces (default: agentquake-traces.jsonl)

Examples:
  agentquake proxy --preset flaky --tool weather=https://api.weather.com
  agentquake stdio --preset outage -- node weather-server.js
  agentquake report agentquake-traces.jsonl
`;

const DEFAULT_TRACES = 'agentquake-traces.jsonl';
const MAX_SEED = 2_147_483_647;
const log = (message: string) =>
  process.stderr.write(`[agentquake] ${message}\n`);

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case 'proxy':
      return proxyCommand(rest);
    case 'stdio':
      return stdioCommand(rest);
    case 'report':
      return reportCommand(rest);
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      process.stdout.write(USAGE);
      return 0;
    default:
      throw new CliError(
        `Unknown command "${command}". Run "agentquake --help".`,
      );
  }
}

const scenarioFlags = {
  preset: { type: 'string' },
  scenario: { type: 'string' },
  seed: { type: 'string' },
  traces: { type: 'string' },
} as const;

function startRun(values: {
  preset?: string;
  scenario?: string;
  seed?: string;
  traces?: string;
}) {
  const options = quakeOptionsFrom(values);
  const file = values.traces ?? DEFAULT_TRACES;
  const seed = options.seed ?? Math.floor(Math.random() * MAX_SEED);
  const run = quake({
    ...options,
    seed,
    store: new JsonlTraceStore(file, seed),
  });
  return { run, file };
}

async function proxyCommand(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      ...scenarioFlags,
      tool: { type: 'string', multiple: true },
      port: { type: 'string', default: '4000' },
    },
  });

  const tools = new Map<string, string>();
  for (const entry of values.tool ?? []) {
    const separator = entry.indexOf('=');
    if (separator <= 0) {
      throw new CliError(`--tool must look like name=url, got "${entry}"`);
    }
    tools.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  if (tools.size === 0) {
    throw new CliError(
      'Give at least one tool, for example --tool weather=https://api.weather.com',
    );
  }

  const port = Number(values.port);
  const { run, file } = startRun(values);
  await startProxy({ run, tools, port, log });

  log(`seed ${run.seed}, traces in ${file}`);
  for (const [name, url] of tools) {
    log(`http://127.0.0.1:${port}/${name}/...  ->  ${url}`);
  }
  await new Promise(() => undefined);
  return 0;
}

async function stdioCommand(args: string[]): Promise<number> {
  const separator = args.indexOf('--');
  if (separator === -1 || separator === args.length - 1) {
    throw new CliError(
      'Put the MCP server command after "--", for example: agentquake stdio -- node server.js',
    );
  }

  const { values } = parseArgs({
    args: args.slice(0, separator),
    options: scenarioFlags,
  });
  const [command = '', ...commandArgs] = args.slice(separator + 1);
  const { run, file } = startRun(values);
  log(`seed ${run.seed}, traces in ${file}`);

  return runStdio({
    run,
    command,
    args: commandArgs,
    agentInput: process.stdin,
    agentOutput: process.stdout,
    log,
  });
}

function reportCommand(args: string[]): number {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  const file = positionals[0] ?? DEFAULT_TRACES;

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new CliError(
      `Cannot read "${file}". Run "agentquake proxy" or "agentquake stdio" first.`,
    );
  }

  const lines = parseJsonl(text) as (ReturnType<typeof parseJsonl>[number] & {
    seed?: number;
  })[];
  process.stdout.write(`${formatReport(lines, lines[0]?.seed)}\n`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    if (error instanceof CliError || error instanceof QuakeConfigError) {
      log(error.message);
    } else if (
      error instanceof Error &&
      'code' in error &&
      String(error.code).startsWith('ERR_PARSE_ARGS')
    ) {
      log(`${error.message}\n\n${USAGE}`);
    } else {
      log(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
    }
    process.exit(1);
  },
);
