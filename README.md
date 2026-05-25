# llm-cost-span-exporter

Turn LLM usage records into **OpenTelemetry GenAI spans with computed per-call cost**. Feed it what your app already logs — provider, model, token counts — and get back OTLP/JSON spans (ready to ship to any OpenTelemetry endpoint) plus a cost summary.

Part of the [Kinetic Gain](https://suite.kineticgain.com) GenAI observability lane.

## Why

Most teams log token counts somewhere but can't answer "what did last night's agent run cost, by model?" without a spreadsheet. The OpenTelemetry [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) standardize how to *describe* an LLM call as a span (`gen_ai.request.model`, `gen_ai.usage.input_tokens`, …) but say nothing about cost. This exporter bridges that gap: it emits spec-correct GenAI spans **and** attaches cost as a documented extension attribute, so cost shows up next to latency and tokens in the same trace backend you already run.

It is offline and deterministic — it transforms records, it does not call any LLM or network endpoint.

## Install

```bash
npm install -g llm-cost-span-exporter   # CLI
npm install llm-cost-span-exporter      # library
```

Requires Node ≥ 20.

## CLI

```bash
# OTLP spans to stdout, cost summary to stderr
llm-cost-export usage.jsonl --summary

# write OTLP to a file, using your own price table
llm-cost-export usage.jsonl --prices my-prices.json --out spans.json
```

Input is a JSON array, a single JSON object, or JSONL of usage records:

```json
{ "provider": "anthropic", "model": "claude-opus-4-7", "operation": "chat", "inputTokens": 12000, "outputTokens": 3400, "durationMs": 4200 }
```

## Library

```ts
import { exportSpans } from "llm-cost-span-exporter";

const { otlp, summary } = exportSpans(records);
console.log(summary.totalCost, summary.byModel);
// POST otlp to your OTLP/HTTP traces endpoint
```

## Attributes emitted

Standard OTel GenAI (per the spec):

| Attribute | From |
|---|---|
| `gen_ai.provider.name` | record.provider |
| `gen_ai.request.model` | record.model |
| `gen_ai.response.model` | record.responseModel |
| `gen_ai.operation.name` | record.operation (default `chat`) |
| `gen_ai.usage.input_tokens` | record.inputTokens |
| `gen_ai.usage.output_tokens` | record.outputTokens |

Cost **extension** attributes (non-standard — OTel has no official cost attribute):

`gen_ai.usage.cost`, `gen_ai.usage.input_cost`, `gen_ai.usage.output_cost`, `gen_ai.usage.cost_currency`, and `gen_ai.usage.cost_unpriced` (set when the model isn't in the price table).

## Prices

A small **indicative** price table ships built in (USD per 1M tokens, point-in-time). Prices change constantly — override with `--prices file.json`:

```json
{ "claude-opus-4": { "inputPerMTok": 15, "outputPerMTok": 75 } }
```

Model ids resolve by exact match, then by the longest price-table key that is a substring (so `gpt-4o-2024-11-20` prices via `gpt-4o`). Unknown models are reported as `unpriced` with zero cost rather than silently mispriced.

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE).
