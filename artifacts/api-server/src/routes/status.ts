import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * Reports whether Tier 2 / Tier 3 upstream providers are configured on the
 * server, without ever exposing the keys themselves. The app polls this to
 * show accurate "Connected" / "Not configured" status in Settings.
 */
router.get("/status", (_req, res) => {
  res.json({
    tier2Configured: !!process.env["OPENROUTER_API_KEY"],
    tier3Configured: !!process.env["GEMINI_API_KEY"],
  });
});

export default router;
