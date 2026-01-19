document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('list');
    const search = document.getElementById('search');
    const noResults = document.getElementById('no-results');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    const status = document.getElementById('status');

    let allProviders = [];

    // 1. LOAD DATA
    chrome.storage.local.get({ providers: [] }, (data) => {
        allProviders = data.providers;
        renderList(allProviders);
    });

    // 2. SEARCH FILTER
    search.addEventListener('keyup', (e) => {
        // If the key is ENTER, ignore this handler (handled by keydown below)
        if (e.key === 'Enter') return;

        const term = e.target.value.toLowerCase();
        const filtered = allProviders.filter(p => 
            p.name.toLowerCase().includes(term) || 
            p.url.toLowerCase().includes(term)
        );
        renderList(filtered);
    });

    // --- NEW: PRESS ENTER TO OPEN FIRST RESULT ---
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Stop default input behavior
            
            // Find the first visible button in the list
            const firstButton = list.querySelector('.btn');
            
            // If a button exists, click it!
            if (firstButton) {
                firstButton.click();
            }
        }
    });

    // 3. IMPORT LOGIC
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (Array.isArray(json)) {
                    chrome.storage.local.set({ providers: json }, () => {
                        status.style.display = 'inline';
                        setTimeout(() => status.style.display = 'none', 2000);
                        allProviders = json;
                        renderList(allProviders);
                    });
                } else alert("Invalid JSON format");
            } catch (err) { alert("Error parsing JSON"); }
        };
        reader.readAsText(file);
    });

    // --- HELPER: Find Common Prefix ---
    function getCommonPrefix(strings) {
        if (!strings || strings.length === 0) return "";
        let prefix = strings[0];
        
        for (let i = 1; i < strings.length; i++) {
            while (strings[i].indexOf(prefix) !== 0) {
                prefix = prefix.substring(0, prefix.length - 1);
                if (prefix === "") return "";
            }
        }
        return prefix.replace(/[\s\-\(\)\[\]]+$/, "");
    }

    // --- RENDER FUNCTION ---
    function renderList(providers) {
        list.innerHTML = '';
        noResults.style.display = 'none';

        if (providers.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        // 1. Group by URL
        const groups = {};
        providers.forEach(p => {
            const url = p.url.trim().replace(/\/$/, ""); 
            if (!groups[url]) groups[url] = [];
            groups[url].push(p);
        });

        // 2. Sort Groups Alphabetically
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            return groups[a][0].name.localeCompare(groups[b][0].name);
        });

        // 3. Create Buttons
        sortedKeys.forEach(url => {
            const groupItems = groups[url];
            const btn = document.createElement('div');
            btn.className = 'btn';

            let label = "";
            let badge = "";

            if (groupItems.length > 1) {
                const allNames = groupItems.map(g => g.name);
                let commonName = getCommonPrefix(allNames);

                if (commonName.length < 2) { 
                    commonName = groupItems[0].name.split(/[\-\(]/)[0].trim();
                }

                label = `<strong>${commonName}</strong>`;
                badge = `<span style="font-size:10px; background:#555; padding:2px 6px; border-radius:10px; margin-left:8px;">${groupItems.length} Accounts</span>`;
            } else {
                label = groupItems[0].name;
            }

            btn.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
                                <span>${label}</span>
                                ${badge}
                             </div>`;
            
            btn.onclick = () => window.open(url, '_blank');

            list.appendChild(btn);
        });
    }
});