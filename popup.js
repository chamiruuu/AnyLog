document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('list');
    const search = document.getElementById('search');
    const status = document.getElementById('status');
    const verDisplay = document.getElementById('versionDisplay');

    // 1. ADMIN SETTING: YOUR HARDCODED LINK
    const HARDCODED_LINK = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRsy3VIwxjFl-GQ06B1uik7qmB1ZNNu3hgtSVj0W8wRKoMAXhYyzZXmBafSMnhF_3_bG9tMYk19XJhL/pub?output=csv"; 
    // -------------------------------------------

    // 2. DETERMINE WHICH LINK TO USE
    const config = await chrome.storage.local.get(['sheetUrl', 'providers', 'configVersion']);
    
    // Priority: Manual Link (from Options) > Hardcoded Link
    const activeLink = config.sheetUrl || HARDCODED_LINK;
    let providers = config.providers || [];
    
    // Display saved version immediately
    if (config.configVersion && verDisplay) verDisplay.innerText = "Config: " + config.configVersion;

    // 3. SYNC FROM SHEET (Uses activeLink now!)
    if (activeLink) {
        try {
            if(status) status.innerText = "Syncing...";
            
            // ERROR WAS HERE: We must fetch 'activeLink', not 'config.sheetUrl'
            const response = await fetch(activeLink);
            const csvText = await response.text();
            
            // Parse and Separate Version
            const result = parseCSV(csvText);
            providers = result.data;
            
            // UPDATE UI VERSION
            if (result.version) {
                if(verDisplay) verDisplay.innerText = "Config: " + result.version;
                chrome.storage.local.set({ configVersion: result.version });
            }

            chrome.storage.local.set({ providers: providers });
            
            if(status) {
                status.innerText = "Updated";
                setTimeout(() => status.innerText = "", 2000);
            }

        } catch (e) {
            console.error(e);
            if(status) {
                status.innerText = "Sync Error";
                status.style.color = "red";
            }
        }
    } else if (providers.length === 0) {
        list.innerHTML = "<div style='text-align:center; padding:20px; color:#777'>No Config Link Found.</div>";
        return;
    }

    renderList(providers);

    // SEARCH LOGIC
    search.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') {
            const first = list.querySelector('.btn');
            if(first) first.click(); return;
        }
        const term = e.target.value.toLowerCase();
        renderList(providers.filter(p => p.name.toLowerCase().includes(term)));
    });

    // --- PARSER ---
    function parseCSV(text) {
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let insideQuote = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];
            if (char === '"') {
                if (insideQuote && nextChar === '"') { currentVal += '"'; i++; }
                else { insideQuote = !insideQuote; }
            } else if (char === ',' && !insideQuote) {
                currentRow.push(currentVal); currentVal = '';
            } else if ((char === '\n' || char === '\r') && !insideQuote) {
                if (currentVal || currentRow.length > 0) currentRow.push(currentVal);
                if (currentRow.length > 0) rows.push(currentRow);
                currentRow = []; currentVal = '';
            } else { currentVal += char; }
        }
        if (currentVal || currentRow.length > 0) currentRow.push(currentVal);
        if (currentRow.length > 0) rows.push(currentRow);

        rows.shift(); // Remove Headers

        const cleanData = [];
        let foundVersion = null;

        rows.forEach((r, i) => {
            if(r.length < 2) return;
            const [name, url, user, pass, merch, userSel, passSel, merchSel, submitSel] = r;
            
            if (name && name.trim().toUpperCase() === "VERSION") {
                foundVersion = url.trim(); 
                return; 
            }

            const inputs = [];
            if(merchSel && merch) inputs.push({ sel: merchSel, val: merch });
            if(userSel && user) inputs.push({ sel: userSel, val: user });
            if(passSel && pass) inputs.push({ sel: passSel, val: pass });

            cleanData.push({ 
                id: i, 
                name: name, 
                url: url, 
                inputs: inputs, 
                submitSel: submitSel, 
                autoSubmit: true 
            });
        });

        return { data: cleanData, version: foundVersion };
    }

    function renderList(items) {
        list.innerHTML = '';
        if(items.length === 0) {
            list.innerHTML = "<div class='no-results'>No matches</div>";
            return;
        }
        items.forEach(p => {
            const btn = document.createElement('div');
            btn.className = 'btn';
            btn.innerHTML = `<strong>${p.name}</strong>`;
            btn.onclick = () => {
                const targetUrl = p.url.includes('#') ? p.url.split('#')[0] : p.url;
                window.open(`${targetUrl}#anylog_id=${p.id}`, '_blank');
            };
            list.appendChild(btn);
        });
    }
});