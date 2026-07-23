import { parse } from "csv-parse/sync";
import crypto from "node:crypto";

let cache = null;

export async function getConfig() {
  const cacheTtlMs = Number(process.env.CACHE_TTL_SECONDS || 120) * 1000;
  if (cache && Date.now() - cache.createdAt < cacheTtlMs) {
    return cache.payload;
  }

  const sheetUrl = process.env.GOOGLE_SHEET_CSV_URL;
  if (!sheetUrl) {
    const error = new Error("GOOGLE_SHEET_CSV_URL is not configured.");
    error.status = 500;
    throw error;
  }

  const response = await fetch(sheetUrl, {
    headers: { "Accept": "text/csv,*/*" }
  });
  if (!response.ok) {
    throw new Error(`Google Sheet fetch failed with HTTP ${response.status}`);
  }

  const csv = await response.text();
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });

  const normalized = normalizeRows(rows);
  const payload = {
    ok: true,
    source: "sheet-proxy",
    version: normalized.version,
    generatedAt: new Date().toISOString(),
    providers: normalized.providers
  };
  cache = { createdAt: Date.now(), payload };
  return payload;
}

export function requireTokenFromHeaders(headers) {
  const expected = process.env.API_TOKEN;
  if (!expected) return true;
  const header = headers.authorization || headers.Authorization || "";
  const token = String(header).replace(/^Bearer\s+/i, "");
  return Boolean(token) && timingSafeEqual(token, expected);
}

export function isOriginAllowed(origin) {
  if (!origin) return true;
  const extensionId = process.env.ALLOWED_EXTENSION_ID;
  const extensionOrigin = extensionId ? `chrome-extension://${extensionId}` : null;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Boolean((extensionOrigin && origin === extensionOrigin) || allowedOrigins.includes(origin));
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeRows(rows) {
  let version = "unversioned";
  const providers = [];

  for (const row of rows) {
    const name = text(row.Name);
    if (!name) continue;

    if (name.toUpperCase() === "VERSION") {
      version = text(row.LastUpdated) || text(row.Notes) || text(row.URL) || version;
      continue;
    }

    const enabled = booleanish(row.Enabled, true);
    if (!enabled) continue;

    const url = text(row.URL);
    if (!url || !isHttpUrl(url)) continue;

    providers.push({
      id: stableId(name, url),
      name,
      url,
      category: text(row.Category) || "General",
      notes: text(row.Notes),
      enabled,
      autoSubmit: booleanish(row.AutoSubmit, false),
      tags: splitTags(row.Tags),
      priority: numberish(row.Priority, 0),
      lastUpdated: text(row.LastUpdated),
      credentials: {
        username: text(row.Username),
        password: text(row.Password),
        merchantId: text(row.MerchantID)
      },
      selectors: {
        username: text(row.UserSelector),
        password: text(row.PassSelector),
        merchant: text(row.MerchantSelector),
        submit: text(row.SubmitSelector)
      }
    });
  }

  return {
    version,
    providers: providers.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
  };
}

function text(value) {
  return String(value ?? "").trim();
}

function splitTags(value) {
  return text(value)
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function booleanish(value, fallback) {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "enabled", "on"].includes(raw);
}

function numberish(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function stableId(name, url) {
  return crypto.createHash("sha256").update(`${name}|${url}`).digest("hex").slice(0, 16);
}
