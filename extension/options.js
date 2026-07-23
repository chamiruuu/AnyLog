const fields = [
  "apiUrl",
  "apiToken",
  "syncIntervalMinutes",
  "theme",
  "role",
  "debugMode",
  "autoFillOnOpen",
  "pendingTtlMs",
  "retryTimeoutMs",
  "retryIntervalMs",
  "includeSecretsInExport"
];

function input(id) {
  return document.querySelector(`#${id}`);
}

function applyTheme(settings) {
  document.body.classList.toggle("dark", settings.theme === "dark" ||
    (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches));
}

function readForm() {
  return {
    apiUrl: input("apiUrl").value.trim(),
    apiToken: input("apiToken").value.trim(),
    syncIntervalMinutes: Number(input("syncIntervalMinutes").value || 60),
    theme: input("theme").value,
    role: input("role").value,
    debugMode: input("debugMode").checked,
    autoFillOnOpen: input("autoFillOnOpen").checked,
    pendingTtlMs: Number(input("pendingTtlMs").value || 30000),
    retryTimeoutMs: Number(input("retryTimeoutMs").value || 10000),
    retryIntervalMs: Number(input("retryIntervalMs").value || 350),
    includeSecretsInExport: input("includeSecretsInExport").checked
  };
}

function writeForm(settings) {
  for (const key of fields) {
    const el = input(key);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = Boolean(settings[key]);
    else el.value = settings[key] ?? "";
  }
}

async function saveSettings() {
  const settings = await AnyLogStorage.saveSettings(readForm());
  applyTheme(settings);
  chrome.alarms?.create?.("anylog-sync", {
    delayInMinutes: Number(settings.syncIntervalMinutes),
    periodInMinutes: Math.max(5, Number(settings.syncIntervalMinutes || 60))
  });
  document.querySelector("#saveStatus").textContent = "Saved.";
  setTimeout(() => { document.querySelector("#saveStatus").textContent = ""; }, 1800);
}

async function renderLogs() {
  const logs = await AnyLogStorage.getLogs();
  const container = document.querySelector("#logs");
  container.innerHTML = logs.length ? logs.map((log) => `
    <div class="log">
      <strong>${escapeHtml(log.level)}</strong> ${escapeHtml(log.source)} · ${escapeHtml(log.at)}
      <div>${escapeHtml(log.message)}</div>
    </div>
  `).join("") : "<p class=\"hint\">No logs yet.</p>";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

async function exportBackup() {
  const settings = await AnyLogStorage.getSettings();
  const { providers, metadata } = await AnyLogStorage.getProviders();
  const favorites = await AnyLogStorage.getFavorites();
  const recent = await AnyLogStorage.getRecent();
  const includeSecrets = readForm().includeSecretsInExport;

  const safeSettings = { ...settings };
  if (!includeSecrets) safeSettings.apiToken = "";

  const safeProviders = includeSecrets ? providers : providers.map((provider) => ({
    ...provider,
    credentials: {
      username: "",
      password: "",
      merchantId: ""
    }
  }));

  const blob = new Blob([JSON.stringify({
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    metadata,
    providers: safeProviders,
    favorites,
    recent
  }, null, 2)], { type: "application/json" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `anylog-backup-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  const payload = JSON.parse(await file.text());
  if (payload.settings) await AnyLogStorage.saveSettings(payload.settings);
  if (Array.isArray(payload.providers)) await AnyLogStorage.saveProviders(payload.providers, payload.metadata || {});
  if (Array.isArray(payload.favorites)) await chrome.storage.local.set({ favorites: payload.favorites });
  if (Array.isArray(payload.recent)) await chrome.storage.local.set({ recent: payload.recent });
  await init();
}

async function syncNow() {
  document.querySelector("#syncStatus").textContent = "Syncing...";
  try {
    await saveSettings();
    const payload = await AnyLogConfigClient.syncProviderConfig();
    document.querySelector("#syncStatus").textContent = `Synced ${payload.providers.length} providers.`;
  } catch (error) {
    document.querySelector("#syncStatus").textContent = error.message;
  }
}

async function init() {
  const settings = await AnyLogStorage.getSettings();
  writeForm(settings);
  applyTheme(settings);
  await renderLogs();
}

document.querySelector("#saveButton").addEventListener("click", saveSettings);
document.querySelector("#syncButton").addEventListener("click", syncNow);
document.querySelector("#exportButton").addEventListener("click", exportBackup);
document.querySelector("#importFile").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importBackup(file).catch((error) => alert(error.message));
});
document.querySelector("#clearLogsButton").addEventListener("click", async () => {
  await AnyLogStorage.clearLogs();
  await renderLogs();
});

init();
