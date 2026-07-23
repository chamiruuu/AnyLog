import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getConfig, isOriginAllowed, requireTokenFromHeaders } from "./lib/configService.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed."));
  }
}));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", requireToken, async (req, res, next) => {
  try {
    const payload = await getConfig();
    res.setHeader("Cache-Control", "private, max-age=60");
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(error.status || 500).json({
    ok: false,
    error: error.status ? error.message : "Unable to load provider config."
  });
});

function requireToken(req, res, next) {
  if (requireTokenFromHeaders(req.headers)) return next();
  res.status(401).json({ ok: false, error: "Unauthorized" });
}

app.listen(port, () => {
  console.log(`AnyLog config proxy listening on port ${port}`);
});
