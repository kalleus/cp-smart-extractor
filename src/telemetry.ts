// ─────────────────────────────────────────────
//  Telemetry — Structured JSON logging
//  Pipes to stdout so Railway / Render / Fly.io
//  log aggregators pick it up automatically.
//  Extend to push to Axiom, Datadog, etc.
// ─────────────────────────────────────────────

import type { TelemetryRecord } from "./types.js";

// In-memory rolling counters (reset on restart; replace with Redis for persistence)
const counters = {
  total: 0,
  success: 0,
  failure: 0,
};

export function getCounters() {
  return { ...counters };
}

/**
 * Emit a structured telemetry record to stdout.
 * Each line is valid JSON — trivial to ingest into any log platform.
 */
export function recordTelemetry(record: TelemetryRecord): void {
  // Update in-memory counters
  counters.total += 1;
  if (record.success) {
    counters.success += 1;
  } else {
    counters.failure += 1;
  }

  const line = JSON.stringify({
    level: record.success ? "info" : "warn",
    event: "extraction",
    ...record,
    successRate:
      counters.total > 0
        ? `${((counters.success / counters.total) * 100).toFixed(1)}%`
        : "n/a",
  });

  process.stdout.write(line + "\n");
}

/**
 * Log a startup / lifecycle event.
 */
export function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  extra?: Record<string, unknown>
): void {
  process.stdout.write(
    JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...extra }) + "\n"
  );
}
