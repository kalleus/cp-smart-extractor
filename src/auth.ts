// ─────────────────────────────────────────────
//  Auth — API Key Validation
//  Replace validateKey() body to integrate with
//  Stripe, Zuplo, or your own DB.
// ─────────────────────────────────────────────

import crypto from "crypto";
import type { AuthContext } from "./types.js";

/**
 * Hashes a raw API key for safe storage in logs (never log the raw key).
 */
export function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

/**
 * Core validation function.
 *
 * INTEGRATION POINT — swap the body for your billing provider:
 *
 *  Stripe:  Check customer metadata via stripe.customers.search()
 *  Zuplo:   Zuplo handles this at the gateway layer; trust the forwarded header
 *  Custom:  Query your DB: SELECT active FROM api_keys WHERE key_hash = ?
 */
async function validateKey(rawKey: string): Promise<boolean> {
  // ── DEVELOPMENT / DEMO ────────────────────────────────────────────────────
  // Accepts any key that starts with "mwex_" — replace with real logic below.
  if (process.env.NODE_ENV === "development") {
    return rawKey.startsWith("mwex_");
  }

  // ── PRODUCTION EXAMPLE (uncomment + adapt) ───────────────────────────────
  // const keyHash = hashKey(rawKey);
  // const row = await db.query(
  //   "SELECT active FROM api_keys WHERE key_hash = $1 LIMIT 1",
  //   [keyHash]
  // );
  // return row?.active === true;

  // ── ENVIRONMENT VARIABLE ALLOWLIST (simple single-tenant setup) ──────────
  const allowedKeys = (process.env.ALLOWED_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return allowedKeys.includes(rawKey);
}

/**
 * Extracts and validates the API key from an MCP tool arguments object.
 * Expects callers to pass `{ api_key: "mwex_..." }` in their tool arguments.
 */
export async function authenticate(
  args: Record<string, unknown>
): Promise<AuthContext> {
  const rawKey = typeof args.api_key === "string" ? args.api_key : "";

  if (!rawKey) {
    return { apiKeyHash: "none", isValid: false };
  }

  const isValid = await validateKey(rawKey);
  return { apiKeyHash: hashKey(rawKey), isValid };
}
