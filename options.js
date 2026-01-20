document.getElementById('save').addEventListener('click', () => {
    const url = document.getElementById('sheetUrl').value.trim();
    if (!url) return;

    chrome.storage.local.set({ sheetUrl: url }, () => {
        document.getElementById('status').innerText = "Saved! Open popup to load data.";
        document.getElementById('status').style.color = "#4caf50";
    });
});

chrome.storage.local.get(['sheetUrl'], (res) => {
    if (res.sheetUrl) document.getElementById('sheetUrl').value = res.sheetUrl;
});