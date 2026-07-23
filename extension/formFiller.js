function parseHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(currentHost, providerUrl) {
  const providerHost = parseHostname(providerUrl);
  const normalizedCurrent = String(currentHost || "").replace(/^www\./, "").toLowerCase();
  return Boolean(providerHost) && (normalizedCurrent === providerHost || normalizedCurrent.endsWith(`.${providerHost}`));
}

function nativeSetValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function dispatchRealisticEvents(element) {
  const eventInit = { bubbles: true, cancelable: true };
  element.dispatchEvent(new KeyboardEvent("keydown", { ...eventInit, key: "Tab" }));
  element.dispatchEvent(new Event("input", eventInit));
  element.dispatchEvent(new Event("change", eventInit));
  element.dispatchEvent(new KeyboardEvent("keyup", { ...eventInit, key: "Tab" }));
  element.dispatchEvent(new FocusEvent("blur", eventInit));
}

function findVisible(selector) {
  if (!selector) return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (style.visibility === "hidden" || style.display === "none" || rect.width === 0 || rect.height === 0) {
    return null;
  }
  return element;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSelectors(provider, timeoutMs = 10000, intervalMs = 350) {
  const startedAt = Date.now();
  const required = [
    ["username", provider.selectors?.username],
    ["password", provider.selectors?.password]
  ].filter(([, selector]) => Boolean(selector));
  const optional = [
    ["merchant", provider.selectors?.merchant],
    ["submit", provider.selectors?.submit]
  ].filter(([, selector]) => Boolean(selector));

  while (Date.now() - startedAt <= timeoutMs) {
    const found = {};
    const missingRequired = [];

    for (const [name, selector] of required) {
      const element = findVisible(selector);
      if (element) found[name] = element;
      else missingRequired.push({ name, selector });
    }

    for (const [name, selector] of optional) {
      const element = findVisible(selector);
      if (element) found[name] = element;
    }

    if (missingRequired.length === 0) {
      return { found, missingRequired };
    }
    await sleep(intervalMs);
  }

  return {
    found: {},
    missingRequired: required.map(([name, selector]) => ({ name, selector }))
  };
}

async function fillProviderForm(provider, options = {}) {
  if (!hostMatches(location.hostname, provider.url)) {
    return {
      ok: false,
      reason: "host_mismatch",
      message: "Current hostname does not match provider hostname."
    };
  }

  const timeoutMs = options.retryTimeoutMs || 10000;
  const intervalMs = options.retryIntervalMs || 350;
  const { found, missingRequired } = await waitForSelectors(provider, timeoutMs, intervalMs);
  if (missingRequired.length) {
    return {
      ok: false,
      reason: "selectors_missing",
      message: "Required selectors were not found before timeout.",
      missing: missingRequired
    };
  }

  const pairs = [
    [found.username, provider.credentials?.username || ""],
    [found.password, provider.credentials?.password || ""],
    [found.merchant, provider.credentials?.merchantId || ""]
  ];

  for (const [element, value] of pairs) {
    if (!element || value === "") continue;
    element.focus();
    nativeSetValue(element, value);
    dispatchRealisticEvents(element);
  }

  if (provider.autoSubmit && found.submit) {
    found.submit.focus();
    found.submit.click();
  }

  return {
    ok: true,
    reason: "filled",
    message: provider.autoSubmit ? "Form filled and submitted." : "Form filled."
  };
}

function getSelectorHealth(provider) {
  const selectors = provider.selectors || {};
  const items = Object.entries(selectors)
    .filter(([, selector]) => Boolean(selector))
    .map(([name, selector]) => ({
      name,
      selector,
      present: Boolean(document.querySelector(selector))
    }));
  return items;
}

globalThis.AnyLogFormFiller = {
  hostMatches,
  fillProviderForm,
  getSelectorHealth
};
