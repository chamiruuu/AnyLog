import { getConfig, isOriginAllowed, requireTokenFromHeaders } from "../lib/configService.js";

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed." });
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!requireTokenFromHeaders(req.headers)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const payload = await getConfig();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(payload);
  } catch (error) {
    console.error(error.message);
    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : "Unable to load provider config."
    });
  }
}
