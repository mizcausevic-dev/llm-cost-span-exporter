# Changelog

## v0.1.0 — 2026-05-25

- Initial release: convert LLM usage records into OpenTelemetry GenAI spans (OTLP/JSON) with computed per-call cost.
- Standard OTel GenAI attributes (`gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.operation.name`, `gen_ai.usage.input_tokens` / `output_tokens`) plus cost extension attributes (`gen_ai.usage.cost*`).
- Built-in indicative model price table (override via `--prices`), substring model resolution, and explicit `unpriced` flagging instead of silent $0.
- Library API (`exportSpans`, `computeCost`, `summarize`) + CLI (`llm-cost-export`) accepting JSON array / object / JSONL, with OTLP output and a cost summary.
- Node 20/22 CI (lint, typecheck, coverage, build, demo, `npm audit`), AGPL-3.0-or-later, Dependabot.
