// Types for LLM usage records and the OpenTelemetry GenAI spans / cost output.
// Attribute names follow the OTel GenAI semantic conventions:
// https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/

/** One LLM call's usage, the input to this exporter. */
export interface UsageRecord {
  /** OTel gen_ai.provider.name — e.g. "anthropic", "openai", "gcp.vertex_ai". */
  provider: string;
  /** OTel gen_ai.request.model — e.g. "claude-opus-4-7". */
  model: string;
  /** OTel gen_ai.response.model, if it differs from the requested model. */
  responseModel?: string;
  /** OTel gen_ai.operation.name — e.g. "chat", "embeddings". Default "chat". */
  operation?: string;
  /** OTel gen_ai.usage.input_tokens. */
  inputTokens: number;
  /** OTel gen_ai.usage.output_tokens. */
  outputTokens: number;
  /** RFC3339 / epoch-ms start time. Optional. */
  startTime?: string | number;
  /** Wall-clock duration in ms. Optional. */
  durationMs?: number;
  /** Hex trace/span ids to thread into an existing trace. Optional. */
  traceId?: string;
  spanId?: string;
}

/** USD price per 1,000,000 tokens, split by direction. */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

/** Lookup keyed by model id (exact) or a substring matched as a fallback. */
export type PriceTable = Record<string, ModelPrice>;

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: "USD";
  /** True when no price was found for the model — cost is 0 and not trustworthy. */
  unpriced: boolean;
  /** The price-table key that matched, when any. */
  pricedAs?: string;
}

export interface CostSummary {
  records: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  currency: "USD";
  unpricedRecords: number;
  byModel: Record<string, { records: number; cost: number; unpriced: boolean }>;
}

/** Minimal OTLP/JSON span (subset sufficient for ingestion). */
export interface OtlpAttribute {
  key: string;
  value:
    | { stringValue: string }
    | { intValue: string }
    | { doubleValue: number };
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind: number; // SPAN_KIND_CLIENT = 3
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
}

export interface OtlpExport {
  resourceSpans: Array<{
    scopeSpans: Array<{
      scope: { name: string; version: string };
      spans: OtlpSpan[];
    }>;
  }>;
}

export interface ExportResult {
  otlp: OtlpExport;
  summary: CostSummary;
}
