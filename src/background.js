// === AI Multiverse Background Service Worker ===

let popupWindowId = null;

// Track which windowId belongs to which provider
let providerWindows = {};
let savedLayout = {}; // Store saved window layouts

// === Extension Click/Command Behavior ===
async function togglePopup() {
    const popupUrl = chrome.runtime.getURL('src/sidepanel/sidepanel.html');
    let existingWin = null;

    // 1. Try to find existing popup by URL
    // First check tracked ID (fast path)
    if (popupWindowId !== null) {
        try {
            const win = await chrome.windows.get(popupWindowId);
            if (win) existingWin = win;
        } catch (e) { popupWindowId = null; }
    }

    // Fallback: Check all windows (robust path for service worker restart)
    if (!existingWin) {
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
        for (const win of windows) {
            if (win.tabs && win.tabs.length > 0 && win.tabs[0].url && win.tabs[0].url.startsWith(popupUrl)) {
                existingWin = win;
                popupWindowId = win.id;
                break;
            }
        }
    }

    if (existingWin) {
        if (existingWin.focused) {
            // If strictly focused on top, minimize. Otherwise bring to front.
            // Edge edge-case: Sometimes focused but behind another app? 
            // Just minimize if state is 'normal' and focused.
            chrome.windows.update(existingWin.id, { state: 'minimized' });
        } else {
            chrome.windows.update(existingWin.id, {
                focused: true,
                state: 'normal',
                drawAttention: true
            });
        }
    } else {
        // Open as a standalone popup window (app-like experience)
        const newWin = await chrome.windows.create({
            url: 'src/sidepanel/sidepanel.html',
            type: 'popup',
            width: 870,  // Increased from 580 (50% wider)
            height: 800,
            focused: true,
        });
        popupWindowId = newWin.id;
    }
}

chrome.action.onClicked.addListener(togglePopup);

chrome.commands.onCommand.addListener((command) => {
    if (command === '_execute_action') {
        togglePopup();
    }
});

// Import shared configuration
try {
    importScripts('config.js');
} catch (e) {
    console.warn('Could not import config.js directly, assuming it is bundled or global context.', e);
}

// === Translations for Background Worker ===
const TRANSLATIONS = {
    en: {
        err_script_injection_failed: 'Script injection failed',
        sent: 'Sent!',
        err_prefix: 'Error: ',
        closed_windows: 'Closed {count} windows, {tabs} tabs'
    },
    'zh-CN': {
        err_script_injection_failed: '脚本注入失败',
        sent: '发送成功！',
        err_prefix: '错误：',
        closed_windows: '已关闭 {count} 个窗口，{tabs} 个标签页'
    }
};

let backgroundLang = 'en';

// Load language preference
chrome.storage.local.get(['lang'], (result) => {
    backgroundLang = result.lang || 'en';
});

// Listen for language changes
/**
 * Simple translation helper for background worker
 */
function bt(key, vars = {}) {
    const lang = backgroundLang;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    let text = dict[key] || key;

    // Replace variables {var_name}
    return text.replace(/\{(\w+)\}/g, (match, varName) => {
        return vars[varName] !== undefined ? vars[varName] : match;
    });
}

// === Helper: Identify our own popup/sidepanel window ===
async function ensurePopupWindowId() {
    if (popupWindowId !== null) {
        try {
            await chrome.windows.get(popupWindowId);
            return popupWindowId;
        } catch (e) { popupWindowId = null; }
    }
    const popupUrl = chrome.runtime.getURL('src/sidepanel/sidepanel.html');
    const windows = await chrome.windows.getAll({ populate: true });
    for (const win of windows) {
        if (win.tabs && win.tabs.some(t => t.url && t.url.startsWith(popupUrl))) {
            popupWindowId = win.id;
            return popupWindowId;
        }
    }
    return null;
}

// === Provider Configuration ===
const PROVIDER_CONFIG = typeof AI_CONFIG !== 'undefined' ? AI_CONFIG : {
    gemini: { urlPattern: '*://gemini.google.com/*', baseUrl: 'https://gemini.google.com/app' }
};

// === Message Listener ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Proactively track/verify our window ID
    ensurePopupWindowId().then(() => {
        if (request.action === 'broadcast_message') {
            handleBroadcast(request.message, request.providers);
            sendResponse({ status: 'Processing...' });
        } else if (request.action === 'tile_windows') {
            handleTileWindows(request.providers);
            sendResponse({ status: 'Tiling...' });
        } else if (request.action === 'launch_only_providers') {
            handleLaunchOnly(request.providers);
            sendResponse({ status: 'Launching...' });
        } else if (request.action === 'close_all_windows') {
            handleCloseAll();
            sendResponse({ status: 'Closing...' });
        } else if (request.action === 'open_popup_window') {
            chrome.windows.create({
                url: chrome.runtime.getURL('src/sidepanel/sidepanel.html'),
                type: 'popup',
                width: 870,  // Increased from 580 (50% wider)
                height: 800,
                focused: true,
            }).then(win => { popupWindowId = win.id; });
            sendResponse({ status: 'OK' });
        } else if (request.action === 'diagnose_selectors') {
            handleDiagnoseSelectors(request.provider).then(result => {
                sendResponse(result);
            }).catch(err => {
                sendResponse({ status: 'error', error: err.message });
            });
            return true;
        } else if (request.action === 'fetch_all_responses') {
            fetchAllResponses(request.providers).then(responses => {
                sendResponse({ status: 'ok', responses });
            }).catch(err => {
                sendResponse({ status: 'error', error: err.message });
            });
            return true;
        } else if (request.action === 'summarize_responses') {
            handleSummarizeResponses(request.provider, request.prompt).then(() => {
                sendResponse({ status: 'ok' });
            }).catch(err => {
                sendResponse({ status: 'error', error: err.message });
            });
            return true;
        } else if (request.action === 'perform_main_world_fill') {
            if (sender.tab && sender.tab.id) {
                executeMainWorldFill(sender.tab.id, request.selector, request.text, request.provider)
                    .then(() => sendResponse({ status: 'done' }))
                    .catch(err => {
                        console.error('Main world fill error:', err);
                        sendResponse({ status: 'error', error: err.message });
                    });
                return true;
            }
        }
    });
    return true; // async
});

// === Fetch Responses from All Providers ===
async function fetchAllResponses(providers) {
    const results = {};

    const tasks = providers.map(async (providerKey) => {
        if (!PROVIDER_CONFIG[providerKey]) return;

        let tabId = null;

        // Find tab for this provider
        if (providerWindows[providerKey]) {
            try {
                await chrome.windows.get(providerWindows[providerKey].windowId);
                tabId = providerWindows[providerKey].tabId;
            } catch (e) { delete providerWindows[providerKey]; }
        }

        if (!tabId) {
            const config = PROVIDER_CONFIG[providerKey];
            const patternsToCheck = [config.urlPattern];
            if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
            if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

            // Critical filter to avoid matching all tabs if pattern is missing
            const uniquePatterns = [...new Set(patternsToCheck.filter(p => typeof p === 'string' && p.length > 0))];

            for (const pattern of uniquePatterns) {
                try {
                    const tabs = await chrome.tabs.query({ url: pattern });
                    // Skip internal extension tabs and current control panel
                    const validTab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && t.windowId !== popupWindowId);
                    if (validTab) {
                        tabId = validTab.id;
                        providerWindows[providerKey] = { windowId: validTab.windowId, tabId: tabId };
                        break;
                    }
                } catch (e) { }
            }
        }

        if (!tabId) {
            results[providerKey] = { status: 'not_open', text: '', name: PROVIDER_CONFIG[providerKey].name };
            return;
        }

        try {
            // Ensure content script is injected
            await ensureContentScript(tabId);
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'extract_response',
                provider: providerKey
            });
            results[providerKey] = {
                ...response,
                name: PROVIDER_CONFIG[providerKey].name,
                icon: PROVIDER_CONFIG[providerKey].icon
            };
        } catch (err) {
            results[providerKey] = {
                status: 'error',
                text: '',
                error: err.message,
                name: PROVIDER_CONFIG[providerKey].name
            };
        }
    });

    await Promise.allSettled(tasks);
    return results;
}

// === Diagnose Selectors ===
async function handleDiagnoseSelectors(provider) {
    // Find tab for this provider
    let tabId = null;
    if (providerWindows[provider]) {
        try {
            await chrome.windows.get(providerWindows[provider].windowId);
            tabId = providerWindows[provider].tabId;
        } catch (e) { delete providerWindows[provider]; }
    }

    if (!tabId) {
        return { status: 'error', error: 'No tab open for this provider' };
    }

    try {
        // Ensure content script is injected
        await ensureContentScript(tabId);
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'diagnose_selectors',
            provider: provider
        });
        return response;
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}

// === Handle Summarize Responses ===
async function handleSummarizeResponses(provider, prompt) {
    console.log('[AI Multiverse Background] handleSummarizeResponses called');
    console.log('[AI Multiverse Background] Provider:', provider);
    console.log('[AI Multiverse Background] Prompt length:', prompt?.length);
    console.log('[AI Multiverse Background] Prompt first 300 chars:', prompt?.substring(0, 300));
    console.log('[AI Multiverse Background] Prompt last 300 chars:', prompt?.substring(prompt.length - 300));
    
    if (!PROVIDER_CONFIG[provider]) {
        throw new Error(`Unknown provider: ${provider}`);
    }

    const config = PROVIDER_CONFIG[provider];

    // Try to find existing tab for this provider
    let tabId = null;
    
    // First, try to find any existing tab matching the URL pattern
    const patternsToCheck = [config.urlPattern];
    if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
    if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);
    
    const uniquePatterns = [...new Set(patternsToCheck.filter(p => typeof p === 'string' && p.length > 0))];
    
    for (const pattern of uniquePatterns) {
        try {
            const tabs = await chrome.tabs.query({ url: pattern });
            // Skip internal extension tabs
            const validTab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://'));
            if (validTab) {
                tabId = validTab.id;
                providerWindows[provider] = { windowId: validTab.windowId, tabId: tabId };
                console.log('[AI Multiverse Background] Found existing tab by URL:', tabId);
                break;
            }
        } catch (e) {
            console.warn('[AI Multiverse Background] Error querying tabs:', e);
        }
    }
    
    // If still no tab found, check saved providerWindows
    if (!tabId && providerWindows[provider]) {
        try {
            await chrome.windows.get(providerWindows[provider].windowId);
            tabId = providerWindows[provider].tabId;
            console.log('[AI Multiverse Background] Found existing tab from saved windows:', tabId);
        } catch (e) { 
            console.log('[AI Multiverse Background] Saved window not found');
            delete providerWindows[provider]; 
        }
    }

    // If no existing tab, create one
    if (!tabId) {
        console.log('[AI Multiverse Background] Creating new tab for', provider);
        const tab = await chrome.tabs.create({ url: config.baseUrl, active: false });
        tabId = tab.id;
        providerWindows[provider] = { windowId: tab.windowId, tabId: tabId };
        console.log('[AI Multiverse Background] Created tab:', tabId);

        // Wait for tab to load with timeout
        await waitForTabLoad(tabId, 30000);
        console.log('[AI Multiverse Background] Tab loaded');
    }

    // Ensure content script is injected
    await ensureContentScript(tabId);
    console.log('[AI Multiverse Background] Content script ensured');

    // Send the summarization prompt
    console.log('[AI Multiverse Background] Sending fill_and_send message to tab', tabId);
    await chrome.tabs.sendMessage(tabId, {
        action: 'fill_and_send',
        text: prompt,
        provider: provider,
        files: []
    });
    console.log('[AI Multiverse Background] Message sent successfully');
}

// === Main World Injection (Provider-Aware Fill) ===
async function executeMainWorldFill(tabId, selector, text, provider) {
    return chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',
        args: [selector, text, provider || ''],
        func: (sel, val, providerName) => {
            const hostname = window.location.hostname;
            console.log(`[AI Multiverse] Filling ${providerName} with text:`, val);

            const findEl = (selectors) => {
                if (typeof selectors === 'string') selectors = [selectors];
                for (const s of selectors) {
                    try {
                        const el = document.querySelector(s);
                        if (el) return el;
                    } catch (e) { }
                }
                return null;
            };

            const reactFill = (el, v) => {
                el.focus();
                // Ensure field is empty first
                const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) setter.call(el, '');
                else el.value = '';

                // Dispatch basic events to clear
                el.dispatchEvent(new Event('input', { bubbles: true }));

                // Set new value - direct property setter works for any length
                console.log('[AI Multiverse] Setting textarea/input value, length:', v.length);
                if (setter) setter.call(el, v);
                else el.value = v;

                if (el._valueTracker) el._valueTracker.setValue(''); // Reset tracker

                const events = ['input', 'change'];
                events.forEach(type => el.dispatchEvent(new Event(type, { bubbles: true })));

                // Keyboard events for state sync
                const keys = ['keydown', 'keyup'];
                keys.forEach(type => el.dispatchEvent(new KeyboardEvent(type, { key: 'a', bubbles: true })));
            };

            const ceditFill = (el, v) => {
                el.focus();
                el.click();
                try {
                    // Force a total clear of Tiptap/ProseMirror state
                    const sel = window.getSelection();
                    sel.selectAllChildren(el);
                    document.execCommand('delete', false, null);

                    if (el.innerText.trim().length > 0) {
                        el.focus();
                        document.execCommand('selectAll', false, null);
                        document.execCommand('delete', false, null);
                    }

                    // Final fallback for extremely stubborn editors
                    if (el.innerText.trim().length > 0) {
                        el.innerHTML = '';
                    }

                    // Re-focus to prepare for insertion
                    el.focus();
                } catch (e) { }

                // For very long text, use direct textContent to avoid execCommand limits
                // Gemini can handle very long context, so no need to worry about length
                console.log('[AI Multiverse] Inserting text, length:', v.length, 'chars');
                el.textContent = v;
                
                // Trigger events to notify the editor
                const events = ['input', 'change', 'blur'];
                events.forEach(type => el.dispatchEvent(new Event(type, { bubbles: true })));
                el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, composed: true, inputType: 'insertText', data: v }));
                el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: v }));
            };

            if (hostname.includes('gemini.google.com')) {
                const el = findEl(['div.ql-editor[contenteditable="true"]', 'div[role="textbox"]', '.ql-editor', 'div[contenteditable="true"]']);
                if (!el) return false;
                ceditFill(el, val);
                return true;
            }

            if (hostname.includes('grok.com')) {
                // Grok 使用 ProseMirror/Tiptap，发送一轮对话后占位文本会消失，
                // 不能再依赖占位符字符串来查找输入框，因此这里总是选取最后一个可见的 ProseMirror 编辑器。
                const tiptapList = Array.from(document.querySelectorAll('div.tiptap.ProseMirror'));
                const tiptap = tiptapList.reverse().find(el => el.offsetParent !== null) || tiptapList[0] || null;
                if (!tiptap) return false;

                // 使用通用的 contenteditable 填充逻辑，模拟人工“全选 -> 删除 -> 粘贴”行为
                ceditFill(tiptap, val);
                return true;
            }

            // Kimi 使用 contenteditable div，需要特殊处理以确保内部状态正确更新
            if (hostname.includes('kimi.moonshot.cn') || hostname.includes('kimi.com')) {
                const el = findEl(['div[contenteditable="true"]', 'div.chat-input', 'div[class*="input"]', 'div[class*="editor"]']);
                if (!el) return false;
                
                // 使用 contenteditable 填充逻辑
                ceditFill(el, val);
                
                // Kimi 需要额外的事件触发来更新发送按钮状态
                setTimeout(() => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
                }, 100);
                
                return true;
            }

            if (hostname.includes('chat.deepseek.com')) {
                const el = findEl(['textarea#chat-input', 'textarea[placeholder*="DeepSeek"]', 'textarea']);
                if (!el) return false;
                reactFill(el, val);
                return true;
            }

            if (hostname.includes('chatgpt.com')) {
                const el = findEl(['div#prompt-textarea', 'div[contenteditable="true"][id="prompt-textarea"]', 'div[contenteditable="true"]']);
                if (!el) return false;
                if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') reactFill(el, val);
                else ceditFill(el, val);
                return true;
            }

            if (hostname.includes('qianwen') || hostname.includes('tongyi.aliyun.com') || hostname.includes('qwen.ai')) {
                const el = findEl(['div[role="textbox"]', 'div[data-placeholder*="千问"]', 'div[data-slate-editor="true"]', 'textarea#msg-input', 'textarea']);
                if (!el) return false;
                el.focus();
                el.click();

                if (el.getAttribute('contenteditable') === 'true') {
                    ceditFill(el, val);
                } else {
                    reactFill(el, val);
                }
                return true;
            }

            if (hostname.includes('yuanbao.tencent.com')) {
                const el = findEl(['.ql-editor', 'div[contenteditable="true"]']);
                if (!el) return false;
                ceditFill(el, val);
                return true;
            }

            const genericEl = findEl([sel, 'textarea', 'div[contenteditable="true"]', 'div[role="textbox"]']);
            if (!genericEl) return false;
            if (genericEl.tagName === 'TEXTAREA' || genericEl.tagName === 'INPUT') reactFill(genericEl, val);
            else ceditFill(genericEl, val);
            return true;
        }
    });
}
// === Tile Windows (Robust Discovery & Layout) ===
async function handleTileWindows(providers) {
    const displayInfo = await chrome.system.display.getInfo();

    // 1. Discovery Phase: Find all relevant windows
    const windowsToTile = [];

    for (const providerKey of providers) {
        if (!PROVIDER_CONFIG[providerKey]) continue;
        const config = PROVIDER_CONFIG[providerKey];
        let winId = null;

        // 1. Check tracked windows first (most reliable)
        if (providerWindows[providerKey]) {
            try {
                const win = await chrome.windows.get(providerWindows[providerKey].windowId);
                // CRITICAL: NEVER tile the extension's own control panel
                if (win && win.id !== popupWindowId) {
                    winId = win.id;
                }
            } catch (e) { delete providerWindows[providerKey]; }
        }

        // 2. Discover by URL if not found (exclude extension tabs)
        if (!winId) {
            const patternsToCheck = [config.urlPattern];
            if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
            if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

            for (const pattern of [...new Set(patternsToCheck)]) {
                try {
                    const tabs = await chrome.tabs.query({ url: pattern });
                    // Filter: tab must exist, have a windowId, and NOT be part of the extension
                    const validTab = tabs.find(t => t.windowId && t.windowId !== popupWindowId && !t.url.startsWith('chrome-extension://'));
                    if (validTab) {
                        winId = validTab.windowId;
                        providerWindows[providerKey] = { windowId: winId, tabId: validTab.id };
                        break;
                    }
                } catch (e) { }
            }
        }

        if (winId && winId !== popupWindowId) {
            windowsToTile.push({ provider: providerKey, windowId: winId });
        }
    }

    if (windowsToTile.length === 0) return;

    // 2. Determine Target Display
    // Priority: Popup window's display → Stored preference → Primary display
    let targetDisplay = null;

    // Strategy A: Use the display where the popup/control panel is located
    if (!targetDisplay && popupWindowId !== null) {
        try {
            const popupWin = await chrome.windows.get(popupWindowId);
            if (popupWin) {
                targetDisplay = findDisplayForWindow(popupWin, displayInfo);
            }
        } catch (e) { popupWindowId = null; }
    }

    // Strategy B: Use stored display preference
    if (!targetDisplay) {
        try {
            const stored = await chrome.storage.local.get('lastTileDisplayId');
            if (stored.lastTileDisplayId) {
                const found = displayInfo.find(d => d.id === stored.lastTileDisplayId);
                if (found) targetDisplay = found;
            }
        } catch (e) { /* ignore */ }
    }

    // Strategy C: Default to primary display
    if (!targetDisplay) {
        targetDisplay = displayInfo.find(d => d.isPrimary) || displayInfo[0];
    }

    // Persist the display choice for next time
    chrome.storage.local.set({ lastTileDisplayId: targetDisplay.id });

    const { width: screenW, height: screenH, left: screenX, top: screenY } = targetDisplay.workArea;

    // 3. Calculate Layout
    const count = windowsToTile.length;
    let cols, rows;
    if (count === 1) { cols = 1; rows = 1; }
    else if (count === 2) { cols = 2; rows = 1; }
    else if (count <= 4) { cols = 2; rows = 2; }
    else if (count <= 6) { cols = 3; rows = 2; }
    else { cols = 3; rows = Math.ceil(count / 3); }

    const winW = Math.floor(screenW / cols);
    const winH = Math.floor(screenH / rows);

    // 4. Apply Layout (parallel for speed)
    const tilePromises = windowsToTile.map((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        return chrome.windows.update(item.windowId, {
            left: screenX + col * winW,
            top: screenY + row * winH,
            width: winW,
            height: winH,
            state: 'normal',
            focused: false
        }).catch(e => console.error(`Failed to tile ${item.provider}:`, e));
    });

    await Promise.all(tilePromises);

    // No longer focusing first window - let user manually select which window to view
    // If Browse Mode is enabled, mouse hover will auto-focus
}

// Helper: find which display a window is on
function findDisplayForWindow(win, displayInfo) {
    const cx = win.left + (win.width / 2);
    const cy = win.top + (win.height / 2);
    return displayInfo.find(d => {
        const b = d.bounds;
        return cx >= b.left && cx < (b.left + b.width) &&
            cy >= b.top && cy < (b.top + b.height);
    }) || null;
}

// === Helper Functions ===
async function ensureContentScript(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url.startsWith('chrome://')) return false;

        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return true;
    } catch (e) {
        try {
            // Must inject config.js first
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['src/config.js', 'src/content/content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            return true;
        } catch (injectError) {
            console.error('Injection failed:', injectError);
            return false;
        }
    }
}

function waitForTabLoad(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        let cleanupTimer = null;

        const listener = (updatedTabId, info) => {
            if (updatedTabId === tabId && info.status === 'complete') {
                cleanup();
                resolve();
            }
        };

        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            chrome.tabs.onUpdated.removeListener(listener);
            if (cleanupTimer) clearTimeout(cleanupTimer);
        };

        chrome.tabs.onUpdated.addListener(listener);

        // Check if already loaded
        chrome.tabs.get(tabId, (tab) => {
            if (tab && tab.status === 'complete') {
                cleanup();
                resolve();
                return;
            }

            // Set timeout to prevent infinite waiting
            cleanupTimer = setTimeout(() => {
                cleanup();
                resolve();  // Resolve anyway to avoid blocking
            }, timeout);
        });
    });
}

async function handleBroadcast(message, providers, files = []) {
    const tasks = providers.map(p => sendToProvider(p, message, files));
    await Promise.allSettled(tasks);
}

async function sendToProvider(providerKey, message, files = []) {
    if (!PROVIDER_CONFIG[providerKey]) return;
    const config = PROVIDER_CONFIG[providerKey];
    let tabId = null;

    // Try finding tracked window
    if (providerWindows[providerKey]) {
        try {
            const win = await chrome.windows.get(providerWindows[providerKey].windowId);
            if (win && win.id !== popupWindowId) {
                tabId = providerWindows[providerKey].tabId;
            } else {
                delete providerWindows[providerKey];
            }
        }
        catch (e) { delete providerWindows[providerKey]; }
    }

    // Try finding existing window
    if (!tabId) {
        const patternsToCheck = [config.urlPattern];
        if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
        if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

        const uniquePatterns = [...new Set(patternsToCheck.filter(p => typeof p === 'string' && p.length > 0))];

        for (const pattern of uniquePatterns) {
            try {
                const tabs = await chrome.tabs.query({ url: pattern });
                const validTab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && t.windowId !== popupWindowId);
                if (validTab) {
                    tabId = validTab.id;
                    providerWindows[providerKey] = { windowId: validTab.windowId, tabId: validTab.id };
                    break;
                }
            } catch (e) { }
        }
    }

    // Create new window
    if (!tabId) {
        const newWin = await chrome.windows.create({ url: config.baseUrl, type: 'normal', focused: false });
        tabId = newWin.tabs[0].id;
        providerWindows[providerKey] = { windowId: newWin.id, tabId: tabId };
        await waitForTabLoad(tabId);
        // Increased from 2000ms to 3000ms to allow full hydration/redirects for Qwen/Grok
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const injected = await ensureContentScript(tabId);
    if (!injected) { notifyStatus(providerKey, bt('err_script_injection_failed'), 'error'); return; }

    try {
        await chrome.tabs.sendMessage(tabId, { 
            action: 'fill_and_send', 
            text: message, 
            provider: providerKey,
            files: files 
        });
        notifyStatus(providerKey, bt('sent'), 'success');
    } catch (err) {
        notifyStatus(providerKey, bt('err_prefix') + err.message, 'error');
    }
}

function notifyStatus(provider, message, status) {
    chrome.runtime.sendMessage({ action: 'status_update', status, provider, message }).catch(() => { });
}

async function handleLaunchOnly(providers) {
    // Phase 1: Discover existing windows or create new ones (parallel)
    const tasks = providers.map(async (providerKey) => {
        if (!PROVIDER_CONFIG[providerKey]) return;
        const config = PROVIDER_CONFIG[providerKey];

        // Try finding tracked window
        if (providerWindows[providerKey]) {
            try {
                const win = await chrome.windows.get(providerWindows[providerKey].windowId);
                if (win && win.id !== popupWindowId) {
                    return; // Already open, skip
                } else {
                    delete providerWindows[providerKey];
                }
            } catch (e) { delete providerWindows[providerKey]; }
        }

        // Try finding existing window by URL (check all known patterns)
        const patternsToCheck = [config.urlPattern];
        if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
        if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

        const uniquePatterns = [...new Set(patternsToCheck.filter(p => typeof p === 'string' && p.length > 0))];

        let foundTab = null;
        for (const pattern of uniquePatterns) {
            try {
                const tabs = await chrome.tabs.query({ url: pattern });
                const validTab = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && t.windowId !== popupWindowId);
                if (validTab) { foundTab = validTab; break; }
            } catch (e) { }
        }
        if (foundTab && foundTab.windowId !== popupWindowId) {
            providerWindows[providerKey] = { windowId: foundTab.windowId, tabId: foundTab.id };
            return; // Already open, skip
        }

        // Create new window — do NOT wait for page load, just create
        const newWin = await chrome.windows.create({
            url: config.baseUrl,
            type: 'normal',
            focused: false
        });
        providerWindows[providerKey] = { windowId: newWin.id, tabId: newWin.tabs[0].id };
    });

    await Promise.allSettled(tasks);

    // Phase 2: Tile immediately (no extra delay needed)
    await handleTileWindows(providers);
}

async function handleCloseAll() {
    const closeWindowIds = new Set();
    const closeTabIds = new Set();

    // 1. Collect from tracked windows (fast path)
    for (const key in providerWindows) {
        if (providerWindows[key] && providerWindows[key].windowId) {
            closeWindowIds.add(providerWindows[key].windowId);
        }
    }

    // 2. Build complete list of ALL URL patterns to search
    const allPatterns = [];
    for (const key in PROVIDER_CONFIG) {
        const config = PROVIDER_CONFIG[key];
        if (config.urlPattern) allPatterns.push(config.urlPattern);
        if (config.urlPatternAlt) allPatterns.push(config.urlPatternAlt);
        // Support urlPatterns array (e.g. Qwen has 4 domains)
        if (config.urlPatterns && Array.isArray(config.urlPatterns)) {
            allPatterns.push(...config.urlPatterns);
        }
    }

    // 3. Query all patterns in parallel for speed
    const uniquePatterns = [...new Set(allPatterns)];
    const tabQueryResults = await Promise.all(
        uniquePatterns.map(pattern => chrome.tabs.query({ url: pattern }).catch(() => []))
    );

    // Flatten all found tabs
    const allTabs = tabQueryResults.flat();

    // 4. Decide: close window or just tab
    for (const tab of allTabs) {
        if (closeWindowIds.has(tab.windowId)) continue; // Already marked for window close
        try {
            const win = await chrome.windows.get(tab.windowId, { populate: true });
            if (win.tabs.length === 1 || win.type === 'popup') {
                closeWindowIds.add(tab.windowId);
            } else {
                closeTabIds.add(tab.id);
            }
        } catch (e) {
            // Window might be closed already
        }
    }

    // 5. Execute all closures in parallel
    const promises = [
        ...Array.from(closeWindowIds).map(id => chrome.windows.remove(id).catch(() => { })),
        ...Array.from(closeTabIds).map(id => chrome.tabs.remove(id).catch(() => { }))
    ];

    await Promise.allSettled(promises);
    providerWindows = {};

    // Notify popup that close is complete
    chrome.runtime.sendMessage({
        action: 'status_update',
        status: 'success',
        provider: 'system',
        message: bt('closed_windows', { count: closeWindowIds.size, tabs: closeTabIds.size })
    }).catch(() => { });
}

// === Layout Memory Functions ===

/**
 * Save current window layout to storage
 */
async function saveLayout(providers) {
    const layout = {};

    for (const providerKey of providers) {
        if (providerWindows[providerKey]) {
            try {
                const win = await chrome.windows.get(providerWindows[providerKey].windowId);
                if (win && win.id !== popupWindowId) {
                    layout[providerKey] = {
                        left: win.left,
                        top: win.top,
                        width: win.width,
                        height: win.height,
                        state: win.state
                    };
                }
            } catch (e) { }
        }
    }

    chrome.storage.local.set({ saved_layout: layout });
}

/**
 * Load saved layout from storage
 */
async function loadLayout() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['saved_layout'], (result) => {
            savedLayout = result.saved_layout || {};
            resolve(savedLayout);
        });
    });
}

/**
 * Apply saved layout to windows
 */
async function applySavedLayout(providers) {
    await loadLayout();

    if (Object.keys(savedLayout).length === 0) return;

    for (const providerKey of providers) {
        if (savedLayout[providerKey] && providerWindows[providerKey]) {
            try {
                const layout = savedLayout[providerKey];
                await chrome.windows.update(providerWindows[providerKey].windowId, {
                    left: layout.left,
                    top: layout.top,
                    width: layout.width,
                    height: layout.height,
                    state: layout.state
                });
            } catch (e) {
                console.error(`Failed to apply layout for ${providerKey}:`, e);
            }
        }
    }
}

/**
 * Clear saved layout
 */
async function clearSavedLayout() {
    savedLayout = {};
    chrome.storage.local.remove(['saved_layout']);
}

// Patch handleBroadcast to save layout after sending
const originalHandleBroadcast = handleBroadcast;
handleBroadcast = async function(message, providers) {
    await originalHandleBroadcast.call(this, message, providers);
    // Save layout after all windows are opened and positioned
    setTimeout(() => saveLayout(providers), 1000);
};

// Patch handleTileWindows to save layout after tiling
const originalHandleTileWindows = handleTileWindows;
handleTileWindows = async function(providers) {
    await originalHandleTileWindows.call(this, providers);
    // Save layout after tiling
    saveLayout(providers);
};

// Patch handleLaunchOnly to save layout after launching
const originalHandleLaunchOnly = handleLaunchOnly;
handleLaunchOnly = async function(providers) {
    await originalHandleLaunchOnly.call(this, providers);
    // Save layout after launching and tiling
    setTimeout(() => saveLayout(providers), 1500);
};

// Add message handler for clear layout
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clear_layout') {
        clearSavedLayout().then(() => {
            sendResponse({ status: 'ok' });
        });
        return true;
    } else if (request.action === 'reset_layout') {
        const providers = request.providers || [];
        applySavedLayout(providers).then(() => {
            sendResponse({ status: 'ok' });
        });
        return true;
    } else if (request.action === 'language_changed') {
        backgroundLang = request.lang || 'en';
        sendResponse({ status: 'ok' });
        return true;
    }
});

