(async function bootAnyLogContentScript() {
  const storage = globalThis.AnyLogStorage;
  const filler = globalThis.AnyLogFormFiller;

  // --- Existing Background Fill Logic ---
  async function runPendingFill(trigger = "auto") {
    const settings = await storage.getSettings();
    const pending = await storage.getPendingLogin();
    if (!pending || !pending.provider) return;
    if (pending.mode === "manual" && trigger !== "manual") return;
    if (!settings.autoFillOnOpen && trigger !== "manual") return;

    const result = await filler.fillProviderForm(pending.provider, {
      retryTimeoutMs: settings.retryTimeoutMs,
      retryIntervalMs: settings.retryIntervalMs
    });

    await storage.addLog({
      level: result.ok ? "info" : "debug",
      source: "content",
      message: result.message,
      details: {
        providerId: pending.providerId,
        reason: result.reason,
        missing: result.missing || []
      }
    });

    if (result.ok || result.reason === "host_mismatch") {
      await storage.clearPendingLogin();
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "ANYLOG_FILL_CURRENT") {
      runPendingFill("manual")
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type === "ANYLOG_TEST_SELECTORS") {
      const provider = message.provider;
      const health = filler.getSelectorHealth(provider);
      sendResponse({ ok: true, health });
      return false;
    }

    return false;
  });

  // Run the standard auto-fill check
  await runPendingFill("auto");

  // --- NEW: On-Page Floating Menu Logic ---
  try {
    const { providers } = await storage.getProviders();
    if (!providers) return;

    // Find all providers that match the current website
    const matchingProviders = providers.filter(p => filler.hostMatches(location.hostname, p.url));

    // If we have any matches, inject the floating UI
    if (matchingProviders.length > 0) {
      injectFloatingMenu(matchingProviders);
    }
  } catch (err) {
    console.error("AnyLog: Failed to load providers for on-page menu", err);
  }

  function injectFloatingMenu(providers) {
    // Ensure we don't inject multiple times
    if (document.getElementById("anylog-floating-menu")) return;

    const container = document.createElement("div");
    container.id = "anylog-floating-menu";
    
    // Clean, full-black UI design
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #000000;
      color: #ffffff;
      border: 1px solid #333333;
      border-radius: 8px;
      padding: 12px;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 160px;
    `;

    const title = document.createElement("div");
    title.textContent = "AnyLog Logins";
    title.style.cssText = `
      font-size: 11px;
      color: #888888;
      margin-bottom: 4px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    container.appendChild(title);

    // Create a button for each matching account
    providers.forEach(provider => {
      const btn = document.createElement("button");
      btn.textContent = provider.name;
      btn.style.cssText = `
        background: #111111;
        color: #ffffff;
        border: 1px solid #333333;
        padding: 10px 14px;
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      `;
      
      // Hover effects
      btn.onmouseover = () => {
        btn.style.background = "#222222";
        btn.style.borderColor = "#555555";
      };
      btn.onmouseout = () => {
        btn.style.background = "#111111";
        btn.style.borderColor = "#333333";
      };

      // When clicked, use the formFiller to inject the credentials
      btn.onclick = async () => {
        const originalText = btn.textContent;
        btn.textContent = "Filling...";
        btn.style.color = "#55d6be"; // Extension accent color
        
        await filler.fillProviderForm(provider, { 
          retryTimeoutMs: 5000, 
          retryIntervalMs: 350 
        });
        
        btn.textContent = "Done!";
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = "#ffffff";
        }, 1500);
      };

      container.appendChild(btn);
    });

    // Add a small close button to dismiss the menu
    const closeBtn = document.createElement("div");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 12px;
      color: #666666;
      cursor: pointer;
      font-size: 16px;
    `;
    closeBtn.onclick = () => container.remove();
    container.appendChild(closeBtn);

    document.body.appendChild(container);
  }
})();