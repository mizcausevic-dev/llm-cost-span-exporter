import { resolvePrice } from "./prices.js";
import type { CostBreakdown, PriceTable, UsageRecord } from "./types.js";

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Compute the USD cost of one usage record against a price table. */
export function computeCost(
  record: UsageRecord,
  table: PriceTable
): CostBreakdown {
  const resolved = resolvePrice(record.model, table);
  if (!resolved) {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      currency: "USD",
      unpriced: true
    };
  }
  const { price, key } = resolved;
  const inputCost = round((record.inputTokens / 1_000_000) * price.inputPerMTok);
  const outputCost = round(
    (record.outputTokens / 1_000_000) * price.outputPerMTok
  );
  return {
    inputCost,
    outputCost,
    totalCost: round(inputCost + outputCost),
    currency: "USD",
    unpriced: false,
    pricedAs: key
  };
}
