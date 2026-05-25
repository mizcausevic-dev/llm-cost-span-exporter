#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { exportSpans } from "./exporter.js";
import type { PriceTable, UsageRecord } from "./types.js";

interface Args {
  source?: string;
  prices?: string;
  out?: string;
  summary: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { summary: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--summary") args.summary = true;
    else if (a === "--prices") args.prices = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (!a.startsWith("-")) args.source = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

/** Parse a usage file: a JSON array, a single JSON object, or JSONL. */
export function parseUsage(raw: string): UsageRecord[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed) as UsageRecord[];
  if (trimmed.startsWith("{") && !trimmed.includes("\n")) {
    return [JSON.parse(trimmed) as UsageRecord];
  }
  // JSONL (one record per non-empty line)
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l) as UsageRecord;
      } catch {
        throw new Error(`invalid JSON on line ${i + 1}`);
      }
    });
}

const HELP = `llm-cost-span-exporter — turn LLM usage records into OpenTelemetry spans with cost

Usage:
  llm-cost-export <usage.json|.jsonl> [options]

Input: a JSON array, a single JSON object, or JSONL of usage records:
  { "provider", "model", "inputTokens", "outputTokens", "operation"?, ... }

Options:
  --prices <file>   JSON price table { "<model>": { "inputPerMTok", "outputPerMTok" } }
                    to override the built-in indicative defaults.
  --out <file>      Write OTLP JSON to a file (default: stdout).
  --summary         Print a human cost summary to stderr.
  -h, --help        Show this help.

Emits OTLP/JSON spans with OTel GenAI attributes plus cost extension attributes
(gen_ai.usage.cost*). Exit codes: 0 ok, 2 usage/IO error.`;

export function run(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }
  if (args.help || !args.source) {
    process.stdout.write(`${HELP}\n`);
    return args.help ? 0 : 2;
  }
  let records: UsageRecord[];
  let prices: PriceTable | undefined;
  try {
    records = parseUsage(readFileSync(args.source, "utf8"));
    if (args.prices) {
      prices = JSON.parse(readFileSync(args.prices, "utf8")) as PriceTable;
    }
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return 2;
  }
  let result;
  try {
    result = exportSpans(records, { prices });
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return 2;
  }
  const json = JSON.stringify(result.otlp, null, 2);
  if (args.out) {
    writeFileSync(args.out, `${json}\n`, "utf8");
    process.stdout.write(`wrote ${result.summary.records} span(s) to ${args.out}\n`);
  } else {
    process.stdout.write(`${json}\n`);
  }
  if (args.summary) {
    const s = result.summary;
    process.stderr.write(
      `\ncost summary: $${s.totalCost.toFixed(4)} USD over ${s.records} call(s)` +
        ` — ${s.totalInputTokens} in / ${s.totalOutputTokens} out tokens` +
        (s.unpricedRecords ? ` — ${s.unpricedRecords} UNPRICED` : "") +
        "\n"
    );
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  process.exit(run(process.argv.slice(2)));
}
