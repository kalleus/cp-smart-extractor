# 🔌 MCP Web Extractor

**Turn any URL into structured JSON — with a single tool call.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

---

## Why Your AI Agent Needs This

Most web data is **unstructured** — HTML soup, JavaScript-rendered SPAs, paywalled layouts. Your agent shouldn't have to parse it.

**MCP Web Extractor** gives any MCP-compatible AI agent a single, powerful tool:

> *"Extract this webpage into the exact JSON structure I need."*

It handles everything your agent can't easily do itself:

| Problem | What MCP Web Extractor Does |
|---|---|
| JS-rendered pages (React, Vue, Angular) | Runs a real Chromium browser via Playwright |
| Inconsistent HTML structures | Uses an LLM to understand content semantically |
| You need specific fields, not raw text | You define the exact JSON schema you want back |
| Multiple simultaneous scrapes | Concurrency-controlled — won't crash under load |
| Production accountability | Structured JSON telemetry on every request |

**Ideal use-cases:** competitive price monitoring · lead enrichment · news aggregation · product data pipelines · research automation.

---

## Features

- ✅ **Real browser rendering** — Playwright/Chromium handles JavaScript-heavy pages
- ✅ **Schema-driven extraction** — you define the output shape; the LLM fills it
- ✅ **API key authentication** — ready to gate behind Stripe or Zuplo
- ✅ **Concurrency control** — async semaphore prevents resource exhaustion
- ✅ **Structured telemetry** — JSON logs, success/failure counters, request IDs
- ✅ **Railway-ready** — multi-stage Dockerfile included
- ✅ **TypeScript** — fully typed, zero `any` leakage

---

## Tools Exposed

### `extract_structured_data`

Fetches a URL with a real browser and extracts data into your JSON schema.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `api_key` | `string` | ✅ | Your MCP Web Extractor API key |
| `url` | `string` | ✅ | Full URL to scrape (`https://...`) |
| `schema` | `object` | ✅ | JSON object describing desired output fields |
| `prompt` | `string` | ❌ | Extra extraction instructions |
| `timeout` | `number` | ❌ | Page load timeout in ms (default: `30000`) |

**Example call:**

```json
{
  "tool": "extract_structured_data",
  "arguments": {
    "api_key": "mwex_your_key",
    "url": "https://example.com/product/123",
    "schema": {
      "product_name": "string",
      "price_gbp": "number",
      "in_stock": "boolean",
      "description": "string",
      "image_url": "string"
    }
  }
}
```

**Example response:**

```json
{
  "success": true,
  "data": {
    "product_name": "Wireless Noise-Cancelling Headphones",
    "price_gbp": 79.99,
    "in_stock": true,
    "description": "Premium over-ear headphones with 30-hour battery life.",
    "image_url": "https://example.com/images/headphones.jpg"
  },
  "metadata": {
    "url": "https://example.com/product/123",
    "durationMs": 4821,
    "timestamp": "2026-03-17T10:00:00.000Z",
    "requestId": "a3f7c812-..."
  }
}
```

---

### `get_usage_stats`

Returns live telemetry counters. Useful for dashboards and monitoring.

```json
{
  "tool": "get_usage_stats",
  "arguments": { "api_key": "mwex_your_key" }
}
```

**Response:**

```json
{
  "success": true,
  "stats": {
    "total": 142,
    "success": 138,
    "failure": 4,
    "successRate": "97.2%"
  }
}
```

---

## Setup Guide

### Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)
- (For cloud deployment) A [Railway.app](https://railway.app) account

### Option A — Local / Claude Desktop

**1. Clone and install**

```bash
git clone https://github.com/your-username/mcp-web-extractor.git
cd mcp-web-extractor
npm install
npm run build
```

**2. Configure environment**

```bash
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY and ALLOWED_API_KEYS
```

**3. Register with Claude Desktop**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "web-extractor": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-web-extractor/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "ALLOWED_API_KEYS": "mwex_your_key",
        "MAX_CONCURRENT": "3"
      }
    }
  }
}
```

**4. Restart Claude Desktop.** The tool will appear in Claude's tool list.

---

### Option B — Railway.app (Cloud / Production)

**1. Push to GitHub**

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/your-username/mcp-web-extractor.git
git push -u origin main
```

**2. Create Railway project**

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select your repository
3. Railway detects the `Dockerfile` automatically

**3. Set environment variables** in Railway's dashboard:

```
ANTHROPIC_API_KEY   = sk-ant-...
ALLOWED_API_KEYS    = mwex_key1,mwex_key2
MAX_CONCURRENT      = 5
NODE_ENV            = production
```

**4. Deploy.** Railway builds the Docker image and starts the server.

**5. Connect your MCP host** using Railway's generated URL as the server endpoint.

---

### Option C — Docker (any provider)

```bash
docker build -t mcp-web-extractor .

docker run -d \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e ALLOWED_API_KEYS=mwex_your_key \
  -e MAX_CONCURRENT=5 \
  mcp-web-extractor
```

---

## Billing Integration

### Integrating with Zuplo (API Gateway)

Zuplo can handle API key validation at the gateway layer. Set `NODE_ENV=development` and remove per-request key checking — Zuplo's middleware validates before the request reaches your server.

### Integrating with Stripe

Replace the `validateKey()` function body in `src/auth.ts`:

```typescript
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function validateKey(rawKey: string): Promise<boolean> {
  const customers = await stripe.customers.search({
    query: `metadata["api_key"]:"${rawKey}"`,
  });
  const customer = customers.data[0];
  return customer?.metadata?.active === "true";
}
```

### Integrating with a Database (e.g. Postgres / Supabase)

```typescript
async function validateKey(rawKey: string): Promise<boolean> {
  const keyHash = hashKey(rawKey);
  const { data } = await supabase
    .from("api_keys")
    .select("active")
    .eq("key_hash", keyHash)
    .single();
  return data?.active === true;
}
```

---

## Architecture

```
MCP Host (Claude, Cursor, etc.)
        │
        │  stdio / JSON-RPC
        ▼
┌──────────────────────────────────┐
│         MCP Web Extractor         │
│                                  │
│  ┌─────────┐   ┌──────────────┐  │
│  │  Auth   │   │  Telemetry   │  │
│  └────┬────┘   └──────┬───────┘  │
│       │               │          │
│  ┌────▼───────────────▼───────┐  │
│  │        Extractor            │  │
│  │  ┌───────────┐             │  │
│  │  │ Semaphore │ (concurrency)│  │
│  │  └─────┬─────┘             │  │
│  │        │                   │  │
│  │  ┌─────▼──────┐            │  │
│  │  │ Playwright  │ (browser)  │  │
│  │  └─────┬──────┘            │  │
│  │        │                   │  │
│  │  ┌─────▼──────┐            │  │
│  │  │ Anthropic  │ (LLM)      │  │
│  │  └────────────┘            │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

---

## Performance Tuning

| Railway Plan | RAM | Recommended `MAX_CONCURRENT` |
|---|---|---|
| Hobby | 512 MB | 1–2 |
| Pro | 2 GB | 3–4 |
| Pro | 4 GB | 5–8 |
| Pro | 8 GB | 10+ |

Chromium uses ~150–300 MB per concurrent browser context. Tune `MAX_CONCURRENT` to leave headroom for Node.js itself.

---

## Telemetry Log Format

Every request emits a single JSON line to stdout:

```json
{
  "level": "info",
  "event": "extraction",
  "requestId": "a3f7c812-4d2e-...",
  "apiKeyHash": "3f2a1b4c...",
  "url": "https://example.com/product",
  "success": true,
  "durationMs": 4821,
  "timestamp": "2026-03-17T10:00:00.000Z",
  "successRate": "97.2%"
}
```

`apiKeyHash` is a truncated SHA-256 of the raw key — safe to log, impossible to reverse.

---

## FAQ

**Q: Does it work on paywalled or login-required pages?**
Not by default. You'd need to extend `extractor.ts` to inject session cookies or handle authentication flows.

**Q: How accurate is the extraction?**
Highly accurate for well-structured pages (product pages, news articles, business directories). Complex or ambiguous layouts may need a `prompt` hint.

**Q: Can I swap out Claude for a different LLM?**
Yes — `extractor.ts` uses the Anthropic SDK directly. Replace with OpenAI, Gemini, or any provider by swapping the client in that file.

**Q: What happens if the page fails to load?**
A structured error response is returned with `success: false` and a descriptive `error` field. The telemetry counter increments the failure count.

---

## License

MIT © [Your Name](https://your-domain.com)

---

*Built to be listed on [Glama.ai](https://glama.ai) and [Composio](https://composio.dev).*
