async function init() {
    const hash = window.location.hash;
    if (!hash.includes('anylog_id=')) return; 

    const targetId = parseInt(hash.split('anylog_id=')[1]);
    const data = await chrome.storage.local.get({ providers: [] });
    const account = data.providers.find(p => p.id === targetId);

    if (!account) return;

    console.log("AnyLog: Precision Fill for", account.name);

    const maxTries = 20; // Try for 4 seconds
    let filledCount = 0;

    for (let t = 0; t < maxTries; t++) {
        filledCount = 0;
        
        for (const input of account.inputs) {
            // Use the EXACT selector from the sheet
            const el = document.querySelector(input.sel);
            if (el) {
                nativeFill(el, input.val);
                filledCount++;
            }
        }

        // If we filled all required inputs, stop looping
        if (filledCount >= account.inputs.length) break;
        await new Promise(r => setTimeout(r, 200));
    }

    // Submit
    if (filledCount >= account.inputs.length && account.submitSel) {
        const btn = document.querySelector(account.submitSel);
        if (btn && !btn.disabled) {
            setTimeout(() => btn.click(), 300);
        }
    }
    
    history.replaceState(null, null, window.location.href.split('#')[0]);
}

// THE "NUCLEAR" FILLER - Triggers everything
function nativeFill(el, value) {
    if (!el) return;
    
    el.focus();
    el.value = value;
    
    // React/Vue Override
    const proto = window.HTMLInputElement.prototype;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (nativeValueSetter) {
        nativeValueSetter.call(el, value);
    }

    // Dispatch ALL events to wake up the website
    ['input', 'change', 'keydown', 'keyup', 'blur'].forEach(evtType => {
        el.dispatchEvent(new Event(evtType, { bubbles: true }));
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();