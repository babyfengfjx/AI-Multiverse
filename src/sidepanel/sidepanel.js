/**
 * AI Multiverse - Sidepanel Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    // --- State & Config ---
    const AI_PROVIDERS = ['gemini', 'grok', 'kimi', 'deepseek', 'chatgpt', 'qwen', 'yuanbao'];
    let lastResponses = {};

    // --- DOM Elements ---
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('sendBtn');
    const launchBtn = document.getElementById('launchBtn');
    const tileBtn = document.getElementById('tileBtn');
    const closeAllBtn = document.getElementById('closeAllBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const historyList = document.getElementById('historyList');
    const statusPanel = document.getElementById('status');
    const fetchResponsesBtn = document.getElementById('fetchResponsesBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const responsesGrid = document.getElementById('responsesGrid');
    const selectionBadge = document.getElementById('selectionBadge');

    // Modal
    const modelsModal = document.getElementById('modelsModal');
    const openModelsBtn = document.getElementById('openModelsBtn');
    const closeModelsBtn = document.getElementById('closeModelsBtn');
    const confirmModelsBtn = document.getElementById('confirmModelsBtn');

    // Detail Modal
    const detailModal = document.getElementById('detailModal');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const copyDetailBtn = document.getElementById('copyDetailBtn');
    const detailIcon = document.getElementById('detailIcon');
    const detailName = document.getElementById('detailName');
    const detailText = document.getElementById('detailText');

    // --- Initialization ---
    loadSelectedProviders();
    renderHistory();
    updateBadge();

    // --- Tab Switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId + 'Tab').classList.add('active');

            if (tabId === 'responses') {
                fetchResponses();
            }
        });
    });

    // --- Model Selection Modal ---
    function toggleModal(show) {
        if (show) modelsModal.classList.add('active');
        else modelsModal.classList.remove('active');
    }

    openModelsBtn.addEventListener('click', () => toggleModal(true));
    closeModelsBtn.addEventListener('click', () => toggleModal(false));
    confirmModelsBtn.addEventListener('click', () => {
        saveSelectedProviders();
        updateBadge();
        toggleModal(false);
    });

    modelsModal.addEventListener('click', (e) => {
        if (e.target === modelsModal) toggleModal(false);
    });

    // --- Response Detail Modal ---
    function showDetail(providerId, data) {
        const config = (typeof AI_CONFIG !== 'undefined') ? AI_CONFIG[providerId] : null;
        detailIcon.src = config ? config.icon : '';
        detailName.textContent = config ? config.name : providerId;
        detailText.textContent = data.text || '';
        detailModal.classList.add('active');

        copyDetailBtn.onclick = () => {
            navigator.clipboard.writeText(data.text).then(() => {
                copyDetailBtn.textContent = 'Copied!';
                setTimeout(() => copyDetailBtn.textContent = 'Copy This Response', 1500);
            });
        };
    }

    closeDetailBtn.onclick = () => detailModal.classList.remove('active');
    detailModal.onclick = (e) => { if (e.target === detailModal) detailModal.classList.remove('active'); };

    // --- Input Logic ---
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + 'px';
    });

    sendBtn.addEventListener('click', sendMessage);
    launchBtn.addEventListener('click', () => {
        const providers = getSelectedProviders();
        if (providers.length === 0) { toggleModal(true); return; }
        chrome.runtime.sendMessage({ action: 'launch_only_providers', providers });
    });

    tileBtn.addEventListener('click', () => {
        const providers = getSelectedProviders();
        chrome.runtime.sendMessage({ action: 'tile_windows', providers });
    });

    closeAllBtn.addEventListener('click', () => {
        if (confirm('Close all AI windows?')) {
            chrome.runtime.sendMessage({ action: 'close_all_windows' });
        }
    });

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all conversation history?')) {
            chrome.storage.local.set({ chat_history: [] }, () => renderHistory());
        }
    });

    // --- Core Functions ---

    function getSelectedProviders() {
        return AI_PROVIDERS.filter(p => {
            const el = document.getElementById(p);
            return el && el.checked;
        });
    }

    function saveSelectedProviders() {
        chrome.storage.local.set({ selected_providers: getSelectedProviders() });
    }

    function loadSelectedProviders() {
        chrome.storage.local.get(['selected_providers'], (result) => {
            if (result.selected_providers) {
                AI_PROVIDERS.forEach(p => {
                    const el = document.getElementById(p);
                    if (el) el.checked = result.selected_providers.includes(p);
                });
                updateBadge();
            }
        });
    }

    function updateBadge() {
        const count = getSelectedProviders().length;
        selectionBadge.textContent = count;
        selectionBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    async function sendMessage() {
        const text = promptInput.value.trim();
        if (!text) return;

        const providers = getSelectedProviders();
        if (providers.length === 0) { toggleModal(true); return; }

        addToHistory(text, providers);
        promptInput.value = '';
        promptInput.style.height = 'auto';

        logStatus('System', 'Sending...', 'info');

        chrome.runtime.sendMessage({
            action: 'broadcast_message',
            message: text,
            providers: providers
        });
    }

    function addToHistory(text, providers) {
        chrome.storage.local.get(['chat_history'], (result) => {
            const history = result.chat_history || [];
            history.push({ text, providers, timestamp: new Date().toISOString() });
            if (history.length > 50) history.shift();
            chrome.storage.local.set({ chat_history: history }, () => renderHistory());
        });
    }

    function renderHistory() {
        chrome.storage.local.get(['chat_history'], (result) => {
            const history = result.chat_history || [];
            historyList.innerHTML = '';
            if (history.length === 0) {
                historyList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:12px;">No messages yet.</div>';
                return;
            }
            history.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'history-item';
                const txt = document.createElement('div');
                txt.className = 'history-text';
                txt.textContent = entry.text;
                const footer = document.createElement('div');
                footer.className = 'history-footer';
                const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                footer.innerHTML = `<span class="history-meta">${time} • ${entry.providers.length} AIs</span>`;
                const resend = document.createElement('button');
                resend.className = 'history-resend';
                resend.innerHTML = '↺';
                resend.onclick = () => { promptInput.value = entry.text; promptInput.focus(); };
                footer.appendChild(resend);
                item.appendChild(txt);
                item.appendChild(footer);
                historyList.appendChild(item);
            });
            setTimeout(() => { historyList.scrollTop = historyList.scrollHeight; }, 50);
        });
    }

    async function fetchResponses() {
        const providers = getSelectedProviders();
        if (providers.length === 0) return;
        fetchResponsesBtn.disabled = true;
        fetchResponsesBtn.querySelector('span').textContent = 'Fetching...';
        responsesGrid.innerHTML = '';
        providers.forEach(p => {
            const config = (typeof AI_CONFIG !== 'undefined') ? AI_CONFIG[p] : null;
            responsesGrid.appendChild(createResponseCard(p, config ? config.name : p, config ? config.icon : '', { status: 'loading' }));
        });

        chrome.runtime.sendMessage({ action: 'fetch_all_responses', providers }, (result) => {
            fetchResponsesBtn.disabled = false;
            fetchResponsesBtn.querySelector('span').textContent = 'Fetch Responses';
            if (result && result.status === 'ok') {
                lastResponses = result.responses;
                renderResponses(result.responses, providers);
            }
        });
    }

    function renderResponses(responses, providers) {
        responsesGrid.innerHTML = '';
        providers.forEach(p => {
            const data = responses[p] || { status: 'error', error: 'Missing' };
            const config = (typeof AI_CONFIG !== 'undefined') ? AI_CONFIG[p] : null;
            const card = createResponseCard(p, config ? config.name : p, config ? config.icon : '', data);
            if (data.status === 'ok') card.onclick = () => showDetail(p, data);
            responsesGrid.appendChild(card);
        });
    }

    function createResponseCard(id, name, icon, data) {
        const card = document.createElement('div');
        card.className = 'response-card';
        const header = document.createElement('div');
        header.className = 'response-card-header';
        const info = document.createElement('div');
        info.className = 'response-card-info';
        if (icon) {
            const img = document.createElement('img');
            img.src = icon;
            img.className = 'provider-icon-img';
            img.onerror = () => { img.style.display = 'none'; };
            info.appendChild(img);
        }
        info.innerHTML += `<span>${name}</span>`;
        const badge = document.createElement('div');
        badge.className = 'response-char-count';
        if (data.status === 'ok' && data.text) badge.textContent = `${data.text.length} ch`;
        header.appendChild(info);
        header.appendChild(badge);
        const body = document.createElement('div');
        body.className = 'response-card-body';
        if (data.status === 'loading') body.innerHTML = '<span>Extracting...</span>';
        else if (data.status === 'ok') body.textContent = data.text;
        else body.innerHTML = `<span style="color:var(--error)">${data.error || 'Error'}</span>`;
        card.appendChild(header);
        card.appendChild(body);
        return card;
    }

    copyAllBtn.onclick = () => {
        let text = '=== Comparison ===\n\n';
        for (const [id, data] of Object.entries(lastResponses)) {
            if (data.status === 'ok') text += `━ ${id} ━\n${data.text}\n\n`;
        }
        navigator.clipboard.writeText(text).then(() => {
            copyAllBtn.innerHTML = '<span>Copied!</span>';
            setTimeout(() => copyAllBtn.innerHTML = '<span>Copy All</span>', 1500);
        });
    };

    function logStatus(provider, message, type = 'info') {
        const dot = document.querySelector('.status-dot');
        dot.style.backgroundColor = type === 'error' ? 'var(--error)' : 'var(--accent)';
        statusPanel.style.width = '100%';
        setTimeout(() => { statusPanel.style.width = '2px'; }, 2000);
    }
});
