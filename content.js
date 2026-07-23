async function init() {
    // 1. CHECK STORAGE FOR PENDING LOGIN
    const data = await chrome.storage.local.get(['pendingLogin']);
    const pending = data.pendingLogin;

    // Safety Checks:
    // A. Must exist
    if (!pending) return;
    
    // B. Must be recent (triggered < 30 seconds ago) to prevent accidental fills later
    const now = Date.now();
    if (now - pending.timestamp > 30000) {
        // Expired command
        chrome.storage.local.remove('pendingLogin');
        return;
    }

    // C. Must match the current domain (Security)
    // We check if current URL contains the domain from the config
    const currentUrl = window.location.href.toLowerCase();
    const configUrl = pending.url.toLowerCase();
    
    // Extract hostnames to compare strictly
    try {
        const currentHost = new URL(currentUrl).hostname;
        const configHost = new URL(configUrl).hostname;
        // If we are on "google.com" but config is for "pg-bo.net", STOP.
        if (!currentHost.includes(configHost) && !configHost.includes(currentHost)) return;
    } catch(e) { return; }

    console.log("AnyLog: Storage Target Found -", pending.name);

    // 2. FILL LOOP (The "Anti-Autofill" Logic)
    const maxTries = 25; 
    let filledCount = 0;

    for (let t = 0; t < maxTries; t++) {
        filledCount = 0;
        
        for (const input of pending.inputs) {
            const el = document.querySelector(input.sel);
            if (el) {
                // A. Kill Chrome Autofill
                el.setAttribute('autocomplete', 'off');
                el.setAttribute('readonly', 'true'); // Temp lock
                el.removeAttribute('readonly'); // Unlock
                
                // B. Nuclear Fill
                nativeFill(el, input.val);
                filledCount++;
            }
        }

        // Lock-in Loop (keep filling for 1 second to overwrite Chrome)
        if (filledCount >= pending.inputs.length) {
            if (t > 8) break; 
        }
        
        await new Promise(r => setTimeout(r, 200));
    }

    // 3. SUBMIT
    if (filledCount >= pending.inputs.length && pending.autoSubmit && pending.submitSel) {
        const btn = document.querySelector(pending.submitSel);
        if (btn && !btn.disabled) {
            setTimeout(() => btn.click(), 300);
        }
    }
    
    // 4. CLEANUP (Remove the pending task so it doesn't fire again on refresh)
    // We do this a bit late to ensure everything ran
    setTimeout(() => {
        chrome.storage.local.remove('pendingLogin');
    }, 5000);
}

// --- HELPER: The Nuclear Fill ---
function nativeFill(el, value) {
    if (!el) return;
    el.focus();
    el.value = ''; // Clear first
    const proto = window.HTMLInputElement.prototype;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (nativeValueSetter) {
        nativeValueSetter.call(el, value);
    } else {
        el.value = value;
    }
    ['input', 'bubbles', 'change', 'keydown', 'keyup', 'blur'].forEach(evtType => {
        el.dispatchEvent(new Event(evtType, { bubbles: true }));
    });
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}