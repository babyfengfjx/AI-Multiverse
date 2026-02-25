// === AI Multiverse Content Script ===
// Injected into AI chat pages to fill input and send messages

console.log('[AI Multiverse] Content script loaded on:', window.location.hostname);

// === Constants ===
const DELAY = {
    SHORT: 50,
    MEDIUM: 120,
    LONG: 500,
    VERY_LONG: 1000,
    EXTRA_LONG: 1500,
    RETRY: 1000,
};
const UPLOAD_DELAY = 1000;
const UPLOAD_DELAY_LONG = 1500;
const MAX_RETRIES = 2;
const UPLOAD_TIMEOUT = 30000; // 30 seconds
const MAX_INPUT_WAIT_ATTEMPTS = 20;
const MAX_BUTTON_WAIT_ATTEMPTS_ASYNC = 60;
const MAX_BUTTON_WAIT_ATTEMPTS_SYNC = 80;
const BUTTON_WAIT_INTERVAL_ASYNC = 60;
const BUTTON_WAIT_INTERVAL_SYNC = 100;
const INPUT_WAIT_INTERVAL = 500;

// === Helper: delay ===
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Basic text sanitization - prevents HTML injection
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    // Remove HTML tags
    return text.replace(/<[^>]*>/g, '');
}

/**
 * Remove reasoning/thinking blocks from AI response
 * Some models (DeepSeek R1, ChatGPT o1, etc.) include step-by-step reasoning
 * before the final answer. This function filters out those parts.
 * @param {HTMLElement} element - DOM element containing the response
 * @param {string} provider - Provider name for special handling
 * @returns {HTMLElement} - Cloned element with thinking blocks removed
 */
function removeThinkingBlocks(element, provider = '') {
    // Clone to avoid modifying the original DOM
    const cloned = element.cloneNode(true);

    // For Yuanbao (腾讯元宝), the deep search component has thinking + answer
    // Structure: .hyc-component-deepsearch-cot
    //   ├── .hyc-component-deepsearch-cot__think (thinking - REMOVE)
    //   └── .hyc-content-md (answer - KEEP)
    if (provider === 'yuanbao') {
        const deepSearchComponents = cloned.querySelectorAll('.hyc-component-deepsearch-cot');
        console.log(`[AI Multiverse] Found ${deepSearchComponents.length} deep search components in Yuanbao response`);

        deepSearchComponents.forEach(component => {
            // Remove only the thinking child, keep the answer content
            const thinkingSections = component.querySelectorAll('.hyc-component-deepsearch-cot__think');
            console.log(`[AI Multiverse] Removing ${thinkingSections.length} thinking sections from component`);
            thinkingSections.forEach(el => el.remove());
        });

        return cloned;
    }

    // 1. Remove elements with 'thinking'/'reasoning' keywords in class names
    const thinkingClasses = ['thinking', 'reasoning', 'thought', 'chain-of-thought', 'cot'];
    thinkingClasses.forEach(cls => {
        const els = cloned.querySelectorAll(`[class*="${cls}"]`);
        els.forEach(el => el.remove());
    });

    // 2. Remove elements with specific data attributes (some platforms use them)
    const dataAttributes = ['data-thinking', 'data-reasoning'];
    dataAttributes.forEach(attr => {
        const els = cloned.querySelectorAll(`[${attr}]`);
        els.forEach(el => el.remove());
    });

    // 3. Remove collapsible reasoning blocks (common in ChatGPT o1)
    const collapsibleSelectors = [
        '[aria-label*="Reasoning"]',
        '[aria-label*="Thinking"]',
        'details[summary*="thought"]',
        'details[summary*="Thinking"]',
        '.reasoning-block'
    ];
    collapsibleSelectors.forEach(sel => {
        try {
            const els = cloned.querySelectorAll(sel);
            els.forEach(el => el.remove());
        } catch (e) { /* ignore invalid selectors */ }
    });

    return cloned;
}

/**
 * Filter out thinking lines from text content
 * Handles cases where thinking content is embedded in the text
 * @param {string} text - Raw text content
 * @returns {string} - Text with thinking blocks removed
 */
function filterThinkingText(text) {
    // Remove thinking blocks (e.g., "Thinking: ...", "Reasoning: ...")
    // Pattern 1: "Thinking:" or "思考：" at start of line, with content until next main section
    const thinkingPattern1 = /^(Thinking|Reasoning|思考|推理|Thought)[:：]\s*\n((?:[ \t].*\n)+)/gim;
    text = text.replace(thinkingPattern1, '');

    // Pattern 2: Thinking in quotes or brackets (e.g., "Let's think step by step...")
    const thinkingPattern2 = /``[\s\S]*?thinking[\s\S]*?``/gi;
    text = text.replace(thinkingPattern2, '');

    // Pattern 3: Remove empty lines after filtering
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}

// === Diagnose Selectors (Debug Tool) ===
function diagnoseSelectors(provider) {
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
        return { status: 'error', message: 'No response selectors configured' };
    }

    const results = [];
    const selectors = config.selectors.response;

    selectors.forEach((sel, idx) => {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                const lastEl = elements[elements.length - 1];
                const text = (lastEl.innerText || lastEl.textContent || '').trim();
                results.push({
                    selector: sel,
                    found: elements.length,
                    lastElementLength: text.length,
                    lastElementPreview: text.substring(0, 100),
                    valid: text.length > 0
                });
            } else {
                results.push({
                    selector: sel,
                    found: 0,
                    lastElementLength: 0,
                    lastElementPreview: '',
                    valid: false
                });
            }
        } catch (e) {
            results.push({
                selector: sel,
                found: 0,
                lastElementLength: 0,
                lastElementPreview: '',
                valid: false,
                error: e.message
            });
        }
    });

    // Find best selector
    const best = results.filter(r => r.valid).sort((a, b) => b.lastElementLength - a.lastElementLength)[0];

    return {
        status: 'ok',
        provider: provider,
        url: window.location.href,
        hostname: window.location.hostname,
        results: results,
        bestSelector: best ? best.selector : null,
        bestLength: best ? best.lastElementLength : 0
    };
}

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
            const elements = document.querySelectorAll(`${sel}:not([data-multiverse-old="true"])`);
            if (elements.length > 0) {
                // Always use the last element (most recent response)
                lastEl = elements[elements.length - 1];

                // 如果找到了有效内容，就使用这个选择器
                const testText = (lastEl.innerText || lastEl.textContent || '').trim();
                const hasSvg = lastEl.querySelector('svg') !== null;
                if (testText.length > 0 || hasSvg) {
                    console.log(`[AI Multiverse] Found response using selector: ${sel}, length: ${testText.length}, hasSvg: ${hasSvg}`);
                    break;
                }
            }
        } catch (e) {
            console.warn(`[AI Multiverse] Selector failed: ${sel}`, e);
        }
    }

    if (!lastEl) {
        // Fallback: try to find any common markdown/response container
        const fallbackSelectors = [
            '.markdown-body:not([data-multiverse-old="true"])',
            '[class*="markdown"]:not([data-multiverse-old="true"])',
            '[class*="message-content"]:not([data-multiverse-old="true"])',
            '[class*="response"]:not([data-multiverse-old="true"])',
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

    // Remove thinking/reasoning blocks from the DOM element
    const cleanedEl = removeThinkingBlocks(lastEl, provider);

    // Extract text content from cleaned element
    const text = cleanedEl.innerText || cleanedEl.textContent || '';
    let trimmed = text.trim();

    // Additional text-based filtering for embedded thinking content
    // Skip aggressive text filtering for Yuanbao to preserve content
    if (provider !== 'yuanbao') {
        trimmed = filterThinkingText(trimmed);
    }

    // Clean up excessive blank lines (more than 2 consecutive newlines)
    // This is especially important for Grok which tends to have many empty lines
    trimmed = trimmed.replace(/\n{3,}/g, '\n\n');

    // Get the HTML content - preserve original formatting
    // Clone the element to avoid modifying the original page
    const clonedEl = cleanedEl.cloneNode(true);

    // Remove unwanted elements from the clone (buttons, icons, etc.)
    const unwantedSelectors = [
        'button',
        '[role="button"]',
        '.copy-btn',
        '.download-btn',
        '[class*="copy"]',
        '[class*="Copy"]',
        '[class*="download"]',
        '[class*="Download"]',
        '[class*="icon"]',
        '[class*="Icon"]',
        '[aria-label*="copy"]',
        '[aria-label*="Copy"]',
        '[aria-label*="复制"]',
        '[aria-label*="下载"]',
        '[aria-label*="download"]',
        '[title*="copy"]',
        '[title*="Copy"]',
        '[title*="复制"]',
        '[title*="下载"]',
        '[title*="download"]',
        'svg[class*="copy"]',
        'svg[class*="Copy"]',
        'svg[aria-label*="copy"]',
        'svg[aria-label*="Copy"]',
        'svg[aria-label*="复制"]',
        // Kimi specific: remove copy icons and text
        'span:has(svg) + span:contains("复制")',
        'div:has(svg[class*="copy"])',
        'div:has(svg[aria-label*="复制"])',
        // Generic: remove any element that only contains "复制" or "Copy"
        'span:only-child:contains("复制")',
        'span:only-child:contains("Copy")',
        'div:only-child:contains("复制")',
        'div:only-child:contains("Copy")'
    ];

    unwantedSelectors.forEach(selector => {
        try {
            clonedEl.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) { /* ignore invalid selectors */ }
    });

    // Additional cleanup: remove standalone SVG icons that might be copy buttons
    try {
        const svgs = clonedEl.querySelectorAll('svg');
        svgs.forEach(svg => {
            const parent = svg.parentElement;
            // If SVG is in a small container with minimal text, likely a button
            if (parent && parent.textContent.trim().length < 10) {
                const text = parent.textContent.trim().toLowerCase();
                if (text.includes('复制') || text.includes('copy') || text === '') {
                    parent.remove();
                }
            }
        });
    } catch (e) { /* ignore */ }

    // Remove empty elements that might be left after button removal
    try {
        clonedEl.querySelectorAll('div:empty, span:empty').forEach(el => {
            // Don't remove if it has a background or border (might be intentional spacing)
            const style = window.getComputedStyle(el);
            if (!style.backgroundImage && !style.backgroundColor && !style.border) {
                el.remove();
            }
        });
    } catch (e) { /* ignore */ }

    const html = clonedEl.innerHTML || '';

    if (!trimmed) {
        // 使用fallback机制获取文本
        const fallbackText = (lastEl.innerText || lastEl.textContent || '').trim();
        if (fallbackText) {
            // Also clean up fallback text
            const cleanedFallback = fallbackText.replace(/\n{3,}/g, '\n\n');
            return {
                status: getGenerationStatus(provider, lastEl),
                text: cleanedFallback,
                html: html,
                length: cleanedFallback.length
            };
        }
        return { status: 'no_response', text: '' };
    }

    return {
        status: getGenerationStatus(provider, lastEl),
        text: trimmed,
        html: html,
        length: trimmed.length
    };
}

// === Check if provider is generating ===
function getGenerationStatus(provider, lastEl) {
    let isGenerating = false;

    // 1. Check for animated/streaming classes on the response element itself
    if (lastEl) {
        if (lastEl.classList.contains('result-streaming') ||
            lastEl.classList.contains('streaming') ||
            lastEl.classList.contains('ds-markdown--streaming')) {
            isGenerating = true;
        }

        // Also check parent elements up to 3 levels
        let parent = lastEl.parentElement;
        let depth = 0;
        while (parent && depth < 3) {
            if (parent.classList.contains('result-streaming') ||
                parent.classList.contains('streaming') ||
                parent.classList.contains('ds-markdown--streaming')) {
                isGenerating = true;
                break;
            }
            parent = parent.parentElement;
            depth++;
        }
    }

    // 2. Check for common "Stop" or "停止" buttons
    if (!isGenerating) {
        const stopSelectors = [
            'button[aria-label*="Stop"]',
            'button[aria-label*="停止"]',
            'button[aria-label*="Pause"]',
            'button[aria-label*="暂停"]',
            'button[data-testid*="stop"]',
            '[class*="stop-button"]',
            '[class*="StopButton"]',
            'div[class*="stop-"]',
            '[data-icon-type*="stop"]',
            '.stopButton',
            'button.stop',
            '.ds-icon-button--stop'
        ];

        for (const sel of stopSelectors) {
            try {
                const stopBtns = document.querySelectorAll(sel);
                const visibleStopBtn = Array.from(stopBtns).find(btn => btn.offsetParent !== null || (btn.getBoundingClientRect && btn.getBoundingClientRect().width > 0));

                if (visibleStopBtn) {
                    console.log(`[AI Multiverse] Detected generating state via stop button: ${sel}`);
                    isGenerating = true;
                    break;
                }
            } catch (e) { /* ignore invalid selectors */ }
        }
    }

    // 3. Provider specific checks
    if (!isGenerating) {
        if (provider === 'kimi') {
            const stopBtn = document.querySelector('.stopButton') || Array.from(document.querySelectorAll('button')).find(btn => btn.innerText && btn.innerText.includes('停止'));
            if (stopBtn && stopBtn.offsetParent !== null) {
                isGenerating = true;
            }
        } else if (provider === 'grok') {
            const stopBtn = document.querySelector('button[aria-label="Pause generation"]');
            if (stopBtn && stopBtn.offsetParent !== null) {
                isGenerating = true;
            }
        } else if (provider === 'gemini') {
            const animator = document.querySelector('model-response-animator');
            if (animator && animator.offsetParent !== null) {
                isGenerating = true;
            }
        }
    }

    return isGenerating ? 'generating' : 'ok';
}


// === Main Handler ===
async function handleFillAndSend(text, provider, files = []) {
    console.log('[AI Multiverse Content] handleFillAndSend called');
    console.log('[AI Multiverse Content] Provider:', provider);
    console.log('[AI Multiverse Content] Text length:', text?.length);
    console.log('[AI Multiverse Content] Text first 300 chars:', text?.substring(0, 300));
    console.log('[AI Multiverse Content] Files count:', files?.length);

    // Input validation
    if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text input');
    }
    if (!provider || typeof provider !== 'string') {
        throw new Error('Invalid provider');
    }
    if (!files || !Array.isArray(files)) {
        console.warn('[AI Multiverse] Invalid files array, treating as empty');
        files = [];
    }

    let config = null;

    // 1. Try to find config by provider ID passed from background
    console.log('[AI Multiverse] Looking for config, AI_CONFIG defined:', typeof AI_CONFIG !== 'undefined');
    if (typeof AI_CONFIG !== 'undefined' && AI_CONFIG[provider]) {
        config = AI_CONFIG[provider];
        console.log('[AI Multiverse] Found config for provider:', provider);
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

    // 0. Mark existing responses as old
    if (config.selectors.response) {
        config.selectors.response.forEach(sel => {
            try {
                document.querySelectorAll(sel).forEach(el => el.setAttribute('data-multiverse-old', 'true'));
            } catch (e) { }
        });
    }

    // 1. Find Input Element
    let inputEl = null;
    for (let attempt = 0; attempt < MAX_INPUT_WAIT_ATTEMPTS; attempt++) {
        inputEl = findElement(config.selectors.input);
        if (inputEl) break;
        await delay(DELAY.LONG);
    }

    if (!inputEl) throw new Error('Input element not found');

    console.log('[AI Multiverse] Target input found:', inputEl.tagName);
    console.log('[AI Multiverse] fillMethod:', config.fillMethod);
    console.log('[AI Multiverse] sendMethod:', config.sendMethod);

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

    console.log('[AI Multiverse] fillContentEditable called for', provider, 'isKimi:', isKimi);
    console.log('[AI Multiverse] Element tag:', element.tagName, 'contenteditable:', element.getAttribute('contenteditable'));

    element.focus();
    element.click();
    await delay(DELAY.MEDIUM);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand('delete', false, null);
    await delay(DELAY.MEDIUM + 40);

    // Use direct textContent for all text to avoid execCommand limits
    // Gemini can handle very long context
    console.log('[AI Multiverse] Inserting text, length:', text.length, 'chars');

    // 对Kimi使用innerText，其他使用textContent
    if (isKimi) {
        element.innerText = text;
    } else {
        element.textContent = text;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // 对 Kimi 额外手动触发一次 input/change，帮助它把发送按钮从不可点切换为可点
    if (isKimi) {
        console.log('[AI Multiverse] Kimi extra events triggered');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('keyup', { bubbles: true, key: 'a' }));
        // 额外等待确保Kimi内部状态更新
        await delay(800);
    }

    console.log('[AI Multiverse] fillContentEditable completed');
}

// === Send Message ===
async function sendMessage(inputEl, config, provider) {
    const isAsyncUI = provider === 'deepseek' || provider === 'qwen' ||
        /deepseek|qwen|qianwen/i.test(window.location.hostname);
    const isGemini = provider === 'gemini' || /gemini\.google\.com/i.test(window.location.hostname);

    const clickButton = async () => {
        // Gemini 使用更短的等待时间，因为它的按钮通常很快就可用
        const maxAttempts = isGemini ? 20 : (isAsyncUI ? MAX_BUTTON_WAIT_ATTEMPTS_ASYNC : MAX_BUTTON_WAIT_ATTEMPTS_SYNC);
        const interval = isGemini ? 50 : (isAsyncUI ? BUTTON_WAIT_INTERVAL_ASYNC : BUTTON_WAIT_INTERVAL_SYNC);

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
                    await delay(DELAY.SHORT);
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
                await delay(DELAY.SHORT);
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
            // For Kimi, ensure input is focused and wait a bit before sending Enter
            const isKimi = provider === 'kimi' || /kimi\.moonshot\.cn|kimi\.com/i.test(window.location.hostname);
            if (isKimi) {
                console.log('[AI Multiverse] Kimi: Ensuring focus before Enter');
                inputEl.focus();
                inputEl.click();
                await delay(DELAY.MEDIUM);
            }
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
    console.log('[AI Multiverse] findElement searching for:', selectors);
    // 1. Precise search (visible only)
    for (const sel of selectors) {
        try {
            const el = document.querySelector(sel);
            console.log('[AI Multiverse] querySelector', sel, 'result:', el ? 'found' : 'not found');
            if (el && el.offsetParent !== null) {
                console.log('[AI Multiverse] Found visible element:', sel);
                return el;
            }
        } catch (e) { }
    }
    // 2. Loose search
    for (const sel of selectors) {
        try {
            const el = document.querySelector(sel);
            if (el) {
                console.log('[AI Multiverse] Found element (not visible):', sel);
                return el;
            }
        } catch (e) { }
    }
    console.log('[AI Multiverse] findElement returning null');
    return null;
}


// === File Upload Functions ===


/**
 * Helper function to convert Data URL to File object
 */
function dataURLtoFile(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}
/**
 * Upload files to the AI platform
 * @param {Array} files - Array of file objects with { name, type, data, size }
 * @param {Object} config - Provider configuration
 * @param {string} provider - Provider name
 */
async function uploadFiles(files, config, provider) {
    // Input validation
    if (!files || !Array.isArray(files) || files.length === 0) {
        console.warn('[AI Multiverse] No files to upload');
        return;
    }
    if (!config || !provider) {
        console.error('[AI Multiverse] Invalid config or provider');
        throw new Error('Invalid config or provider');
    }

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
                await delay(DELAY.RETRY * retry); // Exponential backoff
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
async function uploadToGemini(file, config) {
    const uploadButton = findElement(config.selectors.fileUploadButton);
    const fileInput = findElement(config.selectors.fileUploadInput);

    // Method 1: Use existing file input
    if (fileInput) {

        const fileObj = dataURLtoFile(file.data, file.name);

        // Create a new FileList-like object
        const dt = new DataTransfer();
        dt.items.add(fileObj);
        fileInput.files = dt.files;

        // Trigger change event
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        await delay(UPLOAD_DELAY); // Wait for upload to complete
        return;
    }

    // Method 2: Click upload button and simulate drop
    if (uploadButton) {
        uploadButton.click();
        await delay(DELAY.LONG);

        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {

            const fileObj = dataURLtoFile(file.data, file.name);
            const dt = new DataTransfer();
            dt.items.add(fileObj);
            fileInput.files = dt.files;

            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(UPLOAD_DELAY);
            return;
        }
    }

    throw new Error('Could not find file upload mechanism for Gemini');
}

/**
 * Upload file to ChatGPT
 */
async function uploadToChatGPT(file, config) {
    const fileInput = document.querySelector('input[type="file"]');

    if (fileInput) {

        const fileObj = dataURLtoFile(file.data, file.name);
        const dt = new DataTransfer();
        dt.items.add(fileObj);
        fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(UPLOAD_DELAY_LONG); // ChatGPT upload might take longer
        return;
    }

    throw new Error('Could not find file input for ChatGPT');
}

/**
 * Upload file to Grok
 */
async function uploadToGrok(file, config) {
    const uploadButton = findElement(['button[aria-label*="Upload"]', 'button[aria-label*="上传"]', 'button[title*="Upload"]']);

    if (uploadButton) {
        uploadButton.click();
        await delay(DELAY.LONG);

        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {

            const fileObj = dataURLtoFile(file.data, file.name);
            const dt = new DataTransfer();
            dt.items.add(fileObj);
            fileInput.files = dt.files;

            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(UPLOAD_DELAY);
            return;
        }
    }

    throw new Error('Could not find file upload mechanism for Grok');
}

/**
 * Upload file to Kimi
 */
async function uploadToKimi(file, config) {
    const fileInput = document.querySelector('input[type="file"]');

    if (fileInput) {

        const fileObj = dataURLtoFile(file.data, file.name);
        const dt = new DataTransfer();
        dt.items.add(fileObj);
        fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(UPLOAD_DELAY_LONG);
        return;
    }

    throw new Error('Could not find file input for Kimi');
}

/**
 * Upload file to DeepSeek
 */
async function uploadToDeepSeek(file, config) {
    const uploadButton = findElement(['button[aria-label*="image"]', 'button[aria-label*="图片"]', 'button[title*="image"]']);

    if (uploadButton) {
        uploadButton.click();
        await delay(DELAY.LONG);

        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {

            const fileObj = dataURLtoFile(file.data, file.name);
            const dt = new DataTransfer();
            dt.items.add(fileObj);
            fileInput.files = dt.files;

            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(UPLOAD_DELAY);
            return;
        }
    }

    // Fallback: Try direct file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {

        const fileObj = dataURLtoFile(file.data, file.name);
        const dt = new DataTransfer();
        dt.items.add(fileObj);
        fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(UPLOAD_DELAY);
        return;
    }

    throw new Error('Could not find file upload mechanism for DeepSeek');
}

/**
 * Upload file to Qwen
 */
async function uploadToQwen(file, config) {
    const fileInput = document.querySelector('input[type="file"]');

    if (fileInput) {

        const fileObj = dataURLtoFile(file.data, file.name);
        const dt = new DataTransfer();
        dt.items.add(fileObj);
        fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(UPLOAD_DELAY_LONG);
        return;
    }

    throw new Error('Could not find file input for Qwen');
}

/**
 * Upload file to Yuanbao
 */
async function uploadToYuanbao(file, config) {
    const fileInput = document.querySelector('input[type="file"]');

    if (fileInput) {

        const fileObj = dataURLtoFile(file.data, file.name);
        const dt = new DataTransfer();
        dt.items.add(fileObj);
        fileInput.files = dt.files;

        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(UPLOAD_DELAY_LONG);
        return;
    }

    throw new Error('Could not find file input for Yuanbao');
}
