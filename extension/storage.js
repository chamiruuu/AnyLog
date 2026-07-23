const DEFAULT_SETTINGS = {
  apiUrl: "https://my-domain.com/api/config",
  apiToken: "",
  syncIntervalMinutes: 60,
  theme: "system",
  role: "user",
  debugMode: false,
  autoFillOnOpen: true,
  pendingTtlMs: 30000,
  retryTimeoutMs: 10000,
  retryIntervalMs: 350,
  includeSecretsInExport: false
};

const STORAGE_KEYS = {
  settings: "settings",
  providers: "providers",
  metadata: "metadata",
  pendingLogin: "pendingLogin",
  favorites: "favorites",
  recent: "recent",
  logs: "logs"
};

async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

async function setLocal(values) {
  return chrome.storage.local.set(values);
}

async function removeLocal(keys) {
  return chrome.storage.local.remove(keys);
}

async function getSettings() {
  const result = await getLocal(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.settings] || {}) };
}

async function saveSettings(nextSettings) {
  const merged = { ...(await getSettings()), ...nextSettings };
  await setLocal({ [STORAGE_KEYS.settings]: merged });
  return merged;
}

async function getProviders() {
  const result = await getLocal([STORAGE_KEYS.providers, STORAGE_KEYS.metadata]);
  return {
    providers: result[STORAGE_KEYS.providers] || [],
    metadata: result[STORAGE_KEYS.metadata] || null
  };
}

async function saveProviders(providers, metadata) {
  await setLocal({
    [STORAGE_KEYS.providers]: providers,
    [STORAGE_KEYS.metadata]: {
      ...(metadata || {}),
      syncedAt: new Date().toISOString()
    }
  });
}

async function getFavorites() {
  const result = await getLocal(STORAGE_KEYS.favorites);
  return result[STORAGE_KEYS.favorites] || [];
}

async function toggleFavorite(providerId) {
  const favorites = await getFavorites();
  const next = favorites.includes(providerId)
    ? favorites.filter((id) => id !== providerId)
    : [providerId, ...favorites];
  await setLocal({ [STORAGE_KEYS.favorites]: next });
  return next;
}

async function getRecent() {
  const result = await getLocal(STORAGE_KEYS.recent);
  return result[STORAGE_KEYS.recent] || [];
}

async function addRecent(providerId) {
  const recent = await getRecent();
  const next = [providerId, ...recent.filter((id) => id !== providerId)].slice(0, 12);
  await setLocal({ [STORAGE_KEYS.recent]: next });
  return next;
}

async function setPendingLogin(provider, mode = "auto") {
  const settings = await getSettings();
  const pending = {
    providerId: provider.id,
    mode,
    createdAt: Date.now(),
    expiresAt: Date.now() + Number(settings.pendingTtlMs || 30000),
    provider
  };
  await setLocal({ [STORAGE_KEYS.pendingLogin]: pending });
  return pending;
}

async function getPendingLogin() {
  const result = await getLocal(STORAGE_KEYS.pendingLogin);
  const pending = result[STORAGE_KEYS.pendingLogin];
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    await clearPendingLogin();
    return null;
  }
  return pending;
}

async function clearPendingLogin() {
  await removeLocal(STORAGE_KEYS.pendingLogin);
}

async function addLog(entry) {
  const settings = await getSettings();
  if (!settings.debugMode && entry.level === "debug") return;
  const result = await getLocal(STORAGE_KEYS.logs);
  const logs = result[STORAGE_KEYS.logs] || [];
  const next = [{
    at: new Date().toISOString(),
    level: entry.level || "info",
    source: entry.source || "extension",
    message: entry.message,
    details: entry.details || null
  }, ...logs].slice(0, 200);
  await setLocal({ [STORAGE_KEYS.logs]: next });
}

async function getLogs() {
  const result = await getLocal(STORAGE_KEYS.logs);
  return result[STORAGE_KEYS.logs] || [];
}

async function clearLogs() {
  await setLocal({ [STORAGE_KEYS.logs]: [] });
}

globalThis.AnyLogStorage = {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  getSettings,
  saveSettings,
  getProviders,
  saveProviders,
  getFavorites,
  toggleFavorite,
  getRecent,
  addRecent,
  setPendingLogin,
  getPendingLogin,
  clearPendingLogin,
  addLog,
  getLogs,
  clearLogs
};
