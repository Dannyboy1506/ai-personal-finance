import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type AuditPeriod = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

const PERIOD_LABEL: Record<AuditPeriod, string> = {
  WEEKLY: "the past week",
  MONTHLY: "this month",
  QUARTERLY: "this quarter",
  HALF_YEARLY: "the past half-year",
  YEARLY: "this year",
};

// Weekly audits are frequent and meant to be quick — Flash is fast and free-tier
// friendly. Monthly and longer are infrequent, higher-stakes reviews of more
// data, so they get Gemini's more capable reasoning model instead.
//
// NOTE (as of Aug 2026): gemini-2.5-flash/-pro are scheduled to shut down
// Oct 16, 2026 on the Gemini Developer API — these defaults point at the
// current Gemini 3.x generation instead. A client-supplied `model` in the
// request body overrides these entirely (see isValidSummary/route below),
// so this map is just the fallback when the app doesn't ask for something
// specific.
const PERIOD_MODEL: Record<AuditPeriod, string> = {
  WEEKLY: "gemini-3.6-flash",
  MONTHLY: "gemini-3.1-pro",
  QUARTERLY: "gemini-3.1-pro",
  HALF_YEARLY: "gemini-3.1-pro",
  YEARLY: "gemini-3.1-pro",
};

// Longer lookback periods have more to summarize and warrant more room.
const PERIOD_MAX_TOKENS: Record<AuditPeriod, number> = {
  WEEKLY: 300,
  MONTHLY: 450,
  QUARTERLY: 600,
  HALF_YEARLY: 700,
  YEARLY: 800,
};

interface PeriodSummary {
  period: AuditPeriod;
  totalBalance: number;
  periodIncome: number;
  periodExpenses: number;
  topCategories: Array<{ name: string; amount: number; isRisk: boolean }>;
  activeGoals: Array<{ name: string; progress: number; pacing: string }>;
  budgetAlerts: Array<{ category: string; spent: number; limit: number; percentage: number }>;
  /** Optional client override — lets the app test/switch models without a server redeploy. */
  model?: string;
}

const VALID_PERIODS: AuditPeriod[] = ["WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];

function isValidSummary(body: unknown): body is PeriodSummary {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b["model"] !== undefined && typeof b["model"] !== "string") return false;
  return (
    typeof b["period"] === "string" &&
    VALID_PERIODS.includes(b["period"] as AuditPeriod) &&
    typeof b["totalBalance"] === "number" &&
    typeof b["periodIncome"] === "number" &&
    typeof b["periodExpenses"] === "number" &&
    Array.isArray(b["topCategories"]) &&
    Array.isArray(b["activeGoals"]) &&
    Array.isArray(b["budgetAlerts"])
  );
}

/**
 * Tier 3: Google Gemini strategic financial audit, proxied server-side.
 * The client never sees GEMINI_API_KEY — it lives only in this process's env.
 * Supports weekly (quick, Flash) through yearly (deep, Pro) periods.
 */
router.post("/audit", async (req: Request, res: Response) => {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "Tier 3 is not configured on the server." });
    return;
  }

  if (!isValidSummary(req.body)) {
    res.status(400).json({ error: "A valid period summary payload (with a recognized 'period') is required." });
    return;
  }

  const summary = req.body;
  const periodLabel = PERIOD_LABEL[summary.period];
  const model = summary.model?.trim() || PERIOD_MODEL[summary.period];
  const maxOutputTokens = PERIOD_MAX_TOKENS[summary.period];
  const isLongRange = summary.period !== "WEEKLY";

  const systemPrompt = `You are a senior financial advisor embedded in a personal mobile wallet.
Analyze this spending data for ${periodLabel} and give direct, actionable advice.

Guidelines:
1. Identify any high-risk impulse categories (especially Betting or unusual Transport spikes).
${isLongRange
    ? "2. Since this covers a longer period, focus on the overall trend — is spending accelerating, stable, or improving? Call out the single biggest shift, not just a list of totals."
    : "2. Provide exactly 2 realistic micro-adjustments that would meaningfully boost savings toward the user's goals."}
3. Be concise, professional, and encouraging. ${isLongRange ? "Under 300 words." : "Under 150 words."}
4. Do not use generic advice — reference the specific categories and amounts in the data.
5. Format as plain text paragraphs, no markdown headers or bullet symbols.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `Financial Data:\n${JSON.stringify(summary, null, 2)}` },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.4,
        },
      }),
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      req.log?.warn({ status: upstream.status, model }, "Gemini upstream error");
      res.status(502).json({
        text: `Audit unavailable (server error ${upstream.status}). Check your connection and try again.`,
      });
      return;
    }

    const data = (await upstream.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    res.json({ text: text || "Unable to generate audit at this time. Try again shortly." });
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    req.log?.error({ err, model }, "Tier 3 audit failed");
    res.status(isAbort ? 504 : 500).json({
      text: isAbort
        ? "Audit timed out. Check your internet connection and try again."
        : "Unable to reach Gemini. Please check your connection and try again.",
    });
  }
});

export default router;
