#!/usr/bin/env node
// ─────────────────────────────────────────────
//  MCP Web Extractor — Main Server
//  Transport: stdio (compatible with all MCP hosts)
// ─────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { authenticate } from "./auth.js";
import { extract, closeBrowser } from "./extractor.js";
import { recordTelemetry, logEvent, getCounters } from "./telemetry.js";
import type { ExtractorInput } from "./types.js";

// ── Server metadata ──────────────────────────────────────────────────────────
const server = new Server(
  {
    name: "mcp-web-extractor",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

// ── Tool definitions (what MCP hosts display to users/agents) ────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "extract_structured_data",
      description:
        "Fetches any public URL using a real browser (Playwright) and uses an LLM to extract data into a JSON structure you define. Handles JavaScript-rendered pages, SPAs, and dynamic content automatically.",
      inputSchema: {
        type: "object",
        properties: {
          api_key: {
            type: "string",
            description: "Your MCP Web Extractor API key (prefix: mwex_)",
          },
          url: {
            type: "string",
            description: "The fully-qualified URL to scrape (must include https://)",
          },
          schema: {
            type: "object",
            description:
              "A JSON object describing the fields you want extracted. Use descriptive key names; values become hints (e.g. { 'product_name': 'string', 'price_usd': 'number' })",
          },
          prompt: {
            type: "string",
            description:
              "(Optional) Extra instructions for the extractor, e.g. 'Focus only on the first product listing'",
          },
          timeout: {
            type: "number",
            description: "(Optional) Page load timeout in milliseconds. Default: 30000",
          },
        },
        required: ["api_key", "url", "schema"],
      },
    },
    {
      name: "get_usage_stats",
      description:
        "Returns live success/failure telemetry counters for your API key. Useful for monitoring integrations.",
      inputSchema: {
        type: "object",
        properties: {
          api_key: {
            type: "string",
            description: "Your MCP Web Extractor API key",
          },
        },
        required: ["api_key"],
      },
    },
  ],
}));

// ── Tool handlers ────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  // ── Auth gate (applies to ALL tools) ────────────────────────────────────
  const auth = await authenticate(args as Record<string, unknown>);
  if (!auth.isValid) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Unauthorized",
            message:
              "Invalid or missing API key. Obtain a key at https://your-domain.com/dashboard",
          }),
        },
      ],
      isError: true,
    };
  }

  // ── Tool: extract_structured_data ────────────────────────────────────────
  if (name === "extract_structured_data") {
    const input: ExtractorInput = {
      url: args.url as string,
      schema: args.schema as Record<string, unknown>,
      prompt: args.prompt as string | undefined,
      timeout: args.timeout as number | undefined,
    };

    const result = await extract(input);

    // Telemetry
    recordTelemetry({
      requestId: result.metadata.requestId,
      apiKeyHash: auth.apiKeyHash,
      url: input.url,
      success: result.success,
      durationMs: result.metadata.durationMs,
      errorType: result.success ? undefined : "extraction_error",
      timestamp: result.metadata.timestamp,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }

  // ── Tool: get_usage_stats ────────────────────────────────────────────────
  if (name === "get_usage_stats") {
    const counters = getCounters();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              stats: {
                ...counters,
                successRate:
                  counters.total > 0
                    ? `${((counters.success / counters.total) * 100).toFixed(1)}%`
                    : "n/a",
              },
              note: "Counters reset on server restart. Persistent metrics require Redis integration.",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
    isError: true,
  };
});

// ── Startup & graceful shutdown ──────────────────────────────────────────────
async function main() {
  logEvent("info", "MCP Web Extractor starting", {
    version: "1.0.0",
    maxConcurrent: process.env.MAX_CONCURRENT ?? "5",
    nodeEnv: process.env.NODE_ENV ?? "production",
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logEvent("info", "Server connected and ready");
}

// Cleanup browser on exit
process.on("SIGINT", async () => {
  logEvent("info", "Shutting down...");
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logEvent("info", "Shutting down (SIGTERM)...");
  await closeBrowser();
  process.exit(0);
});

main().catch((err) => {
  logEvent("error", "Fatal startup error", { error: (err as Error).message });
  process.exit(1);
});
