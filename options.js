document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTS ---
    const pName = document.getElementById('pName');
    const pUrl = document.getElementById('pUrl');
    const inputsContainer = document.getElementById('inputsContainer');
    const addInputRowBtn = document.getElementById('addInputRow');
    const autoSubmit = document.getElementById('autoSubmit');
    const submitSel = document.getElementById('submitSel');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const formTitle = document.getElementById('formTitle');
    const providerList = document.getElementById('providerList');
    const status = document.getElementById('status');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');

    // STATE: Tracks if we are editing (-1 means NO, otherwise it's the index number)
    let editIndex = -1;

    // --- INITIALIZATION ---
    loadProviders();
    resetFormInputs(); // Ensure form starts with 2 empty rows

    // --- EVENT LISTENERS ---

    // Toggle Auto-Submit
    autoSubmit.addEventListener('change', () => {
        submitSel.style.display = autoSubmit.checked ? 'block' : 'none';
    });

    // Add New Input Row
    addInputRowBtn.addEventListener('click', () => addRow("", ""));

    // Cancel Edit
    cancelBtn.addEventListener('click', () => {
        clearForm();
        showStatus("Edit cancelled", "#666");
    });

    // Save (Create or Update)
    saveBtn.addEventListener('click', () => {
        const name = pName.value.trim();
        const url = pUrl.value.trim();
        
        if (!name || !url) {
            showStatus('Error: Name and URL are required.', 'red');
            return;
        }

        // Collect inputs
        const inputs = [];
        const rows = inputsContainer.querySelectorAll('.row');
        rows.forEach(row => {
            const sel = row.querySelector('.sel').value.trim();
            const val = row.querySelector('.val').value;
            if (sel) inputs.push({ sel, val });
        });

        if (inputs.length === 0) {
            showStatus('Error: Add at least one input.', 'red');
            return;
        }

        const providerData = {
            id: Date.now(),
            name,
            url,
            inputs,
            autoSubmit: autoSubmit.checked,
            submitSel: autoSubmit.checked ? submitSel.value.trim() : ""
        };

        chrome.storage.local.get({ providers: [] }, (data) => {
            const providers = data.providers;

            if (editIndex > -1) {
                // UPDATE EXISTING
                providers[editIndex] = providerData;
                showStatus('Provider Updated!', 'green');
            } else {
                // CREATE NEW
                providers.push(providerData);
                showStatus('Provider Saved!', 'green');
            }
            
            chrome.storage.local.set({ providers }, () => {
                clearForm();
                loadProviders();
            });
        });
    });

    // --- FUNCTIONS ---

    function loadProviders() {
        chrome.storage.local.get({ providers: [] }, (data) => {
            providerList.innerHTML = '';
            if (!data.providers || data.providers.length === 0) {
                providerList.innerHTML = '<p style="color:#666; text-align:center;">No providers saved yet.</p>';
                return;
            }

            data.providers.forEach((p, index) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div>
                        <strong>${escapeHtml(p.name)}</strong>
                        <div style="font-size:12px; color:#666; margin-top:2px;">${escapeHtml(p.url)}</div>
                    </div>
                    <div class="actions">
                        <button class="edit edit-btn" data-index="${index}">Edit</button>
                        <button class="danger delete-btn" data-index="${index}">Delete</button>
                    </div>
                `;
                providerList.appendChild(li);
            });

            // Attach Listeners
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => deleteProvider(e.target.dataset.index));
            });
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => loadProviderIntoForm(e.target.dataset.index));
            });
        });
    }

    function loadProviderIntoForm(index) {
        chrome.storage.local.get({ providers: [] }, (data) => {
            const p = data.providers[index];
            
            // Fill Fields
            pName.value = p.name;
            pUrl.value = p.url;
            autoSubmit.checked = p.autoSubmit;
            submitSel.value = p.submitSel || "";
            submitSel.style.display = p.autoSubmit ? 'block' : 'none';

            // Fill Inputs (Clear first, then add)
            inputsContainer.innerHTML = '';
            p.inputs.forEach(item => addRow(item.sel, item.val));

            // Set Edit Mode
            editIndex = parseInt(index);
            saveBtn.innerText = "Update Provider";
            formTitle.innerText = "Edit Provider";
            cancelBtn.style.display = "inline-block"; // Show cancel button
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function deleteProvider(index) {
        if(!confirm("Delete this provider?")) return;
        
        chrome.storage.local.get({ providers: [] }, (data) => {
            const providers = data.providers;
            providers.splice(index, 1);
            chrome.storage.local.set({ providers }, () => {
                loadProviders();
                // If we deleted the item we were currently editing, clear the form
                if (editIndex == index) clearForm();
            });
        });
    }

    function addRow(selVal, valVal) {
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
            <input type="text" class="sel" placeholder="#selector" value="${escapeHtml(selVal)}">
            <input type="text" class="val" placeholder="value" value="${escapeHtml(valVal)}">
            <button type="button" class="danger remove-row" style="padding: 5px 12px;">X</button>
        `;
        inputsContainer.appendChild(div);
        div.querySelector('.remove-row').addEventListener('click', () => div.remove());
    }

    function resetFormInputs() {
        inputsContainer.innerHTML = '';
        addRow('', '');
        addRow('', '');
    }

    function clearForm() {
        pName.value = '';
        pUrl.value = '';
        autoSubmit.checked = false;
        submitSel.value = '';
        submitSel.style.display = 'none';
        resetFormInputs();

        // Reset Edit Mode
        editIndex = -1;
        saveBtn.innerText = "Save Provider";
        formTitle.innerText = "Add New Provider";
        cancelBtn.style.display = "none";
    }

    function showStatus(msg, color) {
        status.innerText = msg;
        status.style.color = color;
        setTimeout(() => status.innerText = '', 3000);
    }

    function escapeHtml(text) {
        if (!text) return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // --- IMPORT / EXPORT ---
    exportBtn.addEventListener('click', () => {
        chrome.storage.local.get({ providers: [] }, (data) => {
            const blob = new Blob([JSON.stringify(data.providers, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "bo_config.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    });

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
                        showStatus('Imported Successfully!', 'green');
                        loadProviders();
                    });
                } else alert("Invalid JSON.");
            } catch (err) { alert("Error parsing JSON."); }
        };
        reader.readAsText(file);
    });
});