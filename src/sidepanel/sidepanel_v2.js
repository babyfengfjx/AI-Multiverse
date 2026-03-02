/**
 * AI Multiverse - Sidepanel v2.0
 * 聊天流式界面
 */

// Configure marked.js
function configureMarked() {
  if (typeof marked !== "undefined" && typeof hljs !== "undefined") {
    marked.setOptions({
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (e) {}
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
      sanitize: false,
    });
    return true;
  }
  return false;
}

/**
 * 递归将 DOM 节点转换为 Markdown 字符串
 */
function nodeToMarkdown(node, listDepth) {
  listDepth = listDepth || 0;
  if (!node) return "";

  // 文本节点
  if (node.nodeType === 3) {
    return node.textContent;
  }
  if (node.nodeType !== 1) return "";

  var tag = node.tagName.toLowerCase();

  function children(depth) {
    depth = depth !== undefined ? depth : listDepth;
    return Array.from(node.childNodes)
      .map(function (n) {
        return nodeToMarkdown(n, depth);
      })
      .join("");
  }

  switch (tag) {
    case "h1":
      return "\n# " + children().trim() + "\n\n";
    case "h2":
      return "\n## " + children().trim() + "\n\n";
    case "h3":
      return "\n### " + children().trim() + "\n\n";
    case "h4":
      return "\n#### " + children().trim() + "\n\n";
    case "h5":
      return "\n##### " + children().trim() + "\n\n";
    case "h6":
      return "\n###### " + children().trim() + "\n\n";
    case "p":
      return "\n" + children().trim() + "\n\n";
    case "br":
      return "\n";
    case "hr":
      return "\n---\n\n";
    case "strong":
    case "b":
      return "**" + children() + "**";
    case "em":
    case "i":
      return "*" + children() + "*";
    case "del":
    case "s":
      return "~~" + children() + "~~";
    case "code": {
      // inline code — pre>code 由 pre 分支处理
      if (
        node.parentElement &&
        node.parentElement.tagName.toLowerCase() === "pre"
      ) {
        return children();
      }
      return "`" + children() + "`";
    }
    case "pre": {
      var codeEl = node.querySelector("code");
      var lang = "";
      if (codeEl && codeEl.className) {
        var m = codeEl.className.match(/language-(\w+)/);
        if (m) lang = m[1];
      }
      var code = codeEl ? codeEl.textContent : node.textContent;
      return "\n```" + lang + "\n" + code + "\n```\n\n";
    }
    case "blockquote": {
      var inner = children().trim();
      return (
        "\n" +
        inner
          .split("\n")
          .map(function (l) {
            return "> " + l;
          })
          .join("\n") +
        "\n\n"
      );
    }
    case "ul": {
      var items = Array.from(node.childNodes).filter(function (c) {
        return c.nodeType === 1 && c.tagName.toLowerCase() === "li";
      });
      var indent = "  ".repeat(listDepth);
      return (
        "\n" +
        items
          .map(function (li) {
            return indent + "- " + nodeToMarkdown(li, listDepth + 1).trim();
          })
          .join("\n") +
        "\n\n"
      );
    }
    case "ol": {
      var olItems = Array.from(node.childNodes).filter(function (c) {
        return c.nodeType === 1 && c.tagName.toLowerCase() === "li";
      });
      var olIndent = "  ".repeat(listDepth);
      return (
        "\n" +
        olItems
          .map(function (li, i) {
            return (
              olIndent +
              (i + 1) +
              ". " +
              nodeToMarkdown(li, listDepth + 1).trim()
            );
          })
          .join("\n") +
        "\n\n"
      );
    }
    case "li":
      return children(listDepth);
    case "a": {
      var href = node.getAttribute("href") || "";
      var linkText = children().trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript"))
        return linkText;
      return "[" + linkText + "](" + href + ")";
    }
    case "img": {
      var alt = node.getAttribute("alt") || "";
      var src = node.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return alt;
      return "![" + alt + "](" + src + ")";
    }
    case "table": {
      var rows = Array.from(node.querySelectorAll("tr"));
      if (rows.length === 0) return "";
      var mdRows = rows.map(function (row) {
        var cells = Array.from(row.querySelectorAll("th, td"));
        return (
          "| " +
          cells
            .map(function (c) {
              return c.textContent.trim().replace(/\|/g, "\\|");
            })
            .join(" | ") +
          " |"
        );
      });
      var firstRowHasTh = rows[0].querySelectorAll("th").length > 0;
      if (firstRowHasTh && rows.length >= 1) {
        var cols = rows[0].querySelectorAll("th, td").length;
        var sep = "| " + Array(cols).fill("---").join(" | ") + " |";
        return (
          "\n" + [mdRows[0], sep].concat(mdRows.slice(1)).join("\n") + "\n\n"
        );
      }
      return "\n" + mdRows.join("\n") + "\n\n";
    }
    // 跳过脚本、样式等不可见节点
    case "script":
    case "style":
    case "noscript":
    case "meta":
    case "link":
      return "";
    // 容器类节点：直接递归子节点
    default:
      return children();
  }
}

/**
 * 将任意 HTML 字符串转换为标准 Markdown 字符串
 */
function htmlToMarkdown(html) {
  if (!html || !html.trim()) return "";
  try {
    var div = document.createElement("div");
    div.innerHTML =
      typeof DOMPurify !== "undefined"
        ? DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "p",
              "br",
              "hr",
              "strong",
              "b",
              "em",
              "i",
              "del",
              "s",
              "code",
              "pre",
              "blockquote",
              "ul",
              "ol",
              "li",
              "a",
              "img",
              "table",
              "thead",
              "tbody",
              "tfoot",
              "tr",
              "th",
              "td",
              "div",
              "span",
              "section",
              "article",
              "main",
              "nav",
              "aside",
              "header",
              "footer",
            ],
            ALLOWED_ATTR: ["href", "src", "alt", "class", "language"],
          })
        : html;
    var md = nodeToMarkdown(div, 0).trim();
    // 清理多余空行（超过两个连续换行折叠为两个）
    md = md.replace(/\n{3,}/g, "\n\n");
    return md;
  } catch (e) {
    // 降级：直接剥除标签返回文本
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  configureMarked();

  // === State & Config ===
  const AI_PROVIDERS = [
    "gemini",
    "grok",
    "kimi",
    "deepseek",
    "chatgpt",
    "qwen",
    "yuanbao",
    "claude",
  ];
  let conversations = []; // 所有对话
  let currentConversationId = null; // 当前对话ID
  let currentTheme = "dark";
  let currentLang = "zh-CN";
  let selectedFiles = [];
  let summarizeModel = "gemini";
  let customSummarizePrompt = "";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  const POLLING_INTERVAL = 2000;

  // === DOM Elements ===
  const conversationStream = document.getElementById("conversationStream");
  const emptyState = document.getElementById("emptyState");
  const promptInput = document.getElementById("prompt");
  const sendBtn = document.getElementById("sendBtn");
  const fileInput = document.getElementById("fileInput");
  const attachFileBtn = document.getElementById("attachFileBtn");
  const filePreview = document.getElementById("filePreview");

  const filePreviewList = document.getElementById("filePreviewList");
  const clearFilesBtn = document.getElementById("clearFilesBtn");
  const openModelsBtn = document.getElementById("openModelsBtn");
  const modelsModal = document.getElementById("modelsModal");
  const closeModelsBtn = document.getElementById("closeModelsBtn");
  const confirmModelsBtn = document.getElementById("confirmModelsBtn");
  const selectionBadge = document.getElementById("selectionBadge");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const langToggleBtn = document.getElementById("langToggleBtn");

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
      archived: false,
    };

    // 初始化响应状态
    providers.forEach((p) => {
      conversation.responses[p] = {
        status: "loading",
        text: "",
        html: "",
        timestamp: null,
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
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    conv.responses[provider] = {
      status: data.status || "ok",
      text: data.text || "",
      html: data.html || "",
      timestamp: Date.now(),
    };
  }

  /**
   * 检查所有响应是否完成
   */
  function checkAllResponsesComplete(convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv || conv.archived) return false;

    const allComplete = conv.providers.every((p) => {
      const resp = conv.responses[p];
      return resp && (resp.status === "ok" || resp.status === "error");
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
    const conv = conversations.find((c) => c.id === convId);
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
      const data = await chrome.storage.local.get(["conversations_v2"]);
      if (data.conversations_v2 && Array.isArray(data.conversations_v2)) {
        conversations = data.conversations_v2;
        console.log(`[Storage] Loaded ${conversations.length} conversations`);
        renderConversations();
      }
    } catch (e) {
      console.error("[Storage] Load error:", e);
    }
  }

  /**
   * 保存对话到存储
   */
  async function saveConversationToStorage(convId) {
    try {
      const conv = conversations.find((c) => c.id === convId);
      if (!conv) return;

      const data = await chrome.storage.local.get(["conversations_v2"]);
      const stored = data.conversations_v2 || [];

      const index = stored.findIndex((c) => c.id === convId);
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
      console.error("[Storage] Save error:", e);
    }
  }

  /**
   * 渲染所有对话
   */
  function renderConversations() {
    if (conversations.length === 0) {
      emptyState.style.display = "flex";
      return;
    }

    emptyState.style.display = "none";
    conversationStream.innerHTML = "";

    conversations.forEach((conv) => {
      const convEl = createConversationElement(conv);
      conversationStream.appendChild(convEl);
    });

    // 滚动到最新对话
    setTimeout(() => {
      conversationStream.scrollTop = conversationStream.scrollHeight;
    }, 100);
  }

  /**
   * 创建对话元素
   */
  function createConversationElement(conv) {
    const div = document.createElement("div");
    div.className = `conversation-item ${conv.collapsed ? "collapsed" : "expanded"}`;
    div.dataset.id = conv.id;

    if (conv.collapsed) {
      // 折叠状态
      div.innerHTML = `
                <div class="conversation-header" onclick="window.toggleConversation(${conv.id})">
                    <div class="conversation-question-collapsed">${escapeHTML(conv.question)}</div>
                    <div class="conversation-meta">
                        <span>${getResponseCount(conv)} 个AI已回答</span>
                        ${conv.summary ? '<span class="summary-badge">✨ 已总结</span>' : ""}
                        ${conv.archived ? '<span class="archived-badge">📦</span>' : ""}
                    </div>
                </div>
            `;
    } else {
      // 展开状态
      const questionDiv = document.createElement("div");
      questionDiv.className = "conversation-question";
      questionDiv.textContent = conv.question;

      const responsesDiv = document.createElement("div");
      responsesDiv.className = "conversation-responses";
      responsesDiv.innerHTML = renderResponseCards(conv);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "conversation-actions";
      actionsDiv.innerHTML = `
                <button class="action-btn-secondary" onclick="window.handleSummarize(${conv.id})" ${conv.summary || !conv.archived ? "disabled" : ""}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    ${t("smart_summarize")}
                </button>
                <button class="action-btn-secondary" onclick="window.copyAllResponses(${conv.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    ${t("copy_all")}
                </button>
            `;

      div.appendChild(questionDiv);
      div.appendChild(responsesDiv);

      // 添加总结卡片
      if (conv.summary) {
        const summaryDiv = createSummaryCard(conv.summary);
        div.appendChild(summaryDiv);
      }

      div.appendChild(actionsDiv);
    }

    return div;
  }

  /**
   * 渲染响应卡片
   */
  function renderResponseCards(conv) {
    let html = "";

    conv.providers.forEach((provider) => {
      const response = conv.responses[provider];
      const config = AI_CONFIG[provider];
      if (!config) return;

      html += `
                <div class="response-card ${response.status}" data-provider="${provider}">
                    <div class="response-card-header">
                        <div class="response-card-info">
                            <img src="${config.icon}" class="provider-icon-img" alt="${config.name}">
                            <span>${config.name}</span>
                            ${getStatusBadge(response.status)}
                        </div>
                        ${response.status === "ok" && response.text ? `<div class="response-char-count">${response.text.length} 字</div>` : ""}
                    </div>
                    <div class="response-card-body" onclick="window.showResponseDetail('${provider}', ${conv.id})">
                        ${renderResponseBody(response)}
                    </div>
                </div>
            `;
    });

    return html;
  }

  /**
   * 将响应内容（html 或 text）归一化为统一 Markdown 并渲染
   * 无论哪个平台、何种格式，输出效果都保持一致
   */
  function normalizeAndRender(response) {
    var markdown = "";
    if (response.html && response.html.trim()) {
      // 平台返回的原始 HTML → 先转 Markdown，再统一渲染
      markdown = htmlToMarkdown(response.html);
    } else if (response.text && response.text.trim()) {
      // 纯文本直接作为 Markdown 渲染
      markdown = response.text;
    }
    if (!markdown.trim())
      return '<span class="loading-text">等待响应...</span>';
    return (
      '<div class="markdown-content">' + renderMarkdown(markdown) + "</div>"
    );
  }

  /**
   * 渲染响应内容
   */
  function renderResponseBody(response) {
    if (response.status === "loading") {
      return '<div class="loading-dots"><span></span><span></span><span></span></div>';
    } else if (response.status === "ok") {
      return normalizeAndRender(response);
    } else if (response.status === "error") {
      return `<div class="error-content"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>${escapeHTML(response.error || "未知错误")}</span></div>`;
    } else if (response.status === "generating") {
      return '<div class="loading-dots"><span></span><span></span><span></span></div>';
    }
    return '<div class="loading-dots"><span></span><span></span><span></span></div>';
  }

  /**
   * 获取状态徽章
   */
  function getStatusBadge(status) {
    if (status === "loading") {
      return '<span class="status-badge loading">⏳ 加载中</span>';
    } else if (status === "ok") {
      return '<span class="status-badge success">✓ 完成</span>';
    } else if (status === "error") {
      return '<span class="status-badge error">✗ 失败</span>';
    }
    return "";
  }

  /**
   * 获取响应数量
   */
  function getResponseCount(conv) {
    return Object.values(conv.responses).filter((r) => r.status === "ok")
      .length;
  }

  /**
   * 创建总结卡片
   */
  function createSummaryCard(summary) {
    const div = document.createElement("div");
    div.className = "summary-card";
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
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 渲染Markdown
   */
  function renderMarkdown(text) {
    if (!text || typeof text !== "string") return "";
    try {
      if (typeof marked === "undefined") {
        return escapeHTML(text);
      }
      let html = marked.parse(text);
      if (typeof DOMPurify !== "undefined") {
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
      alert(t("select_at_least_one"));
      return;
    }

    // 折叠之前的对话
    if (currentConversationId) {
      const prevConv = conversations.find(
        (c) => c.id === currentConversationId,
      );
      if (prevConv) {
        prevConv.collapsed = true;
      }
    }

    // 创建新对话
    const convId = createConversation(question, providers, [...selectedFiles]);

    // 清空输入
    promptInput.value = "";
    selectedFiles = [];
    filePreview.style.display = "none";

    // 渲染
    renderConversations();

    // 发送到各个AI
    try {
      await chrome.runtime.sendMessage({
        action: "broadcast_message",
        message: question,
        providers: providers,
        files: selectedFiles,
      });

      // 开始轮询响应
      startPollingResponses(convId, providers);
    } catch (e) {
      console.error("[Send] Error:", e);
      showNotification(t("send_error"), "error");
    }
  }

  /**
   * 开始轮询响应
   */
  function startPollingResponses(convId, providers) {
    console.log(
      "[AI Multiverse] Starting polling for conversation:",
      convId,
      "providers:",
      providers,
    );
    const interval = setInterval(async () => {
      const conv = conversations.find((c) => c.id === convId);
      if (!conv) {
        console.log(
          "[AI Multiverse] Conversation not found, stopping polling:",
          convId,
        );
        clearInterval(interval);
        return;
      }

      // 获取所有响应
      try {
        const result = await chrome.runtime.sendMessage({
          action: "fetch_all_responses",
          providers: providers,
        });

        console.log("[AI Multiverse] Poll result:", result);

        if (result && result.status === "ok" && result.responses) {
          // 更新每个提供商的响应
          for (const provider of providers) {
            const response = result.responses[provider];
            if (response) {
              console.log(`[AI Multiverse] Updating ${provider}:`, {
                status: response.status,
                textLength: response.text?.length || 0,
                htmlLength: response.html?.length || 0,
              });
              updateConversationResponse(convId, provider, response);
            }
          }
        }
      } catch (e) {
        console.error(`[Poll] Error:`, e);
      }

      // 检查是否全部完成
      if (checkAllResponsesComplete(convId)) {
        console.log("[AI Multiverse] All responses complete, stopping polling");
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
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    conv.collapsed = !conv.collapsed;
    renderConversations();

    // 如果展开，滚动到该对话
    if (!conv.collapsed) {
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${convId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  };

  /**
   * 显示响应详情
   */
  window.showResponseDetail = function (provider, convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    const response = conv.responses[provider];
    if (!response || response.status !== "ok") return;

    // 使用现有的详情模态框
    const detailModal = document.getElementById("detailModal");
    const detailIcon = document.getElementById("detailIcon");
    const detailName = document.getElementById("detailName");
    const detailText = document.getElementById("detailText");

    const config = AI_CONFIG[provider];
    detailIcon.src = config.icon;
    detailName.textContent = config.name;

    // 统一通过 normalizeAndRender 渲染，确保详情弹窗样式与卡片一致
    detailText.innerHTML = normalizeAndRender(response);

    detailModal.classList.add("active");
  };

  /**
   * 智能总结
   */
  window.handleSummarize = async function (convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv || !conv.archived) {
      showNotification(t("wait_for_responses"), "info");
      return;
    }

    // 构建总结提示词
    let prompt = customSummarizePrompt || getDefaultSummarizePrompt();

    // 添加所有响应内容
    prompt += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    prompt += `${t("question")}: ${conv.question}\n\n`;

    conv.providers.forEach((provider) => {
      const response = conv.responses[provider];
      if (response && response.status === "ok" && response.text) {
        const config = AI_CONFIG[provider];
        prompt += `━━━ ${config.name} ━━━\n${response.text}\n\n`;
      }
    });

    // 创建临时总结状态
    conv.summary = {
      model: summarizeModel,
      text: "",
      html: "",
      status: "loading",
      timestamp: Date.now(),
    };

    renderConversations();

    try {
      // 发送总结请求
      const sendResult = await chrome.runtime.sendMessage({
        action: "summarize_responses",
        provider: summarizeModel,
        prompt: prompt,
      });

      if (sendResult && sendResult.status === "error") {
        throw new Error(sendResult.error || "summarize_responses failed");
      }

      // 延迟启动轮询：
      // fill_and_send 消息发出并返回后，AI 页面的编辑器状态更新、按钮激活、
      // 请求发出均需一定时间（Gemini paste+Quill 约需 600ms，再加网络请求启动）。
      // 等待 3000ms 后再开始轮询，确保此时检测到的是新回复而非上一次的旧内容。
      const pollStartDelay = 3000;
      console.log(
        `[Summarize] fill_and_send OK, starting poll in ${pollStartDelay}ms for provider: ${summarizeModel}`,
      );
      startPollingSummary(convId, summarizeModel, pollStartDelay);
    } catch (e) {
      console.error("[Summarize] Error:", e);
      conv.summary = null;
      renderConversations();
      showNotification(t("summarize_error"), "error");
    }
  };

  /**
   * 轮询总结结果
   *
   * @param {number} convId        - 对话 ID
   * @param {string} provider      - 总结模型（如 "gemini"）
   * @param {number} [startDelay]  - 首次轮询前的额外等待时间（ms），
   *                                 用于等待 fill_and_send 完成内部状态更新后
   *                                 再开始检测新回复，避免过早拿到旧内容
   */
  function startPollingSummary(convId, provider, startDelay = 0) {
    // 超时保护：最多等待 120 秒，防止无限轮询
    const MAX_POLL_MS = 120_000;
    const pollStart = Date.now();

    // 延迟启动：先等待 startDelay ms，再开启 interval
    const beginPolling = () => {
      const interval = setInterval(async () => {
        const conv = conversations.find((c) => c.id === convId);
        if (!conv || !conv.summary) {
          clearInterval(interval);
          return;
        }

        // 超时检测
        if (Date.now() - pollStart > MAX_POLL_MS) {
          console.warn("[Poll Summary] Timeout waiting for summary response");
          clearInterval(interval);
          conv.summary = null;
          renderConversations();
          showNotification(t("summarize_error"), "error");
          return;
        }

        try {
          const result = await chrome.runtime.sendMessage({
            action: "fetch_all_responses",
            providers: [provider],
          });

          if (result && result.status === "ok" && result.responses) {
            const response = result.responses[provider];
            if (response && response.status === "ok" && response.text) {
              conv.summary = {
                model: provider,
                text: response.text,
                html: response.html || "",
                status: "ok",
                timestamp: Date.now(),
              };

              // 总结完成，存档
              await archiveConversation(convId);
              clearInterval(interval);
              renderConversations();
              showNotification(t("summarize_complete"), "success");
            } else if (response && response.status === "error") {
              // 模型返回了明确的错误状态，终止轮询
              console.warn(
                "[Poll Summary] Provider returned error:",
                response.error,
              );
              clearInterval(interval);
              conv.summary = null;
              renderConversations();
              showNotification(t("summarize_error"), "error");
            }
            // status === "generating" / "loading" → 继续等待，不做任何操作
          }
        } catch (e) {
          console.error("[Poll Summary] Error:", e);
        }
      }, POLLING_INTERVAL);
    };

    if (startDelay > 0) {
      setTimeout(beginPolling, startDelay);
    } else {
      beginPolling();
    }
  }

  /**
   * 获取默认总结提示词
   */
  function getDefaultSummarizePrompt() {
    if (currentLang === "zh-CN") {
      return "请对以下多个AI的回答进行智能总结，提取关键信息，突出共同点和差异点，给出综合性的结论：";
    } else {
      return "Please provide an intelligent summary of the following AI responses, extract key information, highlight commonalities and differences, and give a comprehensive conclusion:";
    }
  }

  /**
   * 复制所有响应
   */
  window.copyAllResponses = async function (convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    let text = `${t("question")}: ${conv.question}\n\n`;

    conv.providers.forEach((provider) => {
      const response = conv.responses[provider];
      if (response && response.status === "ok" && response.text) {
        const config = AI_CONFIG[provider];
        text += `━━━ ${config.name} ━━━\n${response.text}\n\n`;
      }
    });

    try {
      await navigator.clipboard.writeText(text);
      showNotification(t("copy_success"), "success");
    } catch (e) {
      console.error("[Copy] Error:", e);
      showNotification(t("error"), "error");
    }
  };

  /**
   * 获取选中的提供商
   */
  function getSelectedProviders() {
    const selected = [];
    AI_PROVIDERS.forEach((p) => {
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
    chrome.storage.local.get(["selectedProviders"], (result) => {
      if (result.selectedProviders) {
        AI_PROVIDERS.forEach((p) => {
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
    chrome.storage.local.get(["theme"], (result) => {
      currentTheme = result.theme || "dark";
      applyTheme(currentTheme);
    });
  }

  /**
   * 应用主题
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const sunIcon = document.querySelector(".theme-icon-sun");
    const moonIcon = document.querySelector(".theme-icon-moon");
    if (theme === "light") {
      sunIcon.style.display = "block";
      moonIcon.style.display = "none";
    } else {
      sunIcon.style.display = "none";
      moonIcon.style.display = "block";
    }
  }

  /**
   * 切换主题
   */
  function toggleTheme() {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    chrome.storage.local.set({ theme: currentTheme });
    applyTheme(currentTheme);
  }

  /**
   * 加载语言
   */
  function loadLanguage() {
    chrome.storage.local.get(["lang"], (result) => {
      currentLang = result.lang || "zh-CN";
      setLanguage(currentLang);
      applyLanguage();
    });
  }

  /**
   * 应用语言
   */
  function applyLanguage() {
    const langLabel = currentLang === "zh-CN" ? "中文" : "EN";
    const langBadge = document.querySelector(".lang-badge");
    if (langBadge) langBadge.textContent = langLabel;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = t(key);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.title = t(key);
    });
  }

  /**
   * 切换语言
   */
  function toggleLanguage() {
    currentLang = currentLang === "en" ? "zh-CN" : "en";
    chrome.storage.local.set({ lang: currentLang });
    setLanguage(currentLang);
    applyLanguage();
  }

  /**
   * 加载总结设置
   */
  function loadSummarizeSettings() {
    chrome.storage.local.get(
      ["summarizeModel", "customSummarizePrompt"],
      (result) => {
        summarizeModel = result.summarizeModel || "gemini";
        customSummarizePrompt = result.customSummarizePrompt || "";
      },
    );
  }

  /**
   * 显示通知
   */
  function showNotification(message, type = "info") {
    const statusPanel = document.getElementById("status");
    if (!statusPanel) {
      console.log(`[${type.toUpperCase()}] ${message}`);
      return;
    }

    statusPanel.textContent = message;
    statusPanel.className = `status-panel ${type}`;
    statusPanel.style.display = "block";

    setTimeout(() => {
      statusPanel.style.display = "none";
    }, 3000);
  }

  /**
   * 清空历史
   */
  async function clearAllHistory() {
    const confirmMsg =
      currentLang === "zh-CN"
        ? "确定要清空所有对话历史吗？此操作不可恢复。"
        : "Are you sure you want to clear all conversation history? This action cannot be undone.";

    if (!confirm(confirmMsg)) {
      return;
    }

    conversations = [];
    currentConversationId = null;
    await chrome.storage.local.set({ conversations_v2: [] });
    renderConversations();
    showNotification(t("history_cleared"), "success");
  }

  // === Event Listeners ===

  // 发送按钮
  sendBtn.addEventListener("click", handleSendMessage);

  // Enter键发送
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // 附加文件
  attachFileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);
  clearFilesBtn.addEventListener("click", clearAllFiles);

  // 模型选择
  openModelsBtn.addEventListener("click", () =>
    modelsModal.classList.add("active"),
  );
  closeModelsBtn.addEventListener("click", () =>
    modelsModal.classList.remove("active"),
  );
  confirmModelsBtn.addEventListener("click", () => {
    saveSelectedProviders();
    modelsModal.classList.remove("active");
  });

  // 主题和语言
  themeToggleBtn.addEventListener("click", toggleTheme);
  langToggleBtn.addEventListener("click", toggleLanguage);

  // 清空历史
  clearHistoryBtn.addEventListener("click", clearAllHistory);

  // 总结设置
  const summarizeSettingsBtn = document.getElementById("summarizeSettingsBtn");
  const summarizeSettingsModal = document.getElementById(
    "summarizeSettingsModal",
  );
  const closeSummarizeSettingsBtn = document.getElementById(
    "closeSummarizeSettingsBtn",
  );
  const summarizeSettingsCancelBtn = document.getElementById(
    "summarizeSettingsCancelBtn",
  );
  const summarizeSettingsConfirmBtn = document.getElementById(
    "summarizeSettingsConfirmBtn",
  );
  const summarizeModelSelect = document.getElementById("summarizeModelSelect");
  const summarizePromptInput = document.getElementById("summarizePromptInput");
  const useDefaultPromptBtn = document.getElementById("useDefaultPromptBtn");
  const resetPromptBtn = document.getElementById("resetPromptBtn");

  if (summarizeSettingsBtn) {
    summarizeSettingsBtn.addEventListener("click", () => {
      summarizeModelSelect.value = summarizeModel;
      summarizePromptInput.value = customSummarizePrompt;
      summarizeSettingsModal.classList.add("active");
    });
  }

  if (closeSummarizeSettingsBtn) {
    closeSummarizeSettingsBtn.addEventListener("click", () => {
      summarizeSettingsModal.classList.remove("active");
    });
  }

  if (summarizeSettingsCancelBtn) {
    summarizeSettingsCancelBtn.addEventListener("click", () => {
      summarizeSettingsModal.classList.remove("active");
    });
  }

  if (summarizeSettingsConfirmBtn) {
    summarizeSettingsConfirmBtn.addEventListener("click", () => {
      summarizeModel = summarizeModelSelect.value;
      customSummarizePrompt = summarizePromptInput.value.trim();
      chrome.storage.local.set({
        summarizeModel: summarizeModel,
        customSummarizePrompt: customSummarizePrompt,
      });
      summarizeSettingsModal.classList.remove("active");
      showNotification(t("settings_saved"), "success");
    });
  }

  if (useDefaultPromptBtn) {
    useDefaultPromptBtn.addEventListener("click", () => {
      summarizePromptInput.value = getDefaultSummarizePrompt();
    });
  }

  if (resetPromptBtn) {
    resetPromptBtn.addEventListener("click", () => {
      summarizePromptInput.value = "";
    });
  }

  // 关闭详情模态框
  const closeDetailBtn = document.getElementById("closeDetailBtn");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => {
      document.getElementById("detailModal").classList.remove("active");
    });
  }

  // 文件处理函数
  async function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(
          `文件 ${file.name} 过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
        continue;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        selectedFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: dataUrl,
        });
      } catch (e) {
        console.error("[File] Read error:", e);
      }
    }

    renderFilePreview();
    fileInput.value = "";
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
      filePreview.style.display = "none";
      return;
    }

    filePreview.style.display = "block";
    filePreviewList.innerHTML = selectedFiles
      .map(
        (file, index) => `
            <div class="file-preview-item">
                <span class="file-name">${escapeHTML(file.name)}</span>
                <button class="file-remove-btn" onclick="window.removeFile(${index})">&times;</button>
            </div>
        `,
      )
      .join("");
  }

  window.removeFile = function (index) {
    selectedFiles.splice(index, 1);
    renderFilePreview();
  };

  function clearAllFiles() {
    selectedFiles = [];
    renderFilePreview();
  }

  console.log("[AI Multiverse v2.0] Initialized");
});
