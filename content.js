// Helper: Wait for the DOM to be fully loaded
function waitPageLoad() {
    return new Promise(resolve => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
}

// Helper: Wait for a specific element to appear
function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// Helper: Sleep function
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: NATIVE FILL (Updated with "Select All" logic)
function nativeFill(el, value) {
    if (!el) return;

    // 1. Focus
    el.focus();

    // 2. SELECT ALL (This fixes the appending/double-typing issue)
    // We select existing text so the new text overwrites it
    el.select();
    document.execCommand('selectAll', false, null);

    // 3. INSERT TEXT (Simulates user typing)
    let success = false;
    try {
        success = document.execCommand('insertText', false, value);
    } catch (e) {
        console.log("execCommand error", e);
    }

    // 4. Fallback: Force value if command failed
    if (!success) {
        el.value = value;
        el.setAttribute('value', value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 5. Blur to trigger validation
    el.blur();
}

chrome.storage.local.get({ providers: [] }, async (data) => {
    const currentUrl = window.location.href;
    // Check both directions to handle Iframes or long Auth0 URLs
    const match = data.providers.find(p => currentUrl.includes(p.url) || p.url.includes(currentUrl));

    if (match) {
        console.log("BO Auto-Filler: Match found for", match.name);
        
        // 1. WAIT FOR PAGE LOAD
        await waitPageLoad();

        // 2. AGGRESSIVE FILL LOOP (3 Attempts)
        for (let i = 0; i < 3; i++) {
            
            for (const item of match.inputs) {
                try {
                    const el = await waitForElement(item.sel);
                    
                    // Small delay on first run to let animations finish
                    if (i === 0) await sleep(500); 

                    // Fill using the new Overwrite method
                    nativeFill(el, item.val);
                    console.log(`Filled ${item.sel} (Attempt ${i + 1})`);

                } catch (err) {
                    console.warn("Element not found:", item.sel);
                }
            }
            // Wait between attempts
            await sleep(500);
        }

        // 3. SUBMIT LOGIC
        if (match.autoSubmit && match.submitSel) {
            try {
                console.log("Waiting for validation before submit...");
                await sleep(1000); 
                
                const btn = await waitForElement(match.submitSel);
                console.log("Clicking submit...");
                btn.click();
            } catch (err) {
                console.warn("Could not find submit button:", match.submitSel);
            }
        } else {
            console.log("Auto-submit disabled or not configured.");
        }
    }
});