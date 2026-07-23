(async function bootAnyLogContentScript() {
  const storage = globalThis.AnyLogStorage;
  const filler = globalThis.AnyLogFormFiller;

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

  await runPendingFill("auto");
})();
