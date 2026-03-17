// ─────────────────────────────────────────────
//  Extractor — Playwright + LLM Pipeline
// ─────────────────────────────────────────────

import { chromium, type Browser } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import { globalSemaphore } from "./concurrency.js";
import type { ExtractorInput, ExtractionResult } from "./types.js";
import { v4 as uuidv4 } from "uuid";

// ── Singletons (created once, reused across requests) ──────────────────────
let browser: Browser | null = null;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // critical for Docker/Railway
        "--disable-gpu",
      ],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser?.isConnected()) await browser.close();
  browser = null;
}

// ── Main extraction function ────────────────────────────────────────────────
export async function extract(input: ExtractorInput): Promise<ExtractionResult> {
  const requestId = uuidv4();
  const start = Date.now();
  const timeout = input.timeout ?? 30_000;

  return globalSemaphore.run(async () => {
    let pageContent = "";

    // ── Step 1: Fetch page with Playwright ──────────────────────────────────
    const b = await getBrowser();
    const context = await b.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; StructuredExtractBot/1.0; +https://your-domain.com/bot)",
      javaScriptEnabled: true,
    });
    const page = await context.newPage();

    try {
      await page.goto(input.url, {
        waitUntil: "domcontentloaded",
        timeout,
      });

      // Wait a beat for JS-heavy pages to render
      await page.waitForTimeout(1500);

      // Extract readable text (strip nav/footer noise)
      pageContent = await page.evaluate(() => {
        const remove = document.querySelectorAll(
          "script, style, nav, footer, header, iframe, noscript"
        );
        remove.forEach((el) => el.remove());
        return document.body?.innerText?.trim() ?? "";
      });

      // Truncate to ~60k chars to stay within LLM context limits
      if (pageContent.length > 60_000) {
        pageContent = pageContent.slice(0, 60_000) + "\n\n[TRUNCATED]";
      }
    } catch (err) {
      await context.close();
      return {
        success: false,
        error: `Page fetch failed: ${(err as Error).message}`,
        metadata: {
          url: input.url,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    } finally {
      await context.close();
    }

    // ── Step 2: LLM Extraction ───────────────────────────────────────────────
    const schemaStr = JSON.stringify(input.schema, null, 2);
    const userPrompt = input.prompt
      ? `Additional instructions: ${input.prompt}\n\n`
      : "";

    const systemPrompt = `You are a precise data extraction engine.
You will receive raw webpage text and a target JSON schema.
Your ONLY output must be a single valid JSON object that matches the schema exactly.
Do not add commentary, markdown fences, or any text outside the JSON object.
If a field cannot be found, use null.`;

    const userMessage = `${userPrompt}TARGET SCHEMA:
\`\`\`json
${schemaStr}
\`\`\`

WEBPAGE CONTENT (from ${input.url}):
${pageContent}

Return the populated JSON object now:`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const rawText =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Strip accidental markdown fences if the model adds them
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        success: true,
        data: parsed,
        metadata: {
          url: input.url,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `LLM extraction failed: ${(err as Error).message}`,
        metadata: {
          url: input.url,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    }
  });
}
