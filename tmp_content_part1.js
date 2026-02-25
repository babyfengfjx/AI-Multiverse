// === AI Multiverse Content Script ===
// Injected into AI chat pages to fill input and send messages

console.log('[AI Multiverse] Content script loaded on:', window.location.hostname);

// === Message Listener ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ status: 'alive' });
        return;
    }
    if (request.action === 'fill_and_send') {
        handleFillAndSend(request.text, request.provider, request.files || [])
            .then(() => sendResponse({ status: 'done' }))
            .catch((err) => sendResponse({ status: 'error', error: err.message }));
        return true;
    }
    if (request.action === 'extract_response') {
        const result = extractLatestResponse(request.provider);
        sendResponse(result);
        return;
    }
});

// === Extract Latest AI Response ===
function extractLatestResponse(provider) {
    let config = null;

    // Find config for this provider
    if (typeof AI_CONFIG !== 'undefined' && AI_CONFIG[provider]) {
        config = AI_CONFIG[provider];
    } else if (typeof AI_CONFIG !== 'undefined') {
        for (const key in AI_CONFIG) {
            const conf = AI_CONFIG[key];
            const domain = conf.urlPattern.replace('*://', '').replace('/*', '').split('/')[0];
            if (window.location.hostname.includes(domain)) {
                config = conf;
                break;
            }
        }
    }

    if (!config || !config.selectors || !config.selectors.response) {
        return { status: 'error', error: 'No response selectors configured' };
    }

    // Try each response selector, find the LAST matching element (most recent response)
    let lastEl = null;
    for (const sel of config.selectors.response) {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                lastEl = elements[elements.length - 1];

                // 针对通义千问：有时用户问题和助手回答使用同一种容器，
                // 这会导致我们总是取到最后一条「提问」而不是「回答」。
                // 这里做一个简单的启发式：优先选择文本更长的那一个。
                if (provider === 'qwen' && elements.length > 1) {
                    let best = lastEl;
                    let bestLen = (best.innerText || best.textContent || '').trim().length;
                    for (let i = elements.length - 1; i >= 0; i--) {
                        const t = (elements[i].innerText || elements[i].textContent || '').trim();
                        if (t.length > bestLen) {
                            best = elements[i];
                            bestLen = t.length;
                        }
                    }
                    lastEl = best;
                }

                break;
            }
        } catch (e) { /* invalid selector */ }
    }

    if (!lastEl) {
        // Fallback: try to find any common markdown/response container
        const fallbackSelectors = [
            '.markdown-body:last-of-type',
            '[class*="markdown"]:last-of-type',
            '[class*="message-content"]:last-of-type',
            '[class*="response"]:last-of-type',
        ];
        for (const sel of fallbackSelectors) {
            try {
                const elements = document.querySelectorAll(sel);
                if (elements.length > 0) {
                    lastEl = elements[elements.length - 1];
                    break;
                }
            } catch (e) { }
        }
    }

    if (!lastEl) {
        return { status: 'no_response', text: '' };
    }

    // Extract text content, preserving some structure
    const text = lastEl.innerText || lastEl.textContent || '';
    const trimmed = text.trim();

    if (!trimmed) {
        return { status: 'no_response', text: '' };
    }

    return {
        status: 'ok',
        text: trimmed,
        html: lastEl.innerHTML || '',
        length: trimmed.length
    };
}

// === Main Handler ===
async function handleFillAndSend(text, provider, files = []) {
    let config = null;

    // 1. Try to find config by provider ID passed from background
    if (typeof AI_CONFIG !== 'undefined' && AI_CONFIG[provider]) {
        config = AI_CONFIG[provider];
    } else {
        // Fallback: try to match by URL if provider ID is missing or invalid
        if (typeof AI_CONFIG !== 'undefined') {
            for (const key in AI_CONFIG) {
                const conf = AI_CONFIG[key];
                // Simple check: is the domain matching?
                // urlPattern: *://gemini.google.com/*
                const domain = conf.urlPattern.replace('*://', '').replace('/*', '').split('/')[0];
                if (window.location.hostname.includes(domain)) {
                    config = conf;
                    break;
                }
                if (conf.urlPatternAlt) {
                    const domainAlt = conf.urlPatternAlt.replace('*://', '').replace('/*', '').split('/')[0];
                    if (window.location.hostname.includes(domainAlt)) {
                        config = conf;
                        break;
                    }
                }
            }
        }
    }

    if (!config) {
        console.warn('No specific configuration found for this site, using strict defaults.');
        config = {
            selectors: {
                input: ['textarea', 'div[contenteditable="true"]'],
                button: ['button[type="submit"]']
            },
            sendMethod: 'enter',
            fillMethod: 'main-world',
        };
    } else if (!config.selectors) {
        // Should not happen if config is valid
        config.selectors = { input: [], button: [] };
    }

    // 1. Find Input Element
    let inputEl = null;
    for (let attempt = 0; attempt < 20; attempt++) {
        inputEl = findElement(config.selectors.input);
        if (inputEl) break;
        await delay(500);
    }

    if (!inputEl) throw new Error('Input element not found');

    console.log('[AI Multiverse] Target input found:', inputEl.tagName);

    // 2. Fill it
    const isKimi = provider === 'kimi' || /kimi\.moonshot\.cn|kimi\.com/i.test(window.location.hostname);
    // Kimi 的 UI 比较重，给它更长的时间完成内部状态更新，避免回车过早被吃掉
    const fillSettleDelay = isKimi ? 800 : 50;

    if (config.fillMethod === 'main-world') {
        await requestMainWorldFill(config.selectors.input[0], text, provider);
        await delay(fillSettleDelay);
    } else {
        await fillContentEditable(inputEl, text, provider);
        await delay(fillSettleDelay);
    }

    // 2.5 Upload files if provided
    if (files && files.length > 0 && config.supportsFiles) {
        console.log('[AI Multiverse] Uploading', files.length, 'files to', provider);
        await uploadFiles(files, config, provider);
    }

    // 3. Send it
    await sendMessage(inputEl, config, provider);
}

// Request background script to run executeScript in MAIN world
async function requestMainWorldFill(selector, text, provider) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'perform_main_world_fill',
            selector: selector,
            text: text,
            provider: provider // Pass provider to use specific logic
        }, (response) => {
            resolve(response);
        });
    });
}

// === ContentEditable Fill (Pure Content Script version) ===
async function fillContentEditable(element, text, provider) {
    const isKimi = provider === 'kimi' || /kimi\.moonshot\.cn|kimi\.com/i.test(window.location.hostname);

    element.focus();
    element.click();
    await delay(120);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand('delete', false, null);
    await delay(160);

    // 统一通过 execCommand('insertText') 模拟一次性粘贴
    document.execCommand('insertText', false, text);
    await delay(120);

    // 对 Kimi 额外手动触发一次 input/change，帮助它把发送按钮从不可点切换为可点
    if (isKimi) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// === Send Message ===
async function sendMessage(inputEl, config, provider) {
    const isAsyncUI = provider === 'deepseek' || provider === 'qwen' ||
        /deepseek|qwen|qianwen/i.test(window.location.hostname);

    const clickButton = async () => {
        const maxAttempts = isAsyncUI ? 60 : 80;
        const interval = isAsyncUI ? 60 : 100;

        for (let i = 0; i < maxAttempts; i++) {
            const targetEl = findElement(config.selectors.button);
            if (targetEl) {
                // 如果找到的是 SVG 等子元素，则提升到真正带点击行为的父节点
                const clickableBtn = targetEl.tagName === 'BUTTON' || targetEl.getAttribute('role') === 'button'
                    ? targetEl
                    : (targetEl.closest('button') || targetEl.closest('[role="button"]') || targetEl.closest('div[class*="Btn"]') || targetEl.closest('div[class*="slot"]') || targetEl);

                if (!clickableBtn) {
                    await delay(interval);
                    continue;
                }

                // 检查常见的禁用标记，避免在按钮灰掉时强行连点
                const isDisabled = clickableBtn.disabled ||
                    clickableBtn.getAttribute('aria-disabled') === 'true' ||
                    clickableBtn.classList.contains('disabled') ||
                    clickableBtn.classList.contains('ds-icon-button--disabled') ||
                    clickableBtn.classList.contains('kimi-disabled') ||
                    clickableBtn.closest('[class*="disabled"]');

                if (!isDisabled) {
                    // 模拟一次“正常人”点击：只触发一次 click 调用，杜绝多次发送
                    await delay(80);
                    if (typeof clickableBtn.click === 'function') {
                        clickableBtn.click();
                    } else {
                        clickableBtn.dispatchEvent(new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        }));
                    }
                    return true;
                }
            }

            // Fallback: 如果异步 UI 的发送按钮长时间不激活，则尝试一次 Enter 提交
            // 注意：Kimi 明确只走“点击发送”，不做 Enter 回退，避免重复发送。
            if (isAsyncUI && provider !== 'kimi' && i === 25) {
                console.log('[AI Multiverse] Fast fallback to Enter for', provider);
                sendEnterKey(inputEl);
                // 不立即 return，后续如果按钮激活，还会再尝试一次 click 以保证成功发送
            }

            await delay(interval);
        }
        return false;
    };

    switch (config.sendMethod) {
        case 'form': {
            const form = inputEl.closest('form');
            if (form) {
                await delay(100);
                try {
                    form.requestSubmit();
                    return;
                } catch (e) { }
            }
            if (await clickButton()) return;
            sendEnterKey(inputEl);
            break;
        }
        case 'button': {
            if (await clickButton()) {
                console.log('[AI Multiverse] Button click sequence executed');
            } else {
                console.log('[AI Multiverse] Active button not found, falling back to Enter');
                // 对 Kimi 不做 Enter 回退，只依赖按钮点击，符合“聚焦 → 粘贴 → 点击发送”的真实用户行为
                if (provider !== 'kimi') {
                    sendEnterKey(inputEl);
                }
            }
            break;
        }
        case 'enter':
        default:
            sendEnterKey(inputEl);
            break;
    }
}

function sendEnterKey(el) {
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keypress', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
}

function findElement(selectors) {
    // 1. Precise search (visible only)
    for (const sel of selectors) {
        try {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) return el;
        } catch (e) { }
    }
    // 2. Loose search
    for (const sel of selectors) {
        try {
            const el = document.querySelector(sel);
            if (el) return el;
        } catch (e) { }
    }
    return null;
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// === File Upload Functions ===

/**
 * Upload files to the AI platform
 * @param {Array} files - Array of file objects with { name, type, data, size }
 * @param {Object} config - Provider configuration
 * @param {string} provider - Provider name
 */
async function uploadFiles(files, config, provider) {
    const MAX_RETRIES = 2;
    const UPLOAD_TIMEOUT = 30000; // 30 seconds

    // Filter files based on provider's supported types
    const supportedFiles = filterSupportedFiles(files, config, provider);
    
    if (supportedFiles.length === 0) {
        console.warn('[AI Multiverse] No supported files for', provider);
        return;
    }

    if (supportedFiles.length < files.length) {
        console.warn('[AI Multiverse] Filtered out unsupported files for', provider);
    }

    // Upload each file with retry logic
    for (let i = 0; i < supportedFiles.length; i++) {
        const file = supportedFiles[i];
        console.log('[AI Multiverse] Uploading file', i + 1, '/', supportedFiles.length, ':', file.name);
        
        let lastError = null;
        let success = false;

        for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
            if (retry > 0) {
                console.log('[AI Multiverse] Retry', retry, '/', MAX_RETRIES, 'for', file.name);
                await delay(1000 * retry); // Exponential backoff
            }

            try {
                await Promise.race([
                    uploadSingleFile(file, config, provider),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Upload timeout')), UPLOAD_TIMEOUT)
                    )
                ]);
                console.log('[AI Multiverse] File uploaded successfully:', file.name);
                success = true;
            } catch (error) {
                lastError = error;
                console.error('[AI Multiverse] Upload attempt', retry + 1, 'failed:', file.name, error.message);
            }
        }

        if (!success) {
            throw new Error(`File upload failed after ${MAX_RETRIES + 1} attempts: ${file.name} - ${lastError.message}`);
        }
    }
}

/**
 * Filter files based on provider's supported types
 */
function filterSupportedFiles(files, config, provider) {
    if (!config.supportsFiles || !config.supportedFileTypes) {
        console.warn('[AI Multiverse] Provider', provider, 'does not support file uploads');
        return [];
    }

    return files.filter(file => {
        const fileType = file.type;
        const fileName = file.name;
        const supportedTypes = config.supportedFileTypes;

        for (const type of supportedTypes) {
            // Check MIME type exact match
            if (type === fileType) return true;
            
            // Check file extension
            if (type.startsWith('.')) {
                if (fileName.toLowerCase().endsWith(type.toLowerCase())) return true;
            } else if (type.startsWith('.*')) {
                const ext = type.substring(1);
                if (fileName.endsWith(ext)) return true;
            }
            
            // Check wildcard MIME type (e.g., image/*)
            if (type.endsWith('/*')) {
                const prefix = type.substring(0, type.length - 1);
                if (fileType.startsWith(prefix)) return true;
            }
        }

        console.warn('[AI Multiverse] File not supported:', fileName, '| Type:', fileType, '| Provider:', provider);
        return false;
    });
}

/**
 * Upload a single file
 */
async function uploadSingleFile(file, config, provider) {
    // Different upload strategies per provider
    switch (provider) {
        case 'gemini':
            await uploadToGemini(file, config);
            break;
        case 'chatgpt':
            await uploadToChatGPT(file, config);
            break;
        case 'grok':
            await uploadToGrok(file, config);
            break;
        case 'kimi':
            await uploadToKimi(file, config);
            break;
        case 'deepseek':
            await uploadToDeepSeek(file, config);
            break;
        case 'qwen':
            await uploadToQwen(file, config);
            break;
        case 'yuanbao':
            await uploadToYuanbao(file, config);
            break;
        default:
            console.warn('[AI Multiverse] Unknown provider for file upload:', provider);
    }
}

/**
 * Upload file to Gemini
 */
