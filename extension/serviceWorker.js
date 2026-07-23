importScripts("storage.js", "configClient.js");

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await AnyLogStorage.getSettings();
  await AnyLogStorage.saveSettings(settings);
  chrome.alarms.create("anylog-sync", {
    delayInMinutes: 1,
    periodInMinutes: Math.max(5, Number(settings.syncIntervalMinutes || 60))
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "anylog-sync") return;
  try {
    await AnyLogConfigClient.syncProviderConfig();
  } catch (error) {
    await AnyLogStorage.addLog({
      level: "error",
      source: "sync",
      message: error.message
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ANYLOG_SYNC_NOW") {
    AnyLogConfigClient.syncProviderConfig()
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
