const state = {
  providers: [],
  metadata: null,
  settings: null,
  favorites: [],
  recent: [],
  activeTab: "All",
  query: "",
  selectedIndex: 0,
  selectedProvider: null
};

const els = {
  syncMeta: document.querySelector("#syncMeta"),
  syncButton: document.querySelector("#syncButton"),
  optionsButton: document.querySelector("#optionsButton"),
  searchInput: document.querySelector("#searchInput"),
  tabs: document.querySelector("#tabs"),
  providerList: document.querySelector("#providerList"),
  detail: document.querySelector("#detail"),
  backButton: document.querySelector("#backButton"),
  favoriteButton: document.querySelector("#favoriteButton"),
  detailName: document.querySelector("#detailName"),
  detailMeta: document.querySelector("#detailMeta"),
  selectorHealth: document.querySelector("#selectorHealth"),
  detailNotes: document.querySelector("#detailNotes"),
  openButton: document.querySelector("#openButton"),
  manualButton: document.querySelector("#manualButton"),
  testButton: document.querySelector("#testButton"),
  footerState: document.querySelector("#footerState"),
  roleState: document.querySelector("#roleState")
};

function applyTheme() {
  document.body.classList.toggle("dark", state.settings.theme === "dark" ||
    (state.settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches));
}

function setStatus(message, kind = "info") {
  els.footerState.textContent = message;
  els.footerState.className = `message ${kind === "error" ? "error" : kind === "warn" ? "warn" : ""}`.trim();
}

function formatTime(value) {
  if (!value) return "Not synced yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function providerText(provider) {
  return [
    provider.name,
    provider.url,
    provider.category,
    provider.notes,
    ...(provider.tags || [])
  ].join(" ").toLowerCase();
}

function sortedProviders(providers) {
  return [...providers].sort((a, b) => {
    const favDelta = Number(state.favorites.includes(b.id)) - Number(state.favorites.includes(a.id));
    if (favDelta) return favDelta;
    return Number(b.priority || 0) - Number(a.priority || 0) || a.name.localeCompare(b.name);
  });
}

function filteredProviders() {
  const query = state.query.trim().toLowerCase();
  return sortedProviders(state.providers).filter((provider) => {
    if (state.activeTab === "Favorites" && !state.favorites.includes(provider.id)) return false;
    if (state.activeTab === "Recent" && !state.recent.includes(provider.id)) return false;
    if (!["All", "Favorites", "Recent"].includes(state.activeTab) && provider.category !== state.activeTab) return false;
    return !query || providerText(provider).includes(query);
  });
}

function renderTabs() {
  const categories = Array.from(new Set(state.providers.map((p) => p.category).filter(Boolean))).sort();
  const tabs = ["All", "Favorites", "Recent", ...categories];
  els.tabs.innerHTML = "";
  for (const tab of tabs) {
    const button = document.createElement("button");
    button.className = `tab ${tab === state.activeTab ? "active" : ""}`;
    button.textContent = tab;
    button.addEventListener("click", () => {
      state.activeTab = tab;
      state.selectedIndex = 0;
      render();
    });
    els.tabs.append(button);
  }
}

function renderProviders() {
  const providers = filteredProviders();
  els.providerList.innerHTML = "";
  els.footerState.className = "message";
  els.footerState.textContent = `${providers.length} of ${state.providers.length} providers`;

  if (!providers.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.providers.length ? "No providers match the current filter." : "No providers synced yet.";
    els.providerList.append(empty);
    return;
  }

  providers.forEach((provider, index) => {
    const row = document.createElement("div");
    row.className = `provider-row ${index === state.selectedIndex ? "active" : ""}`;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-disabled", String(!provider.enabled));
    row.innerHTML = `
      <div>
        <div class="provider-title">
          <span>${escapeHtml(provider.name)}</span>
          ${provider.category ? `<span class="badge">${escapeHtml(provider.category)}</span>` : ""}
        </div>
        <div class="provider-sub">${escapeHtml(provider.url || "No URL configured")}</div>
      </div>
      <div class="row-actions">
        <button class="row-action favorite ${state.favorites.includes(provider.id) ? "active" : ""}" title="Favorite for this user" aria-label="Favorite ${escapeHtml(provider.name)}">
          ${starIcon()}
        </button>
        <button class="row-action current-page" title="Fill current page" aria-label="Fill current page with ${escapeHtml(provider.name)}">
          ${fillIcon()}
        </button>
        <button class="row-action details" title="Provider details" aria-label="Show details for ${escapeHtml(provider.name)}">
          ${infoIcon()}
        </button>
      </div>
    `;
    row.addEventListener("click", () => openProvider(provider));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openProvider(provider);
    });
    row.querySelector(".favorite").addEventListener("click", async (event) => {
      event.stopPropagation();
      state.favorites = await AnyLogStorage.toggleFavorite(provider.id);
      render();
    });
    row.querySelector(".current-page").addEventListener("click", (event) => {
      event.stopPropagation();
      fillCurrentPage(provider);
    });
    row.querySelector(".details").addEventListener("click", (event) => {
      event.stopPropagation();
      showDetail(provider);
    });
    els.providerList.append(row);
  });
}

function starIcon() {
  return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z\"/></svg>";
}

function fillIcon() {
  return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M4 5h16M4 12h10M4 19h7m7-6 3 3m0 0-3 3m3-3h-8\"/></svg>";
}

function infoIcon() {
  return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 17v-6m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z\"/></svg>";
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

function renderMeta() {
  const metadata = state.metadata || {};
  els.syncMeta.textContent = `Version ${metadata.version || "unknown"} · ${formatTime(metadata.syncedAt)}`;
  els.roleState.textContent = state.settings.role === "admin" ? "admin" : "user";
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", state.settings.role !== "admin");
  });
}

function render() {
  renderMeta();
  renderTabs();
  renderProviders();
}

function showDetail(provider) {
  state.selectedProvider = provider;
  els.providerList.classList.add("hidden");
  els.tabs.classList.add("hidden");
  els.detail.classList.remove("hidden");
  els.detailName.textContent = provider.name;
  els.favoriteButton.textContent = state.favorites.includes(provider.id) ? "Unfavorite" : "Favorite";
  els.detailMeta.innerHTML = [
    ["URL", provider.url],
    ["Category", provider.category || "Uncategorized"],
    ["Tags", (provider.tags || []).join(", ") || "None"],
    ["Last Sync", formatTime(state.metadata?.syncedAt)],
    ["Updated", provider.lastUpdated || "Not set"],
    ["Auto Submit", provider.autoSubmit ? "Enabled" : "Off"],
    ["Enabled", provider.enabled ? "Yes" : "No"]
  ].map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
  els.detailNotes.textContent = provider.notes || "";
  els.selectorHealth.innerHTML = "";
  if (!provider.enabled) setStatus("This provider is disabled in the synced config.", "warn");
}

function showList() {
  state.selectedProvider = null;
  els.detail.classList.add("hidden");
  els.providerList.classList.remove("hidden");
  els.tabs.classList.remove("hidden");
  render();
}

async function openProvider(provider) {
  if (!provider?.enabled) {
    setStatus("Provider is disabled.", "warn");
    return;
  }
  if (!provider.url) {
    setStatus("Provider URL is missing.", "error");
    return;
  }
  await AnyLogStorage.setPendingLogin(provider, "auto");
  await AnyLogStorage.addRecent(provider.id);
  await chrome.tabs.create({ url: provider.url });
  window.close();
}

async function fillCurrentPage(provider) {
  if (!provider?.enabled) {
    setStatus("Provider is disabled.", "warn");
    return;
  }
  await AnyLogStorage.setPendingLogin(provider, "manual");
  await AnyLogStorage.addRecent(provider.id);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "ANYLOG_FILL_CURRENT" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Content script is not available on this page.", "error");
      return;
    }
    setStatus(response?.ok ? "Fill command sent." : response?.error || "Fill failed.", response?.ok ? "info" : "error");
  });
}

async function testSelectors(provider) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "ANYLOG_TEST_SELECTORS", provider }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      setStatus("Open the provider page before testing selectors.", "warn");
      return;
    }
    els.selectorHealth.innerHTML = response.health.map((item) => `
      <div class="health-item">
        <span>${escapeHtml(item.name)}: ${escapeHtml(item.selector)}</span>
        <strong>${item.present ? "Found" : "Missing"}</strong>
      </div>
    `).join("");
  });
}

async function syncNow() {
  setStatus("Syncing providers...");
  const response = await chrome.runtime.sendMessage({ type: "ANYLOG_SYNC_NOW" });
  if (!response?.ok) {
    setStatus(response?.error || "Sync failed.", "error");
    return;
  }
  await loadState();
  setStatus(`Synced ${response.payload.providers.length} providers.`);
}

async function loadState() {
  state.settings = await AnyLogStorage.getSettings();
  const saved = await AnyLogStorage.getProviders();
  state.providers = saved.providers;
  state.metadata = saved.metadata;
  state.favorites = await AnyLogStorage.getFavorites();
  state.recent = await AnyLogStorage.getRecent();
  applyTheme();
  render();
}

els.syncButton.addEventListener("click", syncNow);
els.optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.selectedIndex = 0;
  renderProviders();
});
els.searchInput.addEventListener("keydown", (event) => {
  const providers = filteredProviders();
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.selectedIndex = Math.min(providers.length - 1, state.selectedIndex + 1);
    renderProviders();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.selectedIndex = Math.max(0, state.selectedIndex - 1);
    renderProviders();
  }
  if (event.key === "Enter" && providers[state.selectedIndex]) {
    event.preventDefault();
    openProvider(providers[state.selectedIndex]);
  }
});
els.backButton.addEventListener("click", showList);
els.favoriteButton.addEventListener("click", async () => {
  if (!state.selectedProvider) return;
  state.favorites = await AnyLogStorage.toggleFavorite(state.selectedProvider.id);
  showDetail(state.selectedProvider);
});
els.openButton.addEventListener("click", () => openProvider(state.selectedProvider));
els.manualButton.addEventListener("click", () => fillCurrentPage(state.selectedProvider));
els.testButton.addEventListener("click", () => testSelectors(state.selectedProvider));

loadState().catch((error) => setStatus(error.message, "error"));
