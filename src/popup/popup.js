document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('prompt');
    const statusLog = document.getElementById('statusLog');
    
    // Load saved preferences
    chrome.storage.local.get(['selectedProviders'], (result) => {
        if (result.selectedProviders) {
            result.selectedProviders.forEach(provider => {
                const checkbox = document.getElementById(provider);
                if (checkbox) checkbox.checked = true;
            });
        }
    });

    sendBtn.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;

        const selectedProviders = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        // Save preference
        chrome.storage.local.set({ selectedProviders });

        // Update UI
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        chrome.runtime.sendMessage({
            action: 'broadcast_message',
            message: message,
            providers: selectedProviders
        }, (response) => {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send to All';

            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            
            console.log('Broadcast initiated:', response);
        });
    });

    // Listen for status updates from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'status_update') {
            const logEntry = document.createElement('div');
            logEntry.className = `status-line ${request.status === 'success' ? 'status-success' : 'status-error'}`;
            logEntry.textContent = `[${request.provider}] ${request.message}`;
            
            const statusContainer = document.getElementById('status');
            statusContainer.style.display = 'block';
            statusContainer.appendChild(logEntry);
            statusContainer.scrollTop = statusContainer.scrollHeight;
        }
    });
});
