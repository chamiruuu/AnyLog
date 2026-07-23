async function syncProviderConfig(options = {}) {
  const settings = await AnyLogStorage.getSettings();
  const apiUrl = (options.apiUrl || settings.apiUrl || "").trim();
  if (!apiUrl) {
    throw new Error("Backend API URL is required.");
  }

  const headers = {
    "Accept": "application/json"
  };
  if (settings.apiToken) {
    headers.Authorization = `Bearer ${settings.apiToken}`;
  }

  const response = await fetch(apiUrl, {
    method: "GET",
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Sync failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.providers)) {
    throw new Error("Backend response did not include providers.");
  }

  await AnyLogStorage.saveProviders(payload.providers, {
    version: payload.version || "unknown",
    source: payload.source || "backend",
    providerCount: payload.providers.length,
    status: "ok"
  });

  await AnyLogStorage.addLog({
    level: "info",
    source: "sync",
    message: `Synced ${payload.providers.length} providers.`,
    details: { version: payload.version || "unknown" }
  });

  return payload;
}

globalThis.AnyLogConfigClient = { syncProviderConfig };
