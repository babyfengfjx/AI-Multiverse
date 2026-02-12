/**
 * AI Multiverse - Unified Configuration (Global)
 */

const AI_CONFIG = {
    gemini: {
        name: 'Gemini',
        icon: 'icons/gemini.svg',
        urlPattern: '*://gemini.google.com/*',
        baseUrl: 'https://gemini.google.com/app',
        selectors: {
            input: ['div.ql-editor[contenteditable="true"]', '.ql-editor', 'div[role="textbox"]', 'div[contenteditable="true"]'],
            button: ['button.send-button', 'button[aria-label="Send message"]', 'button[aria-label="发送"]', 'div[role="button"][aria-label="Send message"]'],
            response: ['model-response .markdown', 'message-content .markdown', '.response-container .markdown'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button'
    },
    grok: {
        name: 'Grok',
        icon: 'icons/grok.svg',
        urlPattern: '*://grok.com/*',
        baseUrl: 'https://grok.com/',
        selectors: {
            input: [
                'textarea[aria-label*="Grok"]',
                'textarea[placeholder*="知道什么"]',
                'textarea[placeholder*="Ask Grok"]',
                'div.tiptap.ProseMirror',
                '.ProseMirror',
                'textarea'
            ],
            button: [
                'button[aria-label="提交"]',
                'button[aria-label="Submit"]',
                'button[aria-label="Send message"]',
                'button[type="submit"]',
                'button:has(svg[viewBox*="0 0 24 24"])', // 匹配变形后的发送图标
                'div[role="button"] svg',
                '.p-4.flex.justify-end button'
            ],
            response: ['div[data-testid="message-text-content"]', '.message-bubble .markdown-content', '[class*="message"] [class*="markdown"]'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button'
    },
    kimi: {
        name: 'Kimi',
        icon: 'icons/kimi.png',
        urlPattern: '*://kimi.moonshot.cn/*',
        urlPatternAlt: '*://www.kimi.com/*',
        baseUrl: 'https://kimi.moonshot.cn/',
        selectors: {
            input: ['div[contenteditable="true"]', 'div.chat-input'],
            button: ['div[class*="sendButton"]', 'button[class*="sendButton"]', '#send-button'],
            response: ['div[class*="message--assistant"] div[class*="content"]', '.markdown-body'],
        },
        // 对 Kimi 改为在内容脚本里模拟「聚焦 → 粘贴」,
        // 不再走主世界的 executeMainWorldFill，以避免多重事件导致重复文本。
        fillMethod: 'content-script',
        // 发送阶段统一使用 Enter 键提交，避免依赖按钮选择器
        sendMethod: 'enter'
    },
    deepseek: {
        name: 'DeepSeek',
        icon: 'icons/deepseek.svg',
        urlPattern: '*://chat.deepseek.com/*',
        baseUrl: 'https://chat.deepseek.com/',
        selectors: {
            input: ['textarea#chat-input', 'textarea[placeholder*="DeepSeek"]', 'textarea'],
            button: ['div.ds-send-button', 'button[aria-label="Send message"]', 'div[role="button"]:has(svg path[d*="M16.5"])'],
            response: ['div.ds-markdown', '.ds-render-content'],
        },
        fillMethod: 'main-world',
        // DeepSeek 也改为使用 Enter 键提交，更稳定
        sendMethod: 'enter'
    },
    chatgpt: {
        name: 'ChatGPT',
        icon: 'icons/chatgpt.svg',
        urlPattern: '*://chatgpt.com/*',
        baseUrl: 'https://chatgpt.com/',
        selectors: {
            input: ['div#prompt-textarea', 'div[contenteditable="true"]'],
            button: ['button[data-testid="send-button"]', 'button[aria-label="Send prompt"]'],
            response: ['div[data-message-author-role="assistant"] .markdown'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button'
    },
    qwen: {
        name: '通义千问',
        icon: 'icons/qwen.png',
        urlPattern: '*://chat.qwen.ai/*',
        urlPatternAlt: '*://tongyi.aliyun.com/*',
        urlPatterns: [
            '*://www.qianwen.com/*',
            '*://tongyi.aliyun.com/*',
            '*://chat.qwen.ai/*',
            '*://*.qwen.ai/*',
            '*://*.aliyun.com/tongyi*'
        ],
        baseUrl: 'https://chat.qwen.ai/',
        selectors: {
            input: [
                'div[role="textbox"]',
                'div[data-placeholder*="千问"]',
                'div[data-slate-editor="true"]',
                'textarea#msg-input',
                'textarea'
            ],
            button: [
                '.text-area-slot-container div[style*="background-color"]',
                '.text-area-slot-container div[class*="view-container"]',
                'div.text-area-slot-container div:has(svg)',
                'div[class*="operateBtn"]',
                '[data-icon-type="qwpcicon-sendChat"]',
                'span[data-icon-type="qwpcicon-sendChat"]',
                'button.ant-btn-primary',
                '.send-btn-ZaDDJC',
                'div[class*="send"] svg',
                'button:not([disabled]) svg'
            ],
            response: ['div[class*="answer-content"]', '.tongyi-markdown', '.markdown-body'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button'
    },
    yuanbao: {
        name: '腾讯元宝',
        icon: 'icons/yuanbao.ico',
        urlPattern: '*://yuanbao.tencent.com/*',
        baseUrl: 'https://yuanbao.tencent.com/chat/',
        selectors: {
            input: ['.ql-editor', 'div[contenteditable="true"]'],
            button: ['#yuanbao-send-btn', '.agent-dialogue__input__send'],
            response: ['div[class*="agent-chat__bubble__content"]', '.markdown-body'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AI_CONFIG;
}
