// ─────────────────────────────────────────────
//  Types — mcp-web-extractor
// ─────────────────────────────────────────────

export interface ExtractorInput {
  url: string;
  schema: Record<string, unknown>;
  prompt?: string;
  timeout?: number; // ms, default 30_000
}

export interface ExtractionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  metadata: {
    url: string;
    durationMs: number;
    timestamp: string;
    requestId: string;
  };
}

export interface TelemetryRecord {
  requestId: string;
  apiKeyHash: string;
  url: string;
  success: boolean;
  durationMs: number;
  errorType?: string;
  timestamp: string;
}

export interface AuthContext {
  apiKeyHash: string;
  isValid: boolean;
}
