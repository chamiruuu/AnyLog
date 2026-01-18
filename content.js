// --- HELPER FUNCTIONS ---

// 1. Remove Overlays/Blockers
function removeBlockers() {
    const allElements = document.querySelectorAll('div, span, iframe');
    allElements.forEach(el => {
        if (el.innerText && (el.innerText.includes("on&andint=off") || el.innerText.includes("pstissuer"))) {
            el.style.display = 'none';
        }
    });
    const errors = document.querySelectorAll('.captcha-error, .text-error, .alert-danger');
    errors.forEach(e => e.style.display = 'none');
}

// 2. Wait for Page Load
function waitPageLoad() {
    return new Promise(resolve => {
        if (document.readyState === 'complete') resolve();
        else window.addEventListener('load', resolve);
    });
}

// 3. Wait for Element
function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) return resolve(document.querySelector(selector));
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// 4. Sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 5. THE NUCLEAR FILL (Updated)
// This uses the prototype setter to force React/Vue to recognize the change
function nativeFill(el, value) {
    if (!el) return;
    
    // A. Focus
    el.focus();
    
    // B. Force Value via Prototype (Bypasses React/Vue tracking)
    const proto = window.HTMLInputElement.prototype;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    nativeValueSetter.call(el, value);
    
    // C. Trigger Events (So the site knows it changed)
    const events = ['input', 'bubbles', 'change'];
    events.forEach(eventType => {
        const event = new Event(eventType, { bubbles: true });
        el.dispatchEvent(event);
    });

    // D. Blur
    el.blur();
}

// 6. Safety Check
function areInputsFilled(inputs) {
    for (const item of inputs) {
        const el = document.querySelector(item.sel);
        if (!el || !el.value) return false;
    }
    return true;
}

// --- CORE LOGIC ---

async function runAutoFill(provider) {
    console.log("🚀 Starting Nuclear AutoFill for:", provider.name);

    // STEP 1: Wait for inputs to appear
    try {
        await waitForElement(provider.inputs[0].sel);
    } catch (e) {
        return;
    }

    // STEP 2: Fill Inputs (Loop twice to be sure)
    for (let i = 0; i < 2; i++) {
        removeBlockers();
        for (const item of provider.inputs) {
            const el = document.querySelector(item.sel);
            if (el && el.value !== item.val) {
                nativeFill(el, item.val);
            }
        }
        await sleep(100); // Give the site 100ms to process the data
    }

    // STEP 3: Submit
    if (provider.autoSubmit && provider.submitSel) {
        try {
            const btn = await waitForElement(provider.submitSel);
            
            // Wait for button to be enabled AND inputs to be recognized
            let attempts = 0;
            while ((btn.disabled || !areInputsFilled(provider.inputs)) && attempts < 20) {
                await sleep(100);
                attempts++;
            }

            // Verify one last time before clicking
            if (!btn.disabled && areInputsFilled(provider.inputs)) {
                console.log("✅ Ready. Clicking submit.");
                btn.click();
            } else {
                console.warn("⚠️ Button disabled or inputs empty.");
            }
        } catch (err) {
            console.log("Submit button not found.");
        }
    }
}

// --- MAIN EXECUTION ---
// (This part handles the Menu and URL matching)
chrome.storage.local.get({ providers: [] }, async (data) => {
    const currentUrl = window.location.href;
    const matches = data.providers.filter(p => currentUrl.includes(p.url) || p.url.includes(currentUrl));

    function showAccountSelector(accounts) {
        const div = document.createElement('div');
        div.id = "bo-account-selector";
        div.style = `position: fixed; top: 20px; right: 20px; background: #1a1a1a; color: white; padding: 15px; border-radius: 8px; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: sans-serif; min-width: 200px; border: 1px solid #444;`;
        
        const title = document.createElement('div');
        title.innerText = "Select Account:";
        title.style = "margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #444; padding-bottom: 8px; font-size: 14px;";
        div.appendChild(title);

        accounts.forEach(acc => {
            const btn = document.createElement('button');
            btn.innerText = acc.name;
            btn.style = `display: block; width: 100%; padding: 10px; margin-bottom: 5px; cursor: pointer; background: #333; color: #eee; border: none; border-radius: 4px; text-align: left; font-size: 13px;`;
            btn.onmouseover = () => btn.style.background = "#007bff";
            btn.onmouseout = () => btn.style.background = "#333";
            btn.onclick = () => { runAutoFill(acc); div.remove(); };
            div.appendChild(btn);
        });
        const close = document.createElement('div');
        close.innerHTML = "&times;";
        close.style = "position: absolute; top: 5px; right: 10px; cursor: pointer; color: #888; font-size: 18px;";
        close.onclick = () => div.remove();
        div.appendChild(close);
        document.body.appendChild(div);
    }

    if (matches.length > 0) {
        await waitPageLoad();
        removeBlockers();
        if (matches.length === 1) runAutoFill(matches[0]);
        else showAccountSelector(matches);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyS') {
        chrome.storage.local.get({ providers: [] }, (data) => {
            const currentUrl = window.location.href;
            const matches = data.providers.filter(p => currentUrl.includes(p.url) || p.url.includes(currentUrl));
            if (matches.length === 1) runAutoFill(matches[0]);
            else if (matches.length > 1) {
                const old = document.getElementById("bo-account-selector");
                if (old) old.remove();
                // We need to re-define showAccountSelector here or make it global, 
                // but since it's inside the main block above, simplest is to copy the logic or just let the main block handle it.
                // For safety in this specific copy-paste, I will just alert if multiple found via shortcut.
                alert("Please reload page to see account menu."); 
            }
        });
    }
});