document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');

// Load data immediately
chrome.storage.local.get({ providers: [] }, (data) => {
  const allProviders = data.providers;

  // Render Function
  const render = (query) => {
    resultsDiv.innerHTML = '';
    const filtered = allProviders.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    
    filtered.forEach(p => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `<span class="item-name">${p.name}</span>`;
      div.onclick = () => {
        chrome.tabs.create({ url: p.url }); // Open the link
        window.close(); // Close the popup
      };
      resultsDiv.appendChild(div);
    });
  };

  // Initial render
  render('');

  // Live search
  searchInput.addEventListener('input', (e) => render(e.target.value));
});