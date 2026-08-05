import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Tried in order. Both are OpenRouter's free tier. Llama 3.3 goes first (fast,
// reliably honors response_format). DeepSeek R1 Distill is the fallback if
// Llama errors, times out, or is rate-limited — free models on OpenRouter
// share capacity, so having a second option meaningfully improves uptime.
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
];

interface CategoryInput {
  id: string;
  name: string;
}

interface ParseRequestBody {
  userInput?: unknown;
  categories?: unknown;
  /** Optional client override — tried first, before the built-in fallback list. */
  model?: unknown;
}

interface ParseResult {
  type: "CREDIT" | "DEBIT";
  amount: number;
  categoryId: string;
  description: string;
  confidence: number;
}

function isValidBody(
  body: ParseRequestBody,
): body is { userInput: string; categories: CategoryInput[]; model?: string } {
  if (typeof body.userInput !== "string" || !body.userInput.trim()) return false;
  if (!Array.isArray(body.categories)) return false;
  if (body.model !== undefined && typeof body.model !== "string") return false;
  return body.categories.every(
    (c) =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as CategoryInput).id === "string" &&
      typeof (c as CategoryInput).name === "string",
  );
}

/**
 * R1-distill-style reasoning models sometimes emit a chain-of-thought preamble
 * (e.g. wrapped in <think>...</think>, or just prose) before the actual JSON,
 * even when response_format asks for JSON only. Try a direct parse first
 * (what Llama 3.3 gives us), and fall back to extracting the outermost
 * {...} span if that fails.
 */
function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found in model output");
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function callModel(
  model: string,
  apiKey: string,
  prompt: string,
  signal: AbortSignal,
): Promise<Partial<ParseResult> | null> {
  const upstream = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/Dannyboy1506",
      "X-Title": "AI Personal Finance",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a strict JSON extraction engine. Return only valid JSON, with no reasoning, preamble, or markdown fences.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.1,
    }),
  });

  if (!upstream.ok) return null;

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return extractJson(content) as Partial<ParseResult>;
  } catch {
    return null;
  }
}

/**
 * Tier 2: OpenRouter fast AI parsing, proxied server-side.
 * The client never sees OPENROUTER_API_KEY — it lives only in this process's env.
 */
router.post("/parse", async (req: Request, res: Response) => {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "Tier 2 is not configured on the server." });
    return;
  }

  const body = req.body as ParseRequestBody;
  if (!isValidBody(body)) {
    res.status(400).json({ error: "userInput (string) and categories (array) are required." });
    return;
  }

  const { userInput, categories, model: modelOverride } = body;
  const categoryList = categories.map((c) => `"${c.name}" (id: ${c.id})`).join(", ");

  const prompt = `You are a precise bank transaction parser for a personal finance app.
Convert this user text into structured JSON.

User Input: "${userInput}"

Available Categories:
${categoryList}

Rules:
- type: "CREDIT" for money received (salary, refunds, deposits), "DEBIT" for spending
- amount: positive number only
- categoryId: use exactly one id from the list above
- description: cleaned up version of the input
- confidence: 0.0–1.0

Return ONLY valid JSON (no markdown, no reasoning):
{"type":"CREDIT or DEBIT","amount":number,"categoryId":"string","description":"string","confidence":number}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let parsed: Partial<ParseResult> | null = null;
    let lastError: unknown = null;

    // A client-supplied model is tried first (for testing/switching), then
    // the built-in list is still tried after it as a safety net if it fails —
    // an override never makes the request "only try one model and give up".
    const attemptOrder = modelOverride ? [modelOverride, ...MODELS] : MODELS;

    for (const model of attemptOrder) {
      try {
        parsed = await callModel(model, apiKey, prompt, controller.signal);
        if (parsed) break;
      } catch (err) {
        lastError = err;
        // try the next model
      }
    }

    clearTimeout(timeout);

    if (!parsed) {
      if (lastError instanceof Error && lastError.name === "AbortError") {
        res.status(504).json({ error: "Tier 2 request timed out." });
        return;
      }
      res.status(502).json({ error: "Tier 2 upstream request failed on all available models." });
      return;
    }

    if (!parsed.type || !parsed.amount || !parsed.categoryId) {
      res.status(502).json({ error: "Tier 2 response was missing required fields." });
      return;
    }
    if (parsed.type !== "CREDIT" && parsed.type !== "DEBIT") {
      res.status(502).json({ error: "Tier 2 returned an invalid type." });
      return;
    }

    const catExists = categories.some((c) => c.id === parsed.categoryId);
    const categoryId = catExists
      ? (parsed.categoryId as string)
      : parsed.type === "CREDIT"
        ? "cat_income"
        : "cat_general";

    const result: ParseResult = {
      type: parsed.type,
      amount: Number(parsed.amount),
      categoryId,
      description: parsed.description || userInput.trim(),
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0.8, 0), 1),
    };

    res.json(result);
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    req.log?.error({ err }, "Tier 2 parse failed");
    res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Tier 2 request timed out." : "Tier 2 request failed.",
    });
  }
});

export default router;
