import { computeCost } from "./cost.js";
import { DEFAULT_PRICES } from "./prices.js";
import { toSpan } from "./span.js";
import type {
  CostSummary,
  ExportResult,
  OtlpSpan,
  PriceTable,
  UsageRecord
} from "./types.js";

const SCOPE = { name: "llm-cost-span-exporter", version: "0.1.0" };

export interface ExportOptions {
  /** Price table; defaults to the built-in indicative list. */
  prices?: PriceTable;
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

export function summarize(
  records: UsageRecord[],
  table: PriceTable
): CostSummary {
  const summary: CostSummary = {
    records: records.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    currency: "USD",
    unpricedRecords: 0,
    byModel: {}
  };
  for (const r of records) {
    const cost = computeCost(r, table);
    summary.totalInputTokens += r.inputTokens;
    summary.totalOutputTokens += r.outputTokens;
    summary.totalCost = round(summary.totalCost + cost.totalCost);
    if (cost.unpriced) summary.unpricedRecords++;
    const m = (summary.byModel[r.model] ??= {
      records: 0,
      cost: 0,
      unpriced: false
    });
    m.records++;
    m.cost = round(m.cost + cost.totalCost);
    if (cost.unpriced) m.unpriced = true;
  }
  return summary;
}

/** Turn usage records into OTLP spans + a cost summary. */
export function exportSpans(
  records: UsageRecord[],
  opts: ExportOptions = {}
): ExportResult {
  if (!Array.isArray(records)) {
    throw new Error("records must be an array of usage records");
  }
  const table = opts.prices ?? DEFAULT_PRICES;
  const spans: OtlpSpan[] = records.map((r) => {
    if (typeof r.inputTokens !== "number" || typeof r.outputTokens !== "number") {
      throw new Error(
        `record for model "${r.model ?? "?"}" needs numeric inputTokens/outputTokens`
      );
    }
    return toSpan(r, computeCost(r, table));
  });
  return {
    otlp: { resourceSpans: [{ scopeSpans: [{ scope: SCOPE, spans }] }] },
    summary: summarize(records, table)
  };
}
