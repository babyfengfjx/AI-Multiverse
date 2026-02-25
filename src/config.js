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
            fileUploadButton: ['button[aria-label*="Upload"]', 'button[aria-label*="上传"]', 'input[type="file"]'],
            fileUploadInput: ['input[type="file"][accept*="image"]'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button',
        supportsFiles: true,
        supportedFileTypes: ['image/*', '.pdf', '.txt', '.doc', '.docx']
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
            fileUploadButton: ['button[aria-label*="Upload"]', 'button[aria-label*="上传"]', 'button[title*="Upload"]'],
            fileUploadInput: ['input[type="file"][accept*="image"]'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button',
        supportsFiles: true,
        supportedFileTypes: ['image/*', '.pdf', '.txt']
    },
    kimi: {
        name: 'Kimi',
        icon: 'icons/kimi.png',
        urlPattern: '*://kimi.moonshot.cn/*',
        urlPatternAlt: '*://www.kimi.com/*',
        baseUrl: 'https://kimi.moonshot.cn/',
        selectors: {
            input: [
                'div[contenteditable="true"]',
                'div.chat-input',
                'div[class*="input"]',
                'div[class*="editor"]',
                'textarea',
                '#chat-input'
            ],
            button: [
                'div[class*="sendButton"]',
                'button[class*="sendButton"]',
                '#send-button',
                'div[class*="send"]',
                'button[type="submit"]'
            ],
            response: [
                // Most specific: the direct message content container for assistant messages
                // Using > to only target direct children to avoid partial matches
                '.segment-assistant .message-content',
                'div[class*="message--assistant"] > div[class*="content"]',
                // Kimi specific class pattern for the full response block
                'div[class*="message-item--assistant"] [class*="markdown"]',
                // Fallback broader selectors
                '.markdown-body',
                'div[class*="response"]',
                'div[class*="answer"]'
            ],
            fileUploadButton: ['button[aria-label*="Upload"]', 'button[aria-label*="上传"]', 'button[title*="Upload"]'],
            fileUploadInput: ['input[type="file"]'],
        },
        // 使用 main-world 填充以确保 Kimi 的内部状态正确更新
        fillMethod: 'main-world',
        // 使用按钮点击，Enter 键在 Kimi 上不稳定
        sendMethod: 'button',
        supportsFiles: true,
        supportedFileTypes: ['image/*', '.pdf', '.txt', '.doc', '.docx', '.md', '.json', '.csv']
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
            fileUploadButton: ['button[aria-label*="image"]', 'button[aria-label*="图片"]', 'button[title*="image"]'],
            fileUploadInput: ['input[type="file"][accept*="image"]'],
        },
        fillMethod: 'main-world',
        // DeepSeek 也改为使用 Enter 键提交，更稳定
        sendMethod: 'enter',
        supportsFiles: true,
        supportedFileTypes: ['image/*']
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
            fileUploadInput: ['input[type="file"]'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button',
        supportsFiles: true,
        supportedFileTypes: ['image/*', '.pdf', '.txt', '.md', '.json', '.csv', '.py', '.js']
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
            response: [
                'div[class*="answer-content"]',
                '.tongyi-markdown',
                '.markdown-body',
                'div[class*="message-content"]',
                'div[class*="assistant-content"]',
                'div[class*="bot-content"]',
                'div[class*="rich-text"]',
                'div[data-content]',
                '.message.bubble .content',
                '[class*="answer"] [class*="content"]'
            ],
            fileUploadInput: ['input[type="file"]'],
        },
        fillMethod: 'main-world',
        // 千问改为使用 Enter 键提交，避免依赖按钮状态
        sendMethod: 'enter',
        supportsFiles: true,
        supportedFileTypes: ['.pdf', '.doc', '.docx', '.txt', '.md', '.json', '.csv', 'image/*']
    },
    yuanbao: {
        name: '腾讯元宝',
        icon: 'icons/yuanbao.ico',
        urlPattern: '*://yuanbao.tencent.com/*',
        baseUrl: 'https://yuanbao.tencent.com/chat/',
        selectors: {
            input: ['.ql-editor', 'div[contenteditable="true"]'],
            button: ['#yuanbao-send-btn', '.agent-dialogue__input__send'],
            response: [
                // 最新的元宝响应选择器
                'div.agent-chat__bubble__content',
                'div[class*="agent-chat__bubble__content"]',
                'div[class*="bubble__content"]',
                'div[class*="chat__bubble"]',
                // 备用选择器
                '.markdown-body',
                'div[class*="message-content"]',
                'div[class*="chat-content"]',
                'div[class*="assistant-message"]',
                'div[class*="bot-message"]',
                'div[data-role="assistant"]',
                '.markdown-content',
                '.rich-text-content',
                'div.chat-view__message__content',
                // 通用回退选择器
                'div[class*="answer"]',
                'div[class*="response"]',
                'div[class*="reply"]'
            ],
            fileUploadInput: ['input[type="file"]'],
        },
        fillMethod: 'main-world',
        sendMethod: 'button',
        supportsFiles: true,
        supportedFileTypes: ['image/*', '.pdf', '.doc', '.docx', '.txt', '.md']
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AI_CONFIG;
}
