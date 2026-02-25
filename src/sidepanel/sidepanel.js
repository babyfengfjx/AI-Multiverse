/**
 * AI Multiverse - Sidepanel v2.0
 * 聊天流式界面
 */

// Fix for highlight.js module error in browser environment
if (typeof module === 'undefined') {
    window.module = {};
}

// Configure marked.js
function configureMarked() {
    if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
        marked.setOptions({
            highlight: function (code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) { }
                }
                try {
                    return hljs.highlightAuto(code).value;
                } catch (e) {
                    return code;
                }
            },
            breaks: true,
            gfm: true,
            pedantic: false,
            sanitize: false
        });
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    configureMarked();

    // === State & Config ===
    const AI_PROVIDERS = ['gemini', 'grok', 'kimi', 'deepseek', 'chatgpt', 'qwen', 'yuanbao'];
    let conversations = [];  // 所有对话
    let currentConversationId = null;  // 当前对话ID
    let currentTheme = 'dark';
    let currentLang = 'zh-CN';
    let selectedFiles = [];
    let summarizeModel = 'gemini';
    let customSummarizePrompt = '';

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
    const POLLING_INTERVAL = 2000;

    // === DOM Elements ===
    const conversationStream = document.getElementById('conversationStream');
    const emptyState = document.getElementById('emptyState');
    const promptInput = document.getElementById('prompt');
    const sendBtn = document.getElementById('sendBtn');
    const fileInput = document.getElementById('fileInput');
    const attachFileBtn = document.getElementById('attachFileBtn');
    const launchOnlyBtn = document.getElementById('launchOnlyBtn');
    const tileBtn = document.getElementById('tileBtn');
    const closeBtn = document.getElementById('closeBtn');
    const filePreview = document.getElementById('filePreview');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');

    const filePreviewList = document.getElementById('filePreviewList');
    const clearFilesBtn = document.getElementById('clearFilesBtn');
    const openModelsBtn = document.getElementById('openModelsBtn');
    const modelsModal = document.getElementById('modelsModal');
    const closeModelsBtn = document.getElementById('closeModelsBtn');
    const confirmModelsBtn = document.getElementById('confirmModelsBtn');
    const selectionBadge = document.getElementById('selectionBadge');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const langToggleBtn = document.getElementById('langToggleBtn');

    // === Initialization ===
    loadTheme();
    loadLanguage();
    loadSelectedProviders();
    loadSummarizeSettings();
    await loadConversationsFromStorage();

    // === Core Functions ===

    /**
     * 创建新对话
     */
    function createConversation(question, providers, files = []) {
        const id = Date.now();
        const conversation = {
            id: id,
            question: question,
            timestamp: id,
            providers: providers,
            files: files,
            responses: {},
            summary: null,
            collapsed: false,
            archived: false
        };

        // 初始化响应状态
        providers.forEach(p => {
            conversation.responses[p] = {
                status: 'loading',
                text: '',
                html: '',
                timestamp: null
            };
        });

        conversations.push(conversation);
        currentConversationId = id;

        return id;
    }

    /**
     * 更新对话响应
     */
    function updateConversationResponse(convId, provider, data) {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        // 只更新有效的响应状态，不覆盖为loading状态
        const newStatus = data.status || 'ok';

        let wasUpdated = false;

        // 如果当前是loading状态，或者新状态是有效的，则更新
        const currentResp = conv.responses[provider];
        if (currentResp && currentResp.status === 'loading') {
            conv.responses[provider] = {
                status: newStatus,
                text: data.text || '',
                html: data.html || '',
                timestamp: Date.now()
            };
            wasUpdated = true;
        } else if (currentResp && (newStatus === 'generating' || newStatus === 'ok' || newStatus === 'error')) {
            // 如果是从 generating 切换到 ok，无论长短都更新以确保状态最新
            // 否则只有在新内容更长时才更新（避免覆盖已有内容）
            const newText = data.text || '';
            if (newText.length >= (currentResp.text || '').length || newStatus === 'ok') {
                conv.responses[provider] = {
                    status: newStatus,
                    text: newText,
                    html: data.html || '',
                    timestamp: Date.now()
                };
                wasUpdated = true;
            }
        }

        // Ensure scroll stays anchored near the conversation
        if (wasUpdated && conv.id === currentConversationId && !conv.collapsed) {
            const convEl = document.querySelector(`[data-id="${conv.id}"]`);

            // Only auto-scroll if user hasn't scrolled far away
            if (convEl && isNearBottom()) {
                setTimeout(() => {
                    const headerEl = convEl.querySelector('.conversation-header');
                    if (headerEl) {
                        headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 50);
            }
        }
    }

    function isNearBottom() {
        return conversationStream.scrollTop + conversationStream.clientHeight >= conversationStream.scrollHeight - 150;
    }

    /**
     * 检查所有响应是否完成
     */
    function checkAllResponsesComplete(convId) {
        const conv = conversations.find(c => c.id === convId);
        if (!conv || conv.archived) return false;

        const allComplete = conv.providers.every(p => {
            const resp = conv.responses[p];
            // ok, error, not_open 都认为是完成状态
            return resp && (resp.status === 'ok' || resp.status === 'error' || resp.status === 'not_open');
        });

        if (allComplete) {
            archiveConversation(convId);
        }

        return allComplete;
    }

    /**
     * 存档对话
     */
    async function archiveConversation(convId) {
        const conv = conversations.find(c => c.id === convId);
        if (!conv || conv.archived) return;

        conv.archived = true;
        await saveConversationToStorage(convId);
        console.log(`[Archive] Conversation ${convId} archived`);
    }


    /**
     * 从存储加载对话
     */
    async function loadConversationsFromStorage() {
        try {
            const data = await chrome.storage.local.get(['conversations_v2']);
            if (data.conversations_v2 && Array.isArray(data.conversations_v2)) {
                conversations = data.conversations_v2;
                console.log(`[Storage] Loaded ${conversations.length} conversations`);

                // 如果有历史记录，将最新的对话设为当前对话
                if (conversations.length > 0) {
                    // 按时间戳排序，最新的在最后
                    conversations.sort((a, b) => a.timestamp - b.timestamp);
                    currentConversationId = conversations[conversations.length - 1].id;
                }

                renderConversations();
                setTimeout(() => {
                    conversationStream.scrollTop = conversationStream.scrollHeight;
                }, 50);
            }
        } catch (e) {
            console.error('[Storage] Load error:', e);
        }
    }

    /**
     * 保存对话到存储
     */
    async function saveConversationToStorage(convId) {
        try {
            const conv = conversations.find(c => c.id === convId);
            if (!conv) return;

            const data = await chrome.storage.local.get(['conversations_v2']);
            const stored = data.conversations_v2 || [];

            const index = stored.findIndex(c => c.id === convId);
            if (index >= 0) {
                stored[index] = conv;
            } else {
                stored.push(conv);
            }

            // 限制最多保存100条对话
            if (stored.length > 100) {
                stored.splice(0, stored.length - 100);
            }

            await chrome.storage.local.set({ conversations_v2: stored });
            console.log(`[Storage] Saved conversation ${convId}`);
        } catch (e) {
            console.error('[Storage] Save error:', e);
        }
    }

    /**
     * 渲染所有对话
     */
    function renderConversations() {
        if (conversations.length === 0) {
            emptyState.style.display = 'flex';
            updateActionButtons();
            return;
        }

        emptyState.style.display = 'none';
        conversationStream.innerHTML = '';

        conversations.forEach(conv => {
            const convEl = createConversationElement(conv);
            conversationStream.appendChild(convEl);
        });

        // 绑定事件委托
        bindConversationEvents();

        // 更新操作按钮状态
        updateActionButtons();
    }

    /**
     * 绑定对话事件（使用事件委托，避免CSP问题）
     */
    function bindConversationEvents() {
        // 响应卡片点击事件
        conversationStream.querySelectorAll('.response-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const provider = card.dataset.provider;
                const convId = parseInt(card.dataset.convId);
                if (provider && convId) {
                    window.showResponseDetail(provider, convId);
                }
            });
        });

        // 对话控制按钮点击事件
        conversationStream.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const convId = parseInt(btn.closest('.conversation-controls').dataset.convId);

                if (action === 'collapse' || action === 'expand') {
                    window.toggleConversation(convId);
                } else if (action === 'tile') {
                    window.tileCards(convId);
                }
            });
        });

        // 已折叠的对话头部点击展开事件
        conversationStream.querySelectorAll('.conversation-header.clickable-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const convId = parseInt(header.dataset.convId);
                if (convId) {
                    window.toggleConversation(convId);
                }
            });
        });
    }

    /**
     * 更新操作按钮状态
     */
    function updateActionButtons() {
        if (!currentConversationId) {
            if (summarizeBtn) summarizeBtn.style.display = 'none';
            if (copyAllBtn) copyAllBtn.style.display = 'none';
            return;
        }

        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (!currentConv) {
            if (summarizeBtn) summarizeBtn.style.display = 'none';
            if (copyAllBtn) copyAllBtn.style.display = 'none';
            return;
        }

        // 显示按钮
        if (summarizeBtn) summarizeBtn.style.display = 'flex';
        if (copyAllBtn) copyAllBtn.style.display = 'flex';

        // 智能总结按钮：只有在已存档且没有总结时才启用
        if (summarizeBtn) {
            summarizeBtn.disabled = !currentConv.archived || !!currentConv.summary;
        }

        // 复制全部按钮：始终启用
        if (copyAllBtn) {
            copyAllBtn.disabled = false;
        }
    }


    /**
     * 创建对话元素
     */
    function createConversationElement(conv) {
        const div = document.createElement('div');
        div.className = `conversation-item ${conv.collapsed ? 'collapsed' : 'expanded'}`;
        div.dataset.id = conv.id;

        if (conv.collapsed) {
            // 折叠状态
            div.innerHTML = `
                <div class="conversation-header clickable-header" data-conv-id="${conv.id}" style="cursor: pointer;" title="点击展开">
                    <div class="conversation-question-collapsed">
                        <span class="question-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </span>
                        <span class="question-text">${escapeHTML(conv.question)}</span>
                    </div>
                    <div class="conversation-meta">
                        <span>${getResponseCount(conv)} 个AI已回答</span>
                        ${conv.summary ? '<span class="summary-badge">✨ 已总结</span>' : ''}
                        ${conv.archived ? '<span class="archived-badge">📦</span>' : ''}
                    </div>
                </div>
            `;
        } else {
            // 展开状态
            const questionDiv = document.createElement('div');
            questionDiv.className = 'conversation-question';
            questionDiv.innerHTML = `
                <div class="conversation-question-content">
                    <span class="question-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </span>
                    <span class="question-text">${escapeHTML(conv.question)}</span>
                </div>
                <div class="conversation-controls" data-conv-id="${conv.id}">
                    <button class="control-btn control-collapse" data-action="collapse" title="折叠">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                    <button class="control-btn control-expand" data-action="expand" title="展开全部">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                        </svg>
                    </button>
                    <button class="control-btn control-tile" data-action="tile" title="平铺布局">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    </button>
                </div>
            `;

            const responsesDiv = document.createElement('div');
            responsesDiv.className = 'conversation-responses';
            responsesDiv.id = `responses-${conv.id}`;
            responsesDiv.innerHTML = renderResponseCards(conv);

            div.appendChild(questionDiv);
            div.appendChild(responsesDiv);

            // 添加总结卡片
            if (conv.summary) {
                const summaryDiv = createSummaryCard(conv.summary);
                div.appendChild(summaryDiv);
            }
        }

        return div;
    }

    /**
     * 渲染响应卡片
     */
    function renderResponseCards(conv) {
        let html = '';

        conv.providers.forEach(provider => {
            const response = conv.responses[provider];
            const config = AI_CONFIG[provider];
            if (!config) return;

            html += `
                <div class="response-card ${response.status}" data-provider="${provider}" data-conv-id="${conv.id}" style="cursor: pointer;">
                    <div class="response-card-header">
                        <div class="response-card-info">
                            <img src="${config.icon}" class="provider-icon-img" alt="${config.name}">
                            <span>${config.name}</span>
                            ${getStatusBadge(response.status)}
                        </div>
                        ${response.status === 'ok' && response.text ? `<div class="response-char-count">${response.text.length} 字</div>` : ''}
                    </div>
                    <div class="response-card-body">
                        ${renderResponseBody(response)}
                    </div>
                </div>
            `;
        });

        return html;
    }


    /**
     * 渲染响应内容
     */
    function renderResponseBody(response) {
        if (response.status === 'loading') {
            return '<span class="loading-text">加载中...</span>';
        } else if (response.status === 'ok' || response.status === 'generating') {
            let content = '';
            if (response.html) {
                content = response.html;
            } else if (response.text) {
                content = escapeHTML(response.text);
            }
            if (response.status === 'generating') {
                content += '<span class="blinking-cursor" style="display:inline-block;width:8px;height:1em;background:currentColor;animation:blink 1s step-end infinite;vertical-align:baseline;margin-left:4px;"></span>';
            }
            return content;
        } else if (response.status === 'error') {
            return `<span class="error-text">错误: ${response.error || '未知错误'}</span>`;
        } else if (response.status === 'not_open') {
            return '<span class="not-open-text">网页未打开</span>';
        }
        return '';
    }

    /**
     * 获取状态徽章
     */
    function getStatusBadge(status) {
        if (status === 'loading') {
            return '<span class="status-badge loading">⏳ 加载中</span>';
        } else if (status === 'generating') {
            return '<span class="status-badge generating" style="color: var(--primary-color);">🔄 生成中...</span>';
        } else if (status === 'ok') {
            return '<span class="status-badge success">✓ 完成</span>';
        } else if (status === 'error') {
            return '<span class="status-badge error">✗ 失败</span>';
        }
        return '';
    }

    /**
     * 获取响应数量
     */
    function getResponseCount(conv) {
        return Object.values(conv.responses).filter(r => r.status === 'ok').length;
    }

    /**
     * 创建总结卡片
     */
    function createSummaryCard(summary) {
        const div = document.createElement('div');
        div.className = 'summary-card';
        div.innerHTML = `
            <div class="summary-header">
                <span class="summary-title">✨ 智能总结</span>
                <span class="summary-model">由 ${AI_CONFIG[summary.model]?.name || summary.model} 生成</span>
            </div>
            <div class="summary-body markdown-content">
                ${renderMarkdown(summary.text)}
            </div>
        `;
        return div;
    }

    /**
     * HTML转义
     */
    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 渲染Markdown
     */
    function renderMarkdown(text) {
        if (!text || typeof text !== 'string') return '';
        try {
            if (typeof marked === 'undefined') {
                return escapeHTML(text);
            }
            let html = marked.parse(text);
            if (typeof DOMPurify !== 'undefined') {
                html = DOMPurify.sanitize(html);
            }
            return html;
        } catch (e) {
            return escapeHTML(text);
        }
    }


    /**
     * 发送消息
     */
    async function handleSendMessage() {
        const question = promptInput.value.trim();
        if (!question) return;

        const providers = getSelectedProviders();
        if (providers.length === 0) {
            alert(t('select_at_least_one'));
            return;
        }

        // 折叠之前的对话并中断还在生成的对话
        if (currentConversationId) {
            // 遍历所有对话，如果有还没存档的，强制存档以中断未完成的轮询
            conversations.forEach(c => {
                c.collapsed = true;
                if (!c.archived) {
                    // 对于没完成的提供商，设置一个被中断的状态
                    c.providers.forEach(p => {
                        if (c.responses[p] && (c.responses[p].status === 'loading' || c.responses[p].status === 'generating')) {
                            c.responses[p].status = 'error';
                            c.responses[p].error = '已被新对话中断';
                        }
                    });
                    c.archived = true;
                }
            });
        }

        // 创建新对话
        const convId = createConversation(question, providers, [...selectedFiles]);

        // 清空输入
        promptInput.value = '';
        selectedFiles = [];
        filePreview.style.display = 'none';

        // 渲染并自动滚动到最底部
        renderConversations();
        setTimeout(() => {
            conversationStream.scrollTop = conversationStream.scrollHeight;
        }, 50);

        // 发送到各个AI
        try {
            await chrome.runtime.sendMessage({
                action: 'broadcast_message',
                message: question,
                providers: providers,
                files: selectedFiles
            });

            // 开始轮询响应
            startPollingResponses(convId, providers);
        } catch (e) {
            console.error('[Send] Error:', e);
            showNotification(t('send_error'), 'error');
        }
    }

    /**
     * 开始轮询响应
     */
    function startPollingResponses(convId, providers) {
        const interval = setInterval(async () => {
            const conv = conversations.find(c => c.id === convId);
            if (!conv) {
                clearInterval(interval);
                return;
            }

            // 获取所有响应
            try {
                const result = await chrome.runtime.sendMessage({
                    action: 'fetch_all_responses',
                    providers: providers
                });

                if (result && result.status === 'ok' && result.responses) {
                    // 更新每个提供商的响应
                    for (const provider of providers) {
                        const response = result.responses[provider];
                        if (response) {
                            updateConversationResponse(convId, provider, response);
                        }
                    }
                }
            } catch (e) {
                console.error(`[Poll] Error:`, e);
            }

            // 检查是否全部完成，或是否被手动存档（如用户发送新对话中断了当前轮询）
            if (conv.archived || checkAllResponsesComplete(convId)) {
                clearInterval(interval);
            }

            // 重新渲染
            renderConversations();
        }, POLLING_INTERVAL);
    }

    /**
     * 切换对话折叠状态
     */
    window.toggleConversation = function (convId) {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        conv.collapsed = !conv.collapsed;
        renderConversations();

        // 如果展开，滚动到该对话
        if (!conv.collapsed) {
            setTimeout(() => {
                const el = document.querySelector(`[data-id="${convId}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    };

    /**
     * 展开全部卡片（以模态框形式查看）
     */
    window.expandAllCards = function (convId) {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        // 找到第一个完成的响应并显示详情
        const firstCompletedProvider = conv.providers.find(p => {
            const resp = conv.responses[p];
            return resp && resp.status === 'ok';
        });

        if (firstCompletedProvider) {
            window.showResponseDetail(firstCompletedProvider, convId);
        } else {
            showNotification(t('no_completed_responses'), 'info');
        }
    };

    /**
     * 平铺布局切换
     */
    window.tileCards = function (convId) {
        const responsesDiv = document.getElementById(`responses-${convId}`);
        if (!responsesDiv) return;

        responsesDiv.classList.toggle('tiled-layout');

        // 保存状态到对话
        const conv = conversations.find(c => c.id === convId);
        if (conv) {
            conv.tiled = !conv.tiled;
        }
    };


    /**
     * 显示响应详情
     */
    window.showResponseDetail = function (provider, convId) {
        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        const response = conv.responses[provider];
        if (!response || response.status !== 'ok') return;

        // 使用现有的详情模态框
        const detailModal = document.getElementById('detailModal');
        const detailIcon = document.getElementById('detailIcon');
        const detailName = document.getElementById('detailName');
        const detailText = document.getElementById('detailText');

        const config = AI_CONFIG[provider];
        detailIcon.src = config.icon;
        detailName.textContent = config.name;

        if (response.html) {
            detailText.innerHTML = response.html;
        } else {
            detailText.textContent = response.text;
        }

        detailModal.classList.add('active');
    };

    /**
     * 智能总结
     */
    window.handleSummarize = async function (convId) {
        // 如果没有传入convId，使用当前对话
        if (!convId) {
            convId = currentConversationId;
        }

        const conv = conversations.find(c => c.id === convId);
        if (!conv || !conv.archived) {
            showNotification(t('wait_for_responses'), 'info');
            return;
        }

        // 构建总结提示词
        let prompt = customSummarizePrompt || getDefaultSummarizePrompt();

        // 添加所有响应内容
        prompt += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        prompt += `${t('question')}: ${conv.question}\n\n`;

        conv.providers.forEach(provider => {
            const response = conv.responses[provider];
            if (response && response.status === 'ok' && response.text) {
                const config = AI_CONFIG[provider];
                prompt += `━━━ ${config.name} ━━━\n${response.text}\n\n`;
            }
        });

        // 创建临时总结状态
        conv.summary = {
            model: summarizeModel,
            text: '',
            html: '',
            status: 'loading',
            timestamp: Date.now()
        };

        renderConversations();

        try {
            // 发送总结请求
            await chrome.runtime.sendMessage({
                action: 'summarize_responses',
                provider: summarizeModel,
                prompt: prompt
            });

            // 开始轮询总结结果
            startPollingSummary(convId, summarizeModel);
        } catch (e) {
            console.error('[Summarize] Error:', e);
            conv.summary = null;
            renderConversations();
            showNotification(t('summarize_error'), 'error');
        }
    };

    /**
     * 轮询总结结果
     */
    function startPollingSummary(convId, provider) {
        const interval = setInterval(async () => {
            const conv = conversations.find(c => c.id === convId);
            if (!conv || !conv.summary) {
                clearInterval(interval);
                return;
            }

            try {
                const result = await chrome.runtime.sendMessage({
                    action: 'fetch_all_responses',
                    providers: [provider]
                });

                if (result && result.status === 'ok' && result.responses) {
                    const response = result.responses[provider];
                    if (response && response.status === 'ok' && response.text) {
                        conv.summary = {
                            model: provider,
                            text: response.text,
                            html: response.html || '',
                            status: 'ok',
                            timestamp: Date.now()
                        };

                        // 总结完成，存档
                        await archiveConversation(convId);
                        clearInterval(interval);
                        renderConversations();
                        showNotification(t('summarize_complete'), 'success');
                    }
                }
            } catch (e) {
                console.error('[Poll Summary] Error:', e);
            }
        }, POLLING_INTERVAL);
    }

    /**
     * 获取默认总结提示词
     */
    function getDefaultSummarizePrompt() {
        if (currentLang === 'zh-CN') {
            return '请对以下多个AI的回答进行智能总结，提取关键信息，突出共同点和差异点，给出综合性的结论：';
        } else {
            return 'Please provide an intelligent summary of the following AI responses, extract key information, highlight commonalities and differences, and give a comprehensive conclusion:';
        }
    }

    /**
     * 复制所有响应
     */
    window.copyAllResponses = async function (convId) {
        // 如果没有传入convId，使用当前对话
        if (!convId) {
            convId = currentConversationId;
        }

        const conv = conversations.find(c => c.id === convId);
        if (!conv) return;

        let text = `${t('question')}: ${conv.question}\n\n`;

        conv.providers.forEach(provider => {
            const response = conv.responses[provider];
            if (response && response.status === 'ok' && response.text) {
                const config = AI_CONFIG[provider];
                text += `━━━ ${config.name} ━━━\n${response.text}\n\n`;
            }
        });

        try {
            await navigator.clipboard.writeText(text);
            showNotification(t('copy_success'), 'success');
        } catch (e) {
            console.error('[Copy] Error:', e);
            showNotification(t('error'), 'error');
        }
    };

    /**
     * 获取选中的提供商
     */
    function getSelectedProviders() {
        const selected = [];
        AI_PROVIDERS.forEach(p => {
            const checkbox = document.getElementById(p);
            if (checkbox && checkbox.checked) {
                selected.push(p);
            }
        });
        return selected;
    }

    /**
     * 加载选中的提供商
     */
    function loadSelectedProviders() {
        chrome.storage.local.get(['selectedProviders'], (result) => {
            if (result.selectedProviders) {
                AI_PROVIDERS.forEach(p => {
                    const checkbox = document.getElementById(p);
                    if (checkbox) {
                        checkbox.checked = result.selectedProviders.includes(p);
                    }
                });
            }
            updateBadge();
        });
    }

    /**
     * 保存选中的提供商
     */
    function saveSelectedProviders() {
        const selected = getSelectedProviders();
        chrome.storage.local.set({ selectedProviders: selected });
        updateBadge();
    }

    /**
     * 更新徽章
     */
    function updateBadge() {
        const count = getSelectedProviders().length;
        selectionBadge.textContent = count;
    }


    /**
     * 加载主题
     */
    function loadTheme() {
        chrome.storage.local.get(['theme'], (result) => {
            currentTheme = result.theme || 'dark';
            applyTheme(currentTheme);
        });
    }

    /**
     * 应用主题
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const sunIcon = document.querySelector('.theme-icon-sun');
        const moonIcon = document.querySelector('.theme-icon-moon');
        if (theme === 'light') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    /**
     * 切换主题
     */
    function toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        chrome.storage.local.set({ theme: currentTheme });
        applyTheme(currentTheme);
    }

    /**
     * 加载语言
     */
    function loadLanguage() {
        chrome.storage.local.get(['lang'], (result) => {
            currentLang = result.lang || 'zh-CN';
            setLanguage(currentLang);
            applyLanguage();
        });
    }

    /**
     * 应用语言
     */
    function applyLanguage() {
        const langLabel = currentLang === 'zh-CN' ? '中文' : 'EN';
        const langBadge = document.querySelector('.lang-badge');
        if (langBadge) langBadge.textContent = langLabel;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });
    }

    /**
     * 切换语言
     */
    function toggleLanguage() {
        currentLang = currentLang === 'en' ? 'zh-CN' : 'en';
        chrome.storage.local.set({ lang: currentLang });
        setLanguage(currentLang);
        applyLanguage();
    }

    /**
     * 加载总结设置
     */
    function loadSummarizeSettings() {
        chrome.storage.local.get(['summarizeModel', 'customSummarizePrompt'], (result) => {
            summarizeModel = result.summarizeModel || 'gemini';
            customSummarizePrompt = result.customSummarizePrompt || '';
        });
    }

    /**
     * 显示通知
     */
    function showNotification(message, type = 'info') {
        const statusPanel = document.getElementById('status');
        if (!statusPanel) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        statusPanel.textContent = message;
        statusPanel.className = `status-panel ${type}`;
        statusPanel.style.display = 'block';

        setTimeout(() => {
            statusPanel.style.display = 'none';
        }, 3000);
    }

    /**
     * 清空历史
     */
    async function clearAllHistory() {
        const confirmMsg = currentLang === 'zh-CN'
            ? '确定要清空所有对话历史吗？此操作不可恢复。'
            : 'Are you sure you want to clear all conversation history? This action cannot be undone.';

        if (!confirm(confirmMsg)) {
            return;
        }

        conversations = [];
        currentConversationId = null;
        await chrome.storage.local.set({ conversations_v2: [] });
        renderConversations();
        showNotification(t('history_cleared'), 'success');
    }


    // === Event Listeners ===

    // 发送按钮
    sendBtn.addEventListener('click', handleSendMessage);

    // Enter键发送
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // 附加文件
    attachFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    clearFilesBtn.addEventListener('click', clearAllFiles);

    // 模型选择
    openModelsBtn.addEventListener('click', () => modelsModal.classList.add('active'));
    closeModelsBtn.addEventListener('click', () => modelsModal.classList.remove('active'));
    confirmModelsBtn.addEventListener('click', () => {
        saveSelectedProviders();
        modelsModal.classList.remove('active');
    });

    // 主题和语言
    themeToggleBtn.addEventListener('click', toggleTheme);
    langToggleBtn.addEventListener('click', toggleLanguage);

    // 清空历史
    clearHistoryBtn.addEventListener('click', clearAllHistory);

    // 操作按钮
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', () => window.handleSummarize());
    }

    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', () => window.copyAllResponses());
    }

    // 总结设置
    const summarizeSettingsBtn = document.getElementById('summarizeSettingsBtn');
    const summarizeSettingsModal = document.getElementById('summarizeSettingsModal');
    const closeSummarizeSettingsBtn = document.getElementById('closeSummarizeSettingsBtn');
    const summarizeSettingsCancelBtn = document.getElementById('summarizeSettingsCancelBtn');
    const summarizeSettingsConfirmBtn = document.getElementById('summarizeSettingsConfirmBtn');
    const summarizeModelSelect = document.getElementById('summarizeModelSelect');
    const summarizePromptInput = document.getElementById('summarizePromptInput');
    const useDefaultPromptBtn = document.getElementById('useDefaultPromptBtn');
    const resetPromptBtn = document.getElementById('resetPromptBtn');

    if (summarizeSettingsBtn) {
        summarizeSettingsBtn.addEventListener('click', () => {
            summarizeModelSelect.value = summarizeModel;
            summarizePromptInput.value = customSummarizePrompt;
            summarizeSettingsModal.classList.add('active');
        });
    }

    if (closeSummarizeSettingsBtn) {
        closeSummarizeSettingsBtn.addEventListener('click', () => {
            summarizeSettingsModal.classList.remove('active');
        });
    }

    if (summarizeSettingsCancelBtn) {
        summarizeSettingsCancelBtn.addEventListener('click', () => {
            summarizeSettingsModal.classList.remove('active');
        });
    }

    if (summarizeSettingsConfirmBtn) {
        summarizeSettingsConfirmBtn.addEventListener('click', () => {
            summarizeModel = summarizeModelSelect.value;
            customSummarizePrompt = summarizePromptInput.value.trim();
            chrome.storage.local.set({
                summarizeModel: summarizeModel,
                customSummarizePrompt: customSummarizePrompt
            });
            summarizeSettingsModal.classList.remove('active');
            showNotification(t('settings_saved'), 'success');
        });
    }

    if (useDefaultPromptBtn) {
        useDefaultPromptBtn.addEventListener('click', () => {
            summarizePromptInput.value = getDefaultSummarizePrompt();
        });
    }

    if (resetPromptBtn) {
        resetPromptBtn.addEventListener('click', () => {
            summarizePromptInput.value = '';
        });
    }

    // Header actions
    if (launchOnlyBtn) {
        launchOnlyBtn.addEventListener('click', () => {
            const providers = getSelectedProviders();
            if (providers.length === 0) {
                alert(t('select_at_least_one'));
                return;
            }
            chrome.runtime.sendMessage({
                action: 'launch_only_providers',
                providers: providers
            });
            showNotification('正在打开选中的AI网页...', 'info');
        });
    }

    if (tileBtn) {
        tileBtn.addEventListener('click', () => {
            const providers = getSelectedProviders();
            if (providers.length === 0) {
                alert(t('select_at_least_one'));
                return;
            }
            chrome.runtime.sendMessage({
                action: 'tile_windows',
                providers: providers
            });
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (confirm('确定要关闭所有AI网页吗？(此操作不会关闭当前控制面板)')) {
                chrome.runtime.sendMessage({
                    action: 'close_all_windows'
                });
                showNotification('正在关闭所有AI网页...', 'info');
            }
        });
    }

    // 关闭详情模态框
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            document.getElementById('detailModal').classList.remove('active');
        });
    }

    // Modal resize handles logic
    const detailModal = document.getElementById('detailModal');
    const detailContent = detailModal?.querySelector('.detail-content');
    const leftHandle = detailModal?.querySelector('.modal-resize-handle-left');
    const rightHandle = detailModal?.querySelector('.modal-resize-handle-right');

    if (detailContent && leftHandle && rightHandle) {
        let isResizing = false;
        let startX, startWidth;

        function startResize(e) {
            isResizing = true;
            startX = e.clientX;
            // Get current width or fallback to max-width defined in CSS for init
            const currentWidth = window.getComputedStyle(detailContent).width;
            startWidth = parseInt(currentWidth, 10);

            // Add no-select class to body to prevent text selection during drag
            document.body.style.userSelect = 'none';
            // Also pointer-events none to iframes if any

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopResize);
        }

        function handleMouseMove(e) {
            if (!isResizing) return;

            // Calculate distance moved. Determine if dragging left or right handle
            // Both handles effectively widen the modal conceptually here since it's centered,
            // we'll just track raw delta and expand width based on absolute mouse delta from center

            // Simpler approach: calculate delta from startX
            // If pulling right handle to right (positive delta) -> wider
            // If pulling left handle to left (negative delta) -> wider
            // Actually, because it's centered, width = original_width + 2 * abs(dx)
            // Or just calculate distance from modal center

            const modalRect = detailContent.getBoundingClientRect();
            const center = modalRect.left + modalRect.width / 2;
            const distance = Math.abs(e.clientX - center);

            // New width is 2 * distance from center
            const newWidth = Math.max(400, Math.min(distance * 2, window.innerWidth - 40));

            // Apply new width, overriding max-width so it can grow
            detailContent.style.maxWidth = 'none';
            detailContent.style.width = `${newWidth}px`;
        }

        function stopResize() {
            isResizing = false;
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResize);
        }

        leftHandle.addEventListener('mousedown', startResize);
        rightHandle.addEventListener('mousedown', startResize);

        // Reset width when closing modal to avoid it getting stuck huge forever if desired, or keep it.
        // Keeping it is usually what users want for persistence across a session.
    }

    // 文件处理函数
    async function handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                alert(`文件 ${file.name} 过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB`);
                continue;
            }

            try {
                const dataUrl = await readFileAsDataURL(file);
                selectedFiles.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: dataUrl
                });
            } catch (e) {
                console.error('[File] Read error:', e);
            }
        }

        renderFilePreview();
        fileInput.value = '';
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function renderFilePreview() {
        if (selectedFiles.length === 0) {
            filePreview.style.display = 'none';
            return;
        }

        filePreview.style.display = 'block';
        filePreviewList.innerHTML = selectedFiles.map((file, index) => `
            <div class="file-preview-item">
                <span class="file-name">${escapeHTML(file.name)}</span>
                <button class="file-remove-btn" data-file-index="${index}">&times;</button>
            </div>
        `).join('');

        // 绑定文件移除按钮事件
        filePreviewList.querySelectorAll('.file-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.fileIndex);
                selectedFiles.splice(index, 1);
                renderFilePreview();
            });
        });
    }

    function clearAllFiles() {
        selectedFiles = [];
        renderFilePreview();
    }

    console.log('[AI Multiverse v2.0] Initialized');
});
