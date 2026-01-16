let editingId = null; // Tracks if we are editing an existing provider

document.addEventListener('DOMContentLoaded', loadProviders);

// 1. UI Logic: Show/Hide Submit Selector based on checkbox
document.getElementById('autoSubmit').addEventListener('change', (e) => {
  document.getElementById('submitSel').style.display = e.target.checked ? 'block' : 'none';
});

// 2. UI Logic: Add more input rows
document.getElementById('addInputRow').addEventListener('click', () => addInputRowUI('', ''));

// Helper to add a row to the UI (used by both "Add New" and "Edit")
function addInputRowUI(selVal = '', valVal = '') {
  const div = document.createElement('div');
  div.className = 'row';
  div.innerHTML = `
    <input type="text" class="sel" placeholder="Selector (e.g. #otp)" value="${selVal}">
    <input type="text" class="val" placeholder="Value" value="${valVal}">
    <button type="button" class="danger" onclick="this.parentElement.remove()">X</button>
  `;
  document.getElementById('inputsContainer').appendChild(div);
}

// 3. Save / Update Logic
document.getElementById('saveBtn').addEventListener('click', () => {
  const name = document.getElementById('pName').value;
  const url = document.getElementById('pUrl').value;
  const autoSubmit = document.getElementById('autoSubmit').checked;
  const submitSel = document.getElementById('submitSel').value;

  // Gather all selector/value pairs
  const inputs = [];
  document.querySelectorAll('#inputsContainer .row').forEach(row => {
    const sel = row.querySelector('.sel').value;
    const val = row.querySelector('.val').value;
    if (sel && val) inputs.push({ sel, val });
  });

  if (!name || !url) { alert('Name and URL are required'); return; }

  chrome.storage.local.get({ providers: [] }, (data) => {
    let providers = data.providers;

    if (editingId) {
      // UPDATE EXISTING
      const index = providers.findIndex(p => p.id === editingId);
      if (index > -1) {
        providers[index] = { id: editingId, name, url, inputs, autoSubmit, submitSel };
      }
      editingId = null; // Reset edit mode
      document.getElementById('saveBtn').textContent = "Save Provider";
    } else {
      // CREATE NEW
      const newProvider = { id: Date.now(), name, url, inputs, autoSubmit, submitSel };
      providers.push(newProvider);
    }

    chrome.storage.local.set({ providers }, () => {
      loadProviders();
      clearForm();
      showStatus('Saved!');
    });
  });
});

// 4. Load & Render List
function loadProviders() {
  chrome.storage.local.get({ providers: [] }, (data) => {
    const list = document.getElementById('providerList');
    list.innerHTML = '';
    data.providers.forEach((p) => {
      const li = document.createElement('li');
      li.style.marginBottom = "10px";
      li.innerHTML = `<strong>${p.name}</strong> <br> <span style="font-size:0.8em; color:#666;">${p.url}</span> `;
      
      const btnContainer = document.createElement('div');
      btnContainer.style.marginTop = "5px";

      // EDIT BUTTON
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'secondary';
      editBtn.style.marginRight = '5px';
      editBtn.onclick = () => loadProviderIntoForm(p);

      // DELETE BUTTON
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'danger';
      delBtn.onclick = () => deleteProvider(p.id);

      btnContainer.appendChild(editBtn);
      btnContainer.appendChild(delBtn);
      li.appendChild(btnContainer);
      list.appendChild(li);
    });
  });
}

// 5. Load Data into Form for Editing
function loadProviderIntoForm(p) {
  editingId = p.id; // Mark that we are editing this ID
  
  document.getElementById('pName').value = p.name;
  document.getElementById('pUrl').value = p.url;
  document.getElementById('autoSubmit').checked = p.autoSubmit || false;
  document.getElementById('submitSel').value = p.submitSel || '';
  document.getElementById('submitSel').style.display = p.autoSubmit ? 'block' : 'none';

  // Clear existing input rows
  document.getElementById('inputsContainer').innerHTML = '';
  
  // Re-create input rows from saved data
  if (p.inputs && p.inputs.length > 0) {
    p.inputs.forEach(item => addInputRowUI(item.sel, item.val));
  } else {
    // Default empty row if none exist
    addInputRowUI(); 
  }

  // Scroll to top and change button text
  window.scrollTo(0,0);
  document.getElementById('saveBtn').textContent = "Update Provider";
}

function deleteProvider(id) {
  if(!confirm("Are you sure?")) return;
  chrome.storage.local.get({ providers: [] }, (data) => {
    const newProviders = data.providers.filter(p => p.id !== id);
    chrome.storage.local.set({ providers: newProviders }, loadProviders);
  });
}

function clearForm() {
  editingId = null;
  document.getElementById('saveBtn').textContent = "Save Provider";
  document.getElementById('pName').value = '';
  document.getElementById('pUrl').value = '';
  document.getElementById('autoSubmit').checked = false;
  document.getElementById('submitSel').style.display = 'none';
  document.getElementById('submitSel').value = '';
  
  // Reset to one empty input row
  document.getElementById('inputsContainer').innerHTML = '';
  addInputRowUI();
}

function showStatus(msg) {
  const status = document.getElementById('status');
  status.textContent = msg;
  setTimeout(() => status.textContent = '', 2000);
}

// Import/Export logic remains the same (omitted for brevity, keep your existing export/import code below if you want)
document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get({ providers: [] }, (data) => {
    const blob = new Blob([JSON.stringify(data.providers, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bo_config.json';
    a.click();
  });
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const providers = JSON.parse(event.target.result);
      chrome.storage.local.set({ providers }, () => {
        loadProviders();
        showStatus('Config Imported!');
      });
    } catch (err) { alert('Invalid JSON'); }
  };
  reader.readAsText(file);
});