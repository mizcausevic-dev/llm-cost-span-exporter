import type { ModelPrice, PriceTable } from "./types.js";

// INDICATIVE default list prices (USD per 1M tokens), point-in-time.
// Prices change often — override with your own table (CLI: --prices file.json).
// Unknown models are reported as `unpriced` rather than silently costed at 0.
export const DEFAULT_PRICES: PriceTable = {
  // Anthropic
  "claude-opus-4": { inputPerMTok: 15, outputPerMTok: 75 },
  "claude-sonnet-4": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4": { inputPerMTok: 0.8, outputPerMTok: 4 },
  "claude-3-5-sonnet": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-3-5-haiku": { inputPerMTok: 0.8, outputPerMTok: 4 },
  // OpenAI
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "o3-mini": { inputPerMTok: 1.1, outputPerMTok: 4.4 },
  // Google
  "gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10 },
  "gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 }
};

/**
 * Resolve a price for a model id: exact match first, then the longest
 * price-table key that is a substring of the model id (so "gpt-4o-2024-11"
 * resolves via "gpt-4o"). Returns the matched key alongside the price.
 */
export function resolvePrice(
  model: string,
  table: PriceTable
): { price: ModelPrice; key: string } | undefined {
  const exact = table[model];
  if (exact) return { price: exact, key: model };

  let best: { price: ModelPrice; key: string } | undefined;
  for (const key of Object.keys(table)) {
    if (model.includes(key) && (!best || key.length > best.key.length)) {
      const p = table[key];
      if (p) best = { price: p, key };
    }
  }
  return best;
}
