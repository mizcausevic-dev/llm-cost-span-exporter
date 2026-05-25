import { randomBytes } from "node:crypto";

import type {
  CostBreakdown,
  OtlpAttribute,
  OtlpSpan,
  UsageRecord
} from "./types.js";

const SPAN_KIND_CLIENT = 3;

const hex = (bytes: number): string => randomBytes(bytes).toString("hex");

function startNano(record: UsageRecord): bigint {
  if (record.startTime === undefined) return BigInt(Date.now()) * 1_000_000n;
  if (typeof record.startTime === "number") {
    return BigInt(Math.trunc(record.startTime)) * 1_000_000n;
  }
  const ms = Date.parse(record.startTime);
  return Number.isNaN(ms)
    ? BigInt(Date.now()) * 1_000_000n
    : BigInt(ms) * 1_000_000n;
}

const strAttr = (key: string, v: string): OtlpAttribute => ({
  key,
  value: { stringValue: v }
});
const intAttr = (key: string, v: number): OtlpAttribute => ({
  key,
  value: { intValue: String(Math.trunc(v)) }
});
const dblAttr = (key: string, v: number): OtlpAttribute => ({
  key,
  value: { doubleValue: v }
});

/**
 * Build an OTLP span for one usage record. GenAI attributes follow the OTel
 * semantic conventions; cost attributes are a documented non-standard
 * extension (`gen_ai.usage.cost*`) since OTel has no official cost attribute.
 */
export function toSpan(record: UsageRecord, cost: CostBreakdown): OtlpSpan {
  const operation = record.operation ?? "chat";
  const start = startNano(record);
  const end = start + BigInt(Math.max(0, record.durationMs ?? 0)) * 1_000_000n;

  const attributes: OtlpAttribute[] = [
    strAttr("gen_ai.provider.name", record.provider),
    strAttr("gen_ai.operation.name", operation),
    strAttr("gen_ai.request.model", record.model),
    intAttr("gen_ai.usage.input_tokens", record.inputTokens),
    intAttr("gen_ai.usage.output_tokens", record.outputTokens),
    dblAttr("gen_ai.usage.cost", cost.totalCost),
    dblAttr("gen_ai.usage.input_cost", cost.inputCost),
    dblAttr("gen_ai.usage.output_cost", cost.outputCost),
    strAttr("gen_ai.usage.cost_currency", cost.currency)
  ];
  if (record.responseModel) {
    attributes.push(strAttr("gen_ai.response.model", record.responseModel));
  }
  if (cost.unpriced) {
    attributes.push({ key: "gen_ai.usage.cost_unpriced", value: { stringValue: "true" } });
  }

  return {
    traceId: record.traceId ?? hex(16),
    spanId: record.spanId ?? hex(8),
    name: `${operation} ${record.model}`,
    kind: SPAN_KIND_CLIENT,
    startTimeUnixNano: start.toString(),
    endTimeUnixNano: end.toString(),
    attributes
  };
}
