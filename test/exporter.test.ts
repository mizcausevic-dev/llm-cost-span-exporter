import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect } from "vitest";

import { exportSpans } from "../src/exporter.js";
import { computeCost } from "../src/cost.js";
import { resolvePrice, DEFAULT_PRICES } from "../src/prices.js";
import { toSpan } from "../src/span.js";
import { parseUsage } from "../src/cli.js";
import * as api from "../src/index.js";
import type { UsageRecord } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const usage = (): UsageRecord[] =>
  parseUsage(readFileSync(join(here, "..", "fixtures", "usage.jsonl"), "utf8"));

const attr = (span: { attributes: api.OtlpSpan["attributes"] }, key: string) =>
  span.attributes.find((a) => a.key === key)?.value;

describe("price resolution", () => {
  it("matches an exact model id", () => {
    expect(resolvePrice("gpt-4o", DEFAULT_PRICES)?.key).toBe("gpt-4o");
  });
  it("falls back to the longest substring key", () => {
    const r = resolvePrice("gpt-4o-2024-11-20", DEFAULT_PRICES);
    expect(r?.key).toBe("gpt-4o");
  });
  it("returns undefined for an unknown model", () => {
    expect(resolvePrice("llama-3-70b", DEFAULT_PRICES)).toBeUndefined();
  });
});

describe("computeCost", () => {
  it("computes input+output cost per million tokens", () => {
    const c = computeCost(
      { provider: "anthropic", model: "claude-opus-4-7", inputTokens: 1_000_000, outputTokens: 1_000_000 },
      DEFAULT_PRICES
    );
    expect(c.inputCost).toBe(15);
    expect(c.outputCost).toBe(75);
    expect(c.totalCost).toBe(90);
    expect(c.unpriced).toBe(false);
    expect(c.pricedAs).toBe("claude-opus-4");
  });

  it("flags unpriced models with zero cost", () => {
    const c = computeCost(
      { provider: "x", model: "mystery-model", inputTokens: 1000, outputTokens: 1000 },
      DEFAULT_PRICES
    );
    expect(c.unpriced).toBe(true);
    expect(c.totalCost).toBe(0);
  });

  it("respects a custom price table override", () => {
    const c = computeCost(
      { provider: "x", model: "my-model", inputTokens: 1_000_000, outputTokens: 0 },
      { "my-model": { inputPerMTok: 2, outputPerMTok: 9 } }
    );
    expect(c.inputCost).toBe(2);
  });
});

describe("toSpan", () => {
  const rec: UsageRecord = {
    provider: "anthropic",
    model: "claude-opus-4-7",
    operation: "chat",
    inputTokens: 100,
    outputTokens: 50,
    startTime: 1_700_000_000_000,
    durationMs: 1000,
    responseModel: "claude-opus-4-7"
  };
  const span = toSpan(rec, computeCost(rec, DEFAULT_PRICES));

  it("uses the OTel GenAI attribute names", () => {
    expect(attr(span, "gen_ai.provider.name")).toEqual({ stringValue: "anthropic" });
    expect(attr(span, "gen_ai.request.model")).toEqual({ stringValue: "claude-opus-4-7" });
    expect(attr(span, "gen_ai.operation.name")).toEqual({ stringValue: "chat" });
    expect(attr(span, "gen_ai.usage.input_tokens")).toEqual({ intValue: "100" });
    expect(attr(span, "gen_ai.usage.output_tokens")).toEqual({ intValue: "50" });
    expect(attr(span, "gen_ai.response.model")).toEqual({ stringValue: "claude-opus-4-7" });
  });

  it("names the span '{operation} {model}' and is CLIENT kind", () => {
    expect(span.name).toBe("chat claude-opus-4-7");
    expect(span.kind).toBe(3);
  });

  it("computes end time from start + duration in nanos", () => {
    const start = BigInt(span.startTimeUnixNano);
    const end = BigInt(span.endTimeUnixNano);
    expect(end - start).toBe(1_000_000_000n); // 1000ms in nanos
  });

  it("generates trace/span ids when absent", () => {
    const s = toSpan({ provider: "p", model: "m", inputTokens: 1, outputTokens: 1 }, computeCost({ provider: "p", model: "m", inputTokens: 1, outputTokens: 1 }, DEFAULT_PRICES));
    expect(s.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(s.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("marks unpriced spans", () => {
    const r: UsageRecord = { provider: "p", model: "unknown", inputTokens: 1, outputTokens: 1 };
    const s = toSpan(r, computeCost(r, DEFAULT_PRICES));
    expect(attr(s, "gen_ai.usage.cost_unpriced")).toEqual({ stringValue: "true" });
  });
});

describe("exportSpans + summarize", () => {
  const result = exportSpans(usage());

  it("wraps spans in an OTLP resourceSpans envelope", () => {
    const spans = result.otlp.resourceSpans[0]!.scopeSpans[0]!.spans;
    expect(spans).toHaveLength(4);
    expect(result.otlp.resourceSpans[0]!.scopeSpans[0]!.scope.name).toBe(
      "llm-cost-span-exporter"
    );
  });

  it("summarizes totals and flags unpriced models", () => {
    const s = result.summary;
    expect(s.records).toBe(4);
    expect(s.totalInputTokens).toBe(37800);
    expect(s.totalCost).toBeGreaterThan(0);
    expect(s.unpricedRecords).toBe(1); // text-embedding-3-large is not in the table
    expect(s.byModel["text-embedding-3-large"]!.unpriced).toBe(true);
  });

  it("throws on non-array input", () => {
    expect(() => exportSpans(null as unknown as UsageRecord[])).toThrow(/array/);
  });

  it("throws when token counts are not numbers", () => {
    expect(() =>
      exportSpans([{ provider: "p", model: "gpt-4o", inputTokens: "x" } as unknown as UsageRecord])
    ).toThrow(/numeric/);
  });
});

describe("parseUsage", () => {
  it("parses a JSON array", () => {
    expect(parseUsage('[{"provider":"p","model":"gpt-4o","inputTokens":1,"outputTokens":1}]')).toHaveLength(1);
  });
  it("parses a single JSON object", () => {
    expect(parseUsage('{"provider":"p","model":"gpt-4o","inputTokens":1,"outputTokens":1}')).toHaveLength(1);
  });
  it("parses JSONL", () => {
    expect(parseUsage(usage().map((u) => JSON.stringify(u)).join("\n"))).toHaveLength(4);
  });
  it("throws on a bad JSONL line", () => {
    expect(() => parseUsage('{"ok":1}\n{bad')).toThrow(/line 2/);
  });
});

describe("public API (index barrel)", () => {
  it("re-exports the surface", () => {
    expect(typeof api.exportSpans).toBe("function");
    expect(typeof api.computeCost).toBe("function");
    expect(typeof api.resolvePrice).toBe("function");
    expect(api.DEFAULT_PRICES["gpt-4o"]).toBeDefined();
  });
});
