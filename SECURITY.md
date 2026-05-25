# Security Policy

`llm-cost-span-exporter` is an offline transformer. It reads usage records and a
price table you provide and emits OTLP/JSON. It performs no network calls and
does not invoke any LLM or telemetry endpoint — shipping the emitted spans to an
OTLP collector is the caller's responsibility.

The built-in price table is **indicative and point-in-time**; do not treat its
computed costs as authoritative billing. Override it with current prices.

## Supported versions

Only the latest tagged release is supported.

## Reporting a vulnerability

Please use GitHub Security Advisories for private disclosure:

- [Open a security advisory](https://github.com/mizcausevic-dev/llm-cost-span-exporter/security/advisories/new)

Do not file public issues for security reports.
