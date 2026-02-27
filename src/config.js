// Use globalThis to ensure it's available in all environments without redeclaration errors
if (typeof globalThis.AI_STATUS === "undefined") {
  globalThis.AI_STATUS = {
    GENERATING: "generating",
    OK: "ok",
    LOADING: "loading",
    ERROR: "error",
    NOT_OPEN: "not_open",
    SENDING: "sending",
    TIMEOUT: "timeout",
  };
}

const AI_CONFIG = {
  gemini: {
    name: "Gemini",
    icon: "icons/gemini.svg",
    urlPattern: "*://gemini.google.com/*",
    baseUrl: "https://gemini.google.com/app",
    selectors: {
      input: [
        'div.ql-editor[contenteditable="true"]',
        ".ql-editor",
        'textarea[aria-label="Prompt"]',
        'div[role="textbox"]',
      ],
      button: [
        'button[aria-label="Send message"]',
        'button[aria-label="发送"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="发送提示"]',
        'div[role="button"][aria-label="Send message"]',
        'div[role="button"][aria-label="Send prompt"]',
        // 2025 Gemini UI 兜底：部分匹配 aria-label，覆盖不同语言/版本
        'button[aria-label*="Send"]',
        'button[aria-label*="发送"]',
        'button[data-test-id="send-button"]',
        'button[jsname*="send"]',
        "button.send-button",
        ".send-button",
        // 最终兜底：表单提交按钮
        'form button[type="submit"]',
        'button[type="submit"]',
      ],
      response: [
        // 最精确的选择器 - 直接定位到实际内容区域
        "model-response .markdown.markdown-main-panel",
        "model-response .model-response-text",
        "message-content .markdown.markdown-main-panel",
        // 2025 Gemini UI 新结构
        "model-response .response-container .markdown",
        "model-response .response-container",
        "model-response [class*='response-text']",
        "model-response [class*='markdown']",
        // 备用选择器 - 避免选中包含空白的父元素
        "model-response .markdown:not(.markdown-header):not(:empty)",
        "message-content .markdown:not(:empty)",
        "div[data-message-id] .markdown:not(:empty)",
        // 新版 Gemini 可能使用的结构
        "ms-model-response .markdown",
        "ms-model-response",
        "conversation-turn model-response",
        // 最后的回退选择器
        "model-response",
        "message-content",
      ],
      fileUploadButton: [
        'button[aria-label*="Upload"]',
        'button[aria-label*="上传"]',
        'input[type="file"]',
      ],
      fileUploadInput: ['input[type="file"][accept*="image"]'],
    },
    fillMethod: "main-world",
    sendMethod: "button",
    supportsFiles: true,
    supportedFileTypes: ["image/*", ".pdf", ".txt", ".doc", ".docx"],
  },
  grok: {
    name: "Grok",
    icon: "icons/grok.svg",
    urlPattern: "*://grok.com/*",
    baseUrl: "https://grok.com/",
    selectors: {
      input: [
        'textarea[aria-label*="Grok"]',
        'textarea[placeholder*="知道什么"]',
        'textarea[placeholder*="Ask Grok"]',
        "div.tiptap.ProseMirror",
        ".ProseMirror",
        "textarea",
      ],
      button: [
        'button[aria-label="提交"]',
        'button[aria-label="Submit"]',
        'button[aria-label="Send message"]',
        'button[type="submit"]',
        'button:has(svg[viewBox*="0 0 24 24"])', // 匹配变形后的发送图标
        'div[role="button"] svg',
        ".p-4.flex.justify-end button",
      ],
      response: [
        'div[data-testid="message-text-content"]',
        'div[data-testid="grok-response"]',
        ".markdown-content",
        ".message-bubble .markdown-content",
        '[class*="message"] [class*="markdown"]',
      ],
      fileUploadButton: [
        'button[aria-label*="Upload"]',
        'button[aria-label*="上传"]',
        'button[title*="Upload"]',
      ],
      fileUploadInput: ['input[type="file"][accept*="image"]'],
    },
    fillMethod: "main-world",
    sendMethod: "button",
    supportsFiles: true,
    supportedFileTypes: ["image/*", ".pdf", ".txt"],
  },
  kimi: {
    name: "Kimi",
    icon: "icons/kimi.png",
    urlPattern: "*://kimi.moonshot.cn/*",
    urlPatternAlt: "*://www.kimi.com/*",
    baseUrl: "https://kimi.moonshot.cn/",
    selectors: {
      input: [
        'div[contenteditable="true"]',
        "div.chat-input",
        'div[class*="input"]',
        'div[class*="editor"]',
        "textarea",
        "#chat-input",
      ],
      button: [
        'div[class*="sendButton"]',
        'button[class*="sendButton"]',
        "#send-button",
        'div[class*="send"]',
        'button[type="submit"]',
      ],
      response: [
        // 精确 class 匹配：只选 "segment segment-assistant"，
        // 避免子字符串匹配误命中 segment-assistant-actions / segment-assistant-actions-content
        "div.segment.segment-assistant",
        // 备用：整个 chat-content-item-assistant 容器（含所有 segment）
        "div.chat-content-item.chat-content-item-assistant",
        // 兜底：直接找 markdown 内容容器
        ".segment-content-box",
        ".markdown-container .markdown",
      ],
      fileUploadButton: [
        'button[aria-label*="Upload"]',
        'button[aria-label*="上传"]',
        'button[title*="Upload"]',
      ],
      fileUploadInput: ['input[type="file"]'],
    },
    // 使用 main-world 填充以确保 Kimi 的内部状态正确更新
    fillMethod: "main-world",
    // 使用按钮点击，Enter 键在 Kimi 上不稳定
    sendMethod: "button",
    supportsFiles: true,
    supportedFileTypes: [
      "image/*",
      ".pdf",
      ".txt",
      ".doc",
      ".docx",
      ".md",
      ".json",
      ".csv",
    ],
  },
  deepseek: {
    name: "DeepSeek",
    icon: "icons/deepseek.svg",
    urlPattern: "*://chat.deepseek.com/*",
    baseUrl: "https://chat.deepseek.com/",
    selectors: {
      input: [
        "textarea#chat-input",
        'textarea[placeholder*="DeepSeek"]',
        "textarea",
      ],
      button: [
        "div.ds-send-button",
        'button[aria-label="Send message"]',
        'button[aria-label="发送消息"]',
        'div[role="button"]:has(svg path[d*="M16.5"])',
      ],
      response: [
        "div.ds-markdown",
        ".ds-render-content",
        ".ds-markdown--block",
        '[class*="markdown"]',
        ".f8e71c6e", // DeepSeek obsfurcated class fallback
        "div[row-id] .ds-markdown",
      ],
      fileUploadButton: [
        'button[aria-label*="image"]',
        'button[aria-label*="图片"]',
        'button[title*="image"]',
      ],
      fileUploadInput: ['input[type="file"][accept*="image"]'],
    },
    fillMethod: "main-world",
    // DeepSeek 也改为使用 Enter 键提交，更稳定
    sendMethod: "enter",
    supportsFiles: true,
    supportedFileTypes: ["image/*"],
  },
  chatgpt: {
    name: "ChatGPT",
    icon: "icons/chatgpt.svg",
    urlPattern: "*://chatgpt.com/*",
    baseUrl: "https://chatgpt.com/",
    selectors: {
      input: ["div#prompt-textarea", 'div[contenteditable="true"]'],
      button: [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
      ],
      response: ['div[data-message-author-role="assistant"] .markdown'],
      fileUploadInput: ['input[type="file"]'],
    },
    fillMethod: "main-world",
    sendMethod: "button",
    supportsFiles: true,
    supportedFileTypes: [
      "image/*",
      ".pdf",
      ".txt",
      ".md",
      ".json",
      ".csv",
      ".py",
      ".js",
    ],
  },
  qwen: {
    name: "通义千问",
    icon: "icons/qwen.png",
    urlPattern: "*://www.qianwen.com/*",
    urlPatternAlt: "*://tongyi.aliyun.com/*",
    urlPatterns: [
      "*://www.qianwen.com/*",
      "*://tongyi.aliyun.com/*",
      "*://*.aliyun.com/tongyi*",
    ],
    baseUrl: "https://www.qianwen.com/",
    selectors: {
      input: [
        'div[role="textbox"]',
        'div[data-placeholder*="千问"]',
        'div[data-slate-editor="true"]',
        "textarea#msg-input",
        "textarea",
      ],
      button: [
        // 更精确的选择器 - 优先使用最新的
        'button:has(svg[data-icon-type="qwpcicon-sendChat"])',
        'div[class*="sendButton"]',
        'div[class*="SendButton"]',
        ".text-area-slot-container button",
        '.text-area-slot-container div[role="button"]',
        'span[data-icon-type="qwpcicon-sendChat"]',
        '.text-area-slot-container div[style*="background-color"]',
        "div.text-area-slot-container div:has(svg)",
        "button.ant-btn-primary:not([disabled])",
        'div[class*="operateBtn"]',
        "button:not([disabled]) svg",
      ],
      response: [
        '[class*="answer-content-inner"]',
        '[class*="answer-content"]',
        ".tongyi-markdown",
        ".markdown-body",
        '[class*="answer_block"]',
        '[class*="ResponseContent"]',
        '[class*="chatReply"] [class*="content"]',
        '[data-role="assistant"] [class*="content"]',
        '[data-role="assistant"]',
      ],
      fileUploadInput: ['input[type="file"]'],
    },
    fillMethod: "main-world",
    // 改为使用 button 模式，更可靠
    sendMethod: "button",
    supportsFiles: true,
    supportedFileTypes: [
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".md",
      ".json",
      ".csv",
      "image/*",
    ],
  },
  yuanbao: {
    name: "腾讯元宝",
    icon: "icons/yuanbao.ico",
    urlPattern: "*://yuanbao.tencent.com/*",
    baseUrl: "https://yuanbao.tencent.com/chat/",
    selectors: {
      input: [".ql-editor", 'div[contenteditable="true"]'],
      button: ["#yuanbao-send-btn", ".agent-dialogue__input__send"],
      response: [
        // 最新的元宝响应选择器
        "div.agent-chat__bubble__content",
        'div[class*="agent-chat__bubble__content"]',
        'div[class*="bubble__content"]',
        'div[class*="chat__bubble"]',
        // 备用选择器
        ".markdown-body",
        'div[class*="message-content"]',
        'div[class*="chat-content"]',
        'div[class*="assistant-message"]',
        'div[class*="bot-message"]',
        'div[data-role="assistant"]',
        ".markdown-content",
        ".rich-text-content",
        "div.chat-view__message__content",
        // 通用回退选择器
        'div[class*="answer"]',
        'div[class*="response"]',
        'div[class*="reply"]',
      ],
      fileUploadInput: ['input[type="file"]'],
    },
    fillMethod: "main-world",
    sendMethod: "button",
    supportsFiles: true,
    supportedFileTypes: ["image/*", ".pdf", ".doc", ".docx", ".txt", ".md"],
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AI_CONFIG;
}
