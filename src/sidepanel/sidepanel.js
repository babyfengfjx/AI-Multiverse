/**
 * AI Multiverse - Sidepanel v2.0
 * 聊天流式界面
 */

// Fix for highlight.js module error in browser environment
if (typeof module === "undefined") {
  window.module = {};
}

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
          const result = hljs.highlightAuto(code);
          // Fix: Don't use language 'plain' as it's not recognized by highlight.js
          if (result.language === 'plain') {
            return hljs.highlightAuto(code, ['javascript', 'python', 'json', 'markdown', 'html', 'css']).value || code;
          }
          return result.value;
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
  if (node.nodeType === 3) return node.textContent; // 文本节点
  if (node.nodeType !== 1) return "";

  var tag = node.tagName.toLowerCase();

  // Yuanbao (腾讯元宝) 列表的编号/圆点是独立的 dot 节点，
  // 在 HTML -> Markdown 过程中若保留，会与 Markdown 列表自身的标记重复。
  // 这里直接忽略这些“装饰性”节点。
  try {
    const cls = node.className || "";
    if (
      typeof cls === "string" &&
      (cls.includes("ybc-li-component__dot-wp") ||
        cls.includes("ybc-li-component_dot"))
    ) {
      return "";
    }
  } catch (e) {}

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
      var lis = Array.from(node.childNodes).filter(function (c) {
        return c.nodeType === 1 && c.tagName.toLowerCase() === "li";
      });
      var ind = "  ".repeat(listDepth);
      return (
        "\n" +
        lis
          .map(function (li) {
            // 获取 li 的直接内容（排除嵌套 ul/ol），并去掉 li 内部可能自带的列表前缀，避免重复
            var directContent = Array.from(li.childNodes)
              .filter(function (child) {
                return (
                  child.nodeType === 3 ||
                  (child.nodeType === 1 &&
                    child.tagName.toLowerCase() !== "ul" &&
                    child.tagName.toLowerCase() !== "ol")
                );
              })
              .map(function (child) {
                return child.nodeType === 3
                  ? child.textContent
                  : nodeToMarkdown(child, 0);
              })
              .join("")
              .trim();

            // 去掉可能混入的 bullet / dash 前缀
            directContent = directContent.replace(/^\s*(?:[-*•·▪▫]+)\s+/, "");

            // 去掉可能混入的编号前缀（无序列表里也可能包含 "1." / "1、" / "（1）" / "1)" 等）
            directContent = directContent
              .replace(/^\s*[（(]?\s*\d+\s*[)）]?\s*[.、)]\s+/, "")
              .replace(/^\s*\d+\s*[.、)]\s+/, "");

            // 追加嵌套列表（如有），保留结构
            var nestedLists = Array.from(li.children || []).filter(
              function (el) {
                var t = el.tagName ? el.tagName.toLowerCase() : "";
                return t === "ul" || t === "ol";
              },
            );
            var nestedMd = nestedLists
              .map(function (nested) {
                return nodeToMarkdown(nested, listDepth + 1).trimEnd();
              })
              .filter(Boolean)
              .join("\n");

            return (
              ind +
              "- " +
              (directContent || "") +
              (nestedMd ? "\n" + nestedMd : "")
            );
          })
          .join("\n") +
        "\n\n"
      );
    }
    case "ol": {
      var olis = Array.from(node.childNodes).filter(function (c) {
        return c.nodeType === 1 && c.tagName.toLowerCase() === "li";
      });
      var oind = "  ".repeat(listDepth);
      return (
        "\n" +
        olis
          .map(function (li, i) {
            // 获取 li 的直接内容（排除嵌套 ul/ol），并去掉 li 内部可能自带的编号，避免重复
            var directContent = Array.from(li.childNodes)
              .filter(function (child) {
                return (
                  child.nodeType === 3 ||
                  (child.nodeType === 1 &&
                    child.tagName.toLowerCase() !== "ul" &&
                    child.tagName.toLowerCase() !== "ol")
                );
              })
              .map(function (child) {
                return child.nodeType === 3
                  ? child.textContent
                  : nodeToMarkdown(child, 0);
              })
              .join("")
              .trim();

            // 去掉可能混入的编号前缀（如 "1." / "1、" / "（1）" / "1)" 等）
            directContent = directContent
              .replace(/^\s*[（(]?\s*\d+\s*[)）]?\s*[.、)]\s+/, "")
              .replace(/^\s*\d+\s*[.、)]\s+/, "");

            // 追加嵌套列表（如有），保留结构
            var nestedLists = Array.from(li.children || []).filter(
              function (el) {
                var t = el.tagName ? el.tagName.toLowerCase() : "";
                return t === "ul" || t === "ol";
              },
            );
            var nestedMd = nestedLists
              .map(function (nested) {
                return nodeToMarkdown(nested, listDepth + 1).trimEnd();
              })
              .filter(Boolean)
              .join("\n");

            return (
              oind +
              (i + 1) +
              ". " +
              (directContent || "") +
              (nestedMd ? "\n" + nestedMd : "")
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
      var txt = children().trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript"))
        return txt;
      return "[" + txt + "](" + href + ")";
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
      var hasHeader = rows[0].querySelectorAll("th").length > 0;
      if (hasHeader) {
        var cols = rows[0].querySelectorAll("th, td").length;
        var sep = "| " + Array(cols).fill("---").join(" | ") + " |";
        return (
          "\n" + [mdRows[0], sep].concat(mdRows.slice(1)).join("\n") + "\n\n"
        );
      }
      return "\n" + mdRows.join("\n") + "\n\n";
    }
    case "sup": {
      var supTxt = children().trim();
      if (!supTxt) return "";
      // DeepSeek 等平台把引用角标存为 "-数字" 格式（如 "-1"、"-5"），
      // 提取后相邻角标拼接成 "-1-5-9" 这样的负数串。
      // 统一处理：去掉前导 "-"，若为纯数字则格式化为 [N]，否则保留原文。
      var supCleaned = supTxt.replace(/^-+/, "").trim();
      if (!supCleaned) return "";
      if (/^\d+$/.test(supCleaned)) return "[" + supCleaned + "]";
      // 可能是多个角标连续拼接，如 "1-5-9" 或 "-1-5-9"
      var multiRef = supCleaned.split("-").filter(function (s) {
        return /^\d+$/.test(s.trim());
      });
      if (multiRef.length > 0) {
        return multiRef
          .map(function (n) {
            return "[" + n.trim() + "]";
          })
          .join("");
      }
      return supCleaned;
    }
    case "sub":
      return children().trim();
    case "script":
    case "style":
    case "noscript":
      return "";
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
              "header",
              "footer",
            ],
            ALLOWED_ATTR: ["href", "src", "alt", "class"],
          })
        : html;
    var md = nodeToMarkdown(div, 0).trim();
    md = md.replace(/\n{3,}/g, "\n\n");
    return md;
  } catch (e) {
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
    "yiyan",
    "doubao",
    "mistral",
    "metaso",
    "chatglm",
    "stepfun",
    "copilot",
  ];
  let conversations = []; // 所有对话
  let currentConversationId = null; // 当前活跃对话ID
  let latestConversationId = null; // 最新对话ID（用于刷新按钮判断）
  let currentLang = "zh-CN";
  let selectedFiles = [];
  let summarizeModel = "gemini";
  let customSummarizePrompt = "";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
  const POLLING_INTERVAL = 800;
  const STORAGE_VERSION = "2.1"; // Increment when data structure changes

  // --- 1. Polling & Memory Management ---
  const PollingManager = {
    activePolls: new Map(),
    start: (id, partners, fn) => {
      PollingManager.stop(id);
      const interval = setInterval(async () => {
        if (await fn()) PollingManager.stop(id);
      }, POLLING_INTERVAL);
      PollingManager.activePolls.set(id, interval);
    },
    stop: (id) => {
      if (PollingManager.activePolls.has(id)) {
        clearInterval(PollingManager.activePolls.get(id));
        PollingManager.activePolls.delete(id);
      }
    },
    stopAll: () => {
      PollingManager.activePolls.forEach(clearInterval);
      PollingManager.activePolls.clear();
    },
  };
  window.addEventListener("beforeunload", () => PollingManager.stopAll());

  // === DOM Elements ===
  const conversationStream = document.getElementById("conversationStream");
  const emptyState = document.getElementById("emptyState");
  const promptInput = document.getElementById("prompt");
  const sendBtn = document.getElementById("sendBtn");
  const fileInput = document.getElementById("fileInput");
  const attachFileBtn = document.getElementById("attachFileBtn");
  const launchOnlyBtn = document.getElementById("launchOnlyBtn");
  const tileBtn = document.getElementById("tileBtn");
  const closeBtn = document.getElementById("closeBtn");
  const filePreview = document.getElementById("filePreview");
  const summarizeBtn = document.getElementById("summarizeBtn");
  const copyAllBtn = document.getElementById("copyAllBtn");

  const filePreviewList = document.getElementById("filePreviewList");
  const clearFilesBtn = document.getElementById("clearFilesBtn");
  const openModelsBtn = document.getElementById("openModelsBtn");
  const modelsModal = document.getElementById("modelsModal");
  const closeModelsBtn = document.getElementById("closeModelsBtn");
  const confirmModelsBtn = document.getElementById("confirmModelsBtn");
  const toggleAllBtn = document.getElementById("toggleAllBtn");
  const modelToggleAllBtn = document.getElementById("modelToggleAllBtn");
  const selectionBadge = document.getElementById("selectionBadge");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const langToggleBtn = document.getElementById("langToggleBtn");

  // === Initialization ===
  loadLanguage();
  loadSelectedProviders();
  loadSummarizeSettings();
  let isProcessingMessage = false; // Deduplication flag
  await loadConversationsFromStorage();

  // 绑定事件委托（仅执行一次）
  bindConversationEvents();

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
      startTime: id,
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
        status: AI_STATUS.LOADING,
        text: "",
        html: "",
        timestamp: null,
        startTime: id,
        endTime: null,
        durationMs: null,
      };
    });

    conversations.push(conversation);
    currentConversationId = id;
    latestConversationId = id; // 新创建的对话就是最新的

    return id;
  }

  /**
   * 保存所有对话到存储
   */
  async function saveAllToStorage() {
    try {
      await chrome.storage.local.set({
        conversations_v2: conversations,
        storage_version: STORAGE_VERSION,
      });
      console.log("[Storage] Saved all conversations");
    } catch (e) {
      console.error("[Storage] Save all error:", e);
    }
  }

  // 防抖保存，避免过音频繁写磁盘
  let saveTimer = null;
  function requestAutoSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveAllToStorage();
      saveTimer = null;
    }, 2000); // 增加到2秒，减少生成期间的CPU压力
  }

  function updateConversationResponse(convId, provider, data) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return false;

    const currentResp = conv.responses[provider];
    if (!currentResp) return false;

    const newStatus = data.status || AI_STATUS.OK;
    const newText = data.text || "";
    const newHtml = data.html || "";

    const shouldFinalizeDuration =
      newStatus === AI_STATUS.OK &&
      currentResp.durationMs == null &&
      currentResp.startTime != null;

    // --- Valid Transitions Logic ---
    const terminalStates = [
      AI_STATUS.OK,
      AI_STATUS.ERROR,
      AI_STATUS.NOT_OPEN,
      AI_STATUS.TIMEOUT,
    ];

    let wasUpdated = false;

    // 1. If moving to terminal state, only overwrite text if we actually have new content
    // This prevents overwriting buffered content with an empty string if the final poll catches an empty DOM
    if (terminalStates.includes(newStatus)) {
      currentResp.status = newStatus;
      if (newText.length > 0) {
        currentResp.text = newText;
        currentResp.html = newHtml;
      }
      currentResp.timestamp = Date.now();

      if (shouldFinalizeDuration) {
        currentResp.endTime = currentResp.timestamp;
        currentResp.durationMs = Math.max(
          0,
          currentResp.endTime - currentResp.startTime,
        );
      }
      wasUpdated = true;
    }
    // 2. If already in a terminal state, only update if content grew
    else if (terminalStates.includes(currentResp.status)) {
      if (newText.length > currentResp.text.length) {
        currentResp.text = newText;
        currentResp.html = newHtml;
        currentResp.timestamp = Date.now();

        if (shouldFinalizeDuration) {
          currentResp.endTime = currentResp.timestamp;
          currentResp.durationMs = Math.max(
            0,
            currentResp.endTime - currentResp.startTime,
          );
        }
        wasUpdated = true;
      }
    } else if (
      currentResp.status === AI_STATUS.LOADING ||
      currentResp.status === AI_STATUS.SENDING
    ) {
      currentResp.status = newStatus;
      currentResp.text = newText;
      currentResp.html = newHtml;
      currentResp.timestamp = Date.now();

      if (shouldFinalizeDuration) {
        currentResp.endTime = currentResp.timestamp;
        currentResp.durationMs = Math.max(
          0,
          currentResp.endTime - currentResp.startTime,
        );
      }
      wasUpdated = true;
    } else if (currentResp.status === AI_STATUS.GENERATING) {
      // 正常情况：新内容比当前内容长或相等，直接更新
      if (newText.length >= currentResp.text.length) {
        currentResp.status = newStatus;
        currentResp.text = newText;
        currentResp.html = newHtml;
        currentResp.timestamp = Date.now();

        if (shouldFinalizeDuration) {
          currentResp.endTime = currentResp.timestamp;
          currentResp.durationMs = Math.max(
            0,
            currentResp.endTime - currentResp.startTime,
          );
        }
        wasUpdated = true;
      } else {
        // 修复Bug：若对话刚创建（15秒内），允许文本长度回退。
        // 场景：千问新回复容器刚出现时内容较短（甚至为空），
        // 但因为之前误选了上一条旧回复（文本更长），导致短内容被拒绝更新。
        // 在新对话创建后的短时间窗口内放开限制，让正确的新内容能覆盖旧内容。
        const timeSinceConvCreated = Date.now() - (conv.timestamp || 0);
        if (timeSinceConvCreated < 15000) {
          currentResp.status = newStatus;
          currentResp.text = newText;
          currentResp.html = newHtml;
          currentResp.timestamp = Date.now();

          if (shouldFinalizeDuration) {
            currentResp.endTime = currentResp.timestamp;
            currentResp.durationMs = Math.max(
              0,
              currentResp.endTime - currentResp.startTime,
            );
          }
          wasUpdated = true;
        }
      }
    }

    if (wasUpdated) {
      requestAutoSave();

      // Ensure scroll stays anchored near the conversation
      if (conv.id === currentConversationId && !conv.collapsed) {
        const convEl = document.querySelector(`[data-id="${conv.id}"]`);
        if (convEl && isNearBottom()) {
          setTimeout(() => {
            const headerEl = convEl.querySelector(".conversation-header");
            if (headerEl)
              headerEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
        }
      }
    }
    return wasUpdated;
  }

  function isNearBottom() {
    return (
      conversationStream.scrollTop + conversationStream.clientHeight >=
      conversationStream.scrollHeight - 150
    );
  }

  /**
   * 检查所有响应是否完成
   */
  function checkAllResponsesComplete(convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv || conv.archived) return false;

    const allComplete = conv.providers.every((p) => {
      const resp = conv.responses[p];
      const terminalStates = [
        AI_STATUS.OK,
        AI_STATUS.ERROR,
        AI_STATUS.NOT_OPEN,
        AI_STATUS.TIMEOUT,
      ];
      return resp && terminalStates.includes(resp.status);
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
    await saveAllToStorage();
    console.log(`[Archive] Conversation ${convId} archived`);
  }

  /**
   * 从存储加载对话
   */
  async function loadConversationsFromStorage() {
    try {
      const data = await chrome.storage.local.get([
        "conversations_v2",
        "storage_version",
      ]);
      let loadedConv = data.conversations_v2 || [];

      // --- Storage Version Migration ---
      if (data.storage_version !== STORAGE_VERSION) {
        console.log(
          `[Storage] Migrating from ${data.storage_version || "2.0"} to ${STORAGE_VERSION}`,
        );
        loadedConv = await migrateData(loadedConv, data.storage_version);
        chrome.storage.local.set({
          conversations_v2: loadedConv,
          storage_version: STORAGE_VERSION,
        });
      }

      conversations = loadedConv;

      if (conversations.length > 0) {
        conversations.sort((a, b) => a.timestamp - b.timestamp);
        conversations.forEach((c) => (c.collapsed = true));
        currentConversationId = conversations[conversations.length - 1].id;
        latestConversationId = conversations[conversations.length - 1].id; // 最新对话ID

        renderConversations();
        setTimeout(() => {
          conversationStream.scrollTop = conversationStream.scrollHeight;
        }, 50);
      } else {
        renderConversations();
      }
    } catch (e) {
      console.error("[Storage] Load error:", e);
      conversations = [];
    }
  }

  /**
   * Data Migration Logic
   */
  async function migrateData(oldData, oldVersion) {
    if (!oldVersion || oldVersion === "2.0") {
      return oldData.map((conv) => {
        const migratedResponses = {};
        if (conv.responses) {
          Object.entries(conv.responses).forEach(([p, r]) => {
            migratedResponses[p] = {
              ...r,
              status: r.status || AI_STATUS.OK,
              timestamp: r.timestamp || conv.timestamp,
            };
          });
        }
        return { ...conv, responses: migratedResponses };
      });
    }
    return oldData;
  }

  // Save on panel close (best effort)
  window.addEventListener("pagehide", () => saveAllToStorage());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveAllToStorage();
  });

  /**
   * 渲染所有对话
   */
  function renderConversations() {
    if (conversations.length === 0) {
      emptyState.style.display = "flex";
      updateActionButtons();
      return;
    }

    emptyState.style.display = "none";
    conversationStream.innerHTML = "";

    conversations.forEach((conv) => {
      const div = createConversationElement(conv);
      conversationStream.appendChild(div);
    });

    // 更新操作按钮状态
    updateActionButtons();

    // 更新全部展开/折叠按钮的标题
    const toggleAllBtn = document.getElementById("toggleAllBtn");
    if (toggleAllBtn) {
      // 移除tooltip提示
    }
  }

  /**
   * 绑定对话事件（使用事件委托，避免CSP问题）
   */
  function bindConversationEvents() {
    // Handle all clicks within the conversation stream using delegation
    conversationStream.addEventListener("click", (e) => {
      const target = e.target;

      // 1. Response Card click (except buttons inside)
      const card = target.closest(".response-card");
      // Only treat our UI control buttons (with data-action) as "buttons" here.
      // Response content may include generic <button> (e.g., code copy button) and
      // should NOT block card click / question toggle.
      // Note: .card-detail-btn should NOT be blocked as it's for historical conversations
      const button = target.closest(
        "button[data-action]:not(.card-detail-btn), .control-btn[data-action], .card-refresh-btn",
      );

      // 0. Collapsed conversation header click
      const collapsedHeader = target.closest(".conversation-header");
      if (collapsedHeader && !button) {
        // Skip toggle if the user is selecting/has selected text
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          return;
        }
        const convId = parseInt(
          collapsedHeader.dataset.convId ||
            collapsedHeader.closest(".conversation-item")?.dataset.id,
        );
        if (convId) window.toggleConversation(convId);
        return;
      }

      // 0a. Delete conversation button
      const deleteConvBtn = target.closest(".delete-conv-btn");
      if (deleteConvBtn) {
        e.stopPropagation();
        const convId = parseInt(
          deleteConvBtn.dataset.convId ||
            deleteConvBtn.closest(".conversation-item")?.dataset.id,
        );
        if (convId) window.deleteConversation(convId);
        return;
      }

      // 0b. Copy-all-responses button in collapsed header — must stop propagation
      //    BEFORE the clickable-header handler fires and expands the conversation
      const copyAllRespBtn = target.closest(".copy-all-responses-btn");
      if (copyAllRespBtn) {
        e.stopPropagation();
        const convId = parseInt(
          copyAllRespBtn.dataset.convId ||
            copyAllRespBtn.closest(".conversation-item")?.dataset.id,
        );
        if (convId) {
          window.copyAllResponses(convId);
          const origInner = copyAllRespBtn.innerHTML;
          copyAllRespBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          copyAllRespBtn.style.color = "var(--success, #2ea043)";
          copyAllRespBtn.style.borderColor = "var(--success, #2ea043)";
          setTimeout(() => {
            copyAllRespBtn.innerHTML = origInner;
            copyAllRespBtn.style.color = "";
            copyAllRespBtn.style.borderColor = "";
          }, 1500);
        }
        return;
      }

      if (card && !button) {
        const provider = card.dataset.provider;
        const convId = parseInt(card.dataset.convId);
        if (provider && convId) {
          window.showResponseDetail(provider, convId);
        }
        return;
      }

      // 1b. Question copy button (hover copy)
      const questionCopyBtn = target.closest(".question-copy-btn");
      if (questionCopyBtn) {
        e.stopPropagation();
        const question = questionCopyBtn.dataset.question || "";
        navigator.clipboard
          .writeText(question)
          .then(() => {
            const orig = questionCopyBtn.innerHTML;
            questionCopyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            questionCopyBtn.style.opacity = "1";
            questionCopyBtn.style.color = "var(--success, #2ea043)";
            setTimeout(() => {
              questionCopyBtn.innerHTML = orig;
              questionCopyBtn.style.color = "";
              questionCopyBtn.style.opacity = "";
            }, 1500);
          })
          .catch(() => {});
        return;
      }

      // 2. Refresh/Detail/Summary buttons
      if (button) {
        e.stopPropagation();
        const action = button.dataset.action;
        const provider = button.dataset.provider;
        const convId = parseInt(
          button.dataset.convId ||
            button.closest(".conversation-controls")?.dataset.convId ||
            button.closest(".response-card")?.dataset.convId ||
            button.closest(".summary-card")?.dataset.convId,
        );

        if (!convId) return;

        if (action === "refresh") {
          window.manualRefreshProvider(provider, convId);
        } else if (action === "detail") {
          window.showResponseDetail(provider, convId);
        } else if (action === "collapse") {
          window.toggleConversation(convId);
        } else if (action === "tile") {
          window.tileCards(convId);
        } else if (action === "jump-summary") {
          const convEl = button.closest(".conversation-item");
          const summaryCard = convEl.querySelector(".summary-card");
          if (summaryCard) {
            summaryCard.scrollIntoView({ behavior: "smooth", block: "center" });
            summaryCard.style.outline = "2px solid var(--primary-color)";
            setTimeout(() => {
              summaryCard.style.outline = "none";
            }, 1000);
          }
        }
        return;
      }

      // 3. Summary Card click
      const summaryCard = target.closest(".summary-card");
      if (summaryCard) {
        // If text is being selected, don't trigger
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;

        const convId = parseInt(summaryCard.dataset.convId);
        if (convId) window.showSummaryDetail(convId);
        return;
      }

      // 4. Question area (expanded state) only - removed clickable header support
      const clickableArea = target.closest(".conversation-question");
      if (clickableArea && !button && !questionCopyBtn) {
        // Skip toggle if the user is selecting/has selected text
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          return;
        }
        const convId = parseInt(
          clickableArea.dataset.convId ||
            clickableArea.closest(".conversation-item")?.dataset.id,
        );
        if (convId) window.toggleConversation(convId);
        return;
      }
    });
  }

  /**
   * 更新操作按钮状态
   */
  function updateActionButtons() {
    if (!currentConversationId) {
      if (summarizeBtn) summarizeBtn.style.display = "none";
      if (copyAllBtn) copyAllBtn.style.display = "none";
      return;
    }

    const currentConv = conversations.find(
      (c) => c.id === currentConversationId,
    );
    if (!currentConv) {
      if (summarizeBtn) summarizeBtn.style.display = "none";
      if (copyAllBtn) copyAllBtn.style.display = "none";
      return;
    }

    // 显示按钮
    if (summarizeBtn) summarizeBtn.style.display = "flex";
    if (copyAllBtn) copyAllBtn.style.display = "flex";

    // 智能总结按钮：已存档且多模型即可启用，支持重复总结；仅在总结生成中时禁用
    if (summarizeBtn) {
      const onlyOneProvider =
        !currentConv.providers || currentConv.providers.length <= 1;
      const isSummarizing =
        currentConv.summary && currentConv.summary.status === "loading";
      summarizeBtn.disabled =
        onlyOneProvider || !currentConv.archived || isSummarizing;
      // 已有总结时高亮显示"重新总结"状态
      summarizeBtn.classList.toggle(
        "has-summary",
        !!currentConv.summary && !isSummarizing,
      );
      if (onlyOneProvider) {
        summarizeBtn.title = "至少需要选择两个模型才能进行智能总结";
      } else if (!currentConv.archived) {
        summarizeBtn.title = "等待所有模型回复完成后才能总结";
      } else if (isSummarizing) {
        summarizeBtn.title = "总结生成中，请稍候...";
      } else if (currentConv.summary) {
        summarizeBtn.title = "重新总结（可换模型或自定义提示词后再次生成）";
      } else {
        summarizeBtn.title = "智能总结所有回复";
      }
    }

    // 底部全局复制按钮隐藏（每条对话已有独立复制按钮）
    if (copyAllBtn) {
      copyAllBtn.style.display = "none";
    }
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
                <div class="conversation-header" data-conv-id="${conv.id}">
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
                        ${conv.summary ? '<span class="summary-badge">✨ 已总结</span>' : ""}
                        ${conv.archived ? '<span class="archived-badge">📦</span>' : ""}
                        <button class="control-btn copy-all-responses-btn" data-action="copy-all" data-conv-id="${conv.id}" title="复制全部响应" style="margin-left:4px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                        <button class="control-btn delete-conv-btn" data-conv-id="${conv.id}" title="删除此对话" style="margin-left:2px; color: var(--error, #da3633);">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                <path d="M10 11v6M14 11v6"></path>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
    } else {
      // 展开状态
      const questionDiv = document.createElement("div");
      questionDiv.className = "conversation-question";
      questionDiv.innerHTML = `
                <div class="conversation-question-content">
                    <span class="question-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </span>
                    <span class="question-text">${escapeHTML(conv.question)}</span>
                    <button class="question-copy-btn" data-question="${escapeHTML(conv.question)}" title="复制问题">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
                <div class="conversation-controls" data-conv-id="${conv.id}">
                    <button class="control-btn control-collapse" data-action="collapse" title="折叠">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="18 15 12 9 6 15"></polyline>
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
                    ${
                      conv.summary
                        ? `
                    <button class="control-btn control-jump-summary" data-action="jump-summary" title="直达智能总结">
                        ✨
                    </button>
                    `
                        : ""
                    }
                    <button class="control-btn copy-all-responses-btn" data-action="copy-all" data-conv-id="${conv.id}" title="复制全部响应">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button class="control-btn delete-conv-btn" data-conv-id="${conv.id}" title="删除此对话" style="color: var(--error, #da3633);">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6M14 11v6"></path>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                        </svg>
                    </button>
                </div>
            `;

      const responsesDiv = document.createElement("div");
      responsesDiv.className = "conversation-responses";
      responsesDiv.id = `responses-${conv.id}`;
      responsesDiv.innerHTML = renderResponseCards(conv);

      div.appendChild(questionDiv);
      div.appendChild(responsesDiv);

      // 添加总结卡片
      if (conv.summary) {
        const summaryDiv = createSummaryCard(conv.summary, conv.id);
        div.appendChild(summaryDiv);
      }
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

      const durationMsResolved =
        response && response.durationMs != null
          ? response.durationMs
          : response && response.startTime != null
            ? Math.max(
                0,
                (response.endTime || response.timestamp || Date.now()) -
                  response.startTime,
              )
            : null;
      const durationSec =
        durationMsResolved != null
          ? Math.max(0, Math.round(durationMsResolved / 1000))
          : null;

    // Show refresh button only for latest conversation
    const isLatestConversation = conv.id === latestConversationId;
    const showRefresh = isLatestConversation; // Always show refresh for latest conversation
    const actionBtn = showRefresh
      ? `
              <button class="card-refresh-btn" data-action="refresh" data-provider="${provider}" data-conv-id="${conv.id}" title="手动刷新获取最新回复">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
              </button>`
      : `
              <button class="card-detail-btn" data-action="detail" data-provider="${provider}" data-conv-id="${conv.id}" title="查看详情">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                  </svg>
              </button>`;

    html += `
              <div class="response-card ${response.status}" data-provider="${provider}" data-conv-id="${conv.id}" style="cursor: pointer;">
                  <div class="response-card-header">
                      <div class="response-card-info">
                          <img src="${config.icon.replace('icons/', 'assets/icons/')}" class="provider-icon-img" alt="${config.name}">
                          <span>${config.name}</span>
                          ${getStatusBadge(response.status)}
                      </div>
                      <div class="response-card-actions">
                          ${response.status === "ok" && response.text ? `<div class="response-char-count">${response.text.length} 字</div>` : ""}
                          ${response.startTime != null && durationSec != null ? `<div class="response-time-count">${durationSec} 秒</div>` : ""}
                          ${actionBtn}
                      </div>
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
   * 手动刷新单个 provider 的响应
   * 支持内容验证和防误刷新逻辑
   */
  window.manualRefreshProvider = async function (provider, convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    // 禁用刷新按钮，防止重复点击，并给出加载反馈
    const btn = document.querySelector(
      `.response-card[data-provider="${provider}"][data-conv-id="${convId}"] .card-refresh-btn`,
    );
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
    }

    try {
      // 保存当前内容用于对比
      const currentResponse = conv.responses[provider];
      const currentText = currentResponse?.text || "";
      const currentHtml = currentResponse?.html || "";

      // 尝试从 AI 页面获取最新内容
      const result = await chrome.runtime.sendMessage({
        action: "fetch_all_responses",
        providers: [provider],
      });

      let newText = "";
      let newHtml = "";

      if (result && result.status === "ok" && result.responses) {
        const response = result.responses[provider];
        newText = response?.text || "";
        newHtml = response?.html || "";
      }

      // Gemini 特殊处理：如果获取的内容为空，尝试强制重新检测
      if (provider === 'gemini' && (!newText || newText.trim().length === 0)) {
        console.log(`[AI Multiverse] ${provider}: 手动刷新获取内容为空，尝试强制重新检测`);
        
        // 发送特殊的强制检测消息
        const forceResult = await chrome.runtime.sendMessage({
          action: "force_gemini_redetect",
        });
        
        if (forceResult && forceResult.status === "ok" && forceResult.response) {
          newText = forceResult.response.text || "";
          newHtml = forceResult.response.html || "";
          console.log(`[AI Multiverse] ${provider}: 强制重新检测成功，获取到内容长度: ${newText.length}`);
        }
      }

      // 直接更新内容，不做任何验证
      if (newText && newText.trim().length > 0) {
        console.log(`[AI Multiverse] ${provider}: 手动刷新直接更新内容，长度: ${newText.length}`);
        
        // 更新响应数据
        const currentResponse = conv.responses[provider];
        currentResponse.text = newText;
        currentResponse.html = newHtml;
        currentResponse.status = "ok";
        currentResponse.timestamp = Date.now();

        // 更新UI
        updateConversationUI(convId);
        
        // 显示温馨提示
        showNotification(`${provider}: 已加载最新内容，请确保模型窗口中的对话与当前问题匹配`, "info");
      } else {
        showNotification(`${provider}: 未获取到内容，请确保模型窗口已打开并显示回答`, "error");
      }

      // 恢复按钮状态
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      }

    } catch (error) {
      console.error(`[AI Multiverse] ${provider}: 手动刷新失败`, error);
      showNotification(`${provider}: 刷新失败 - ${error.message}`, "error");
    } finally {
      // 恢复按钮状态
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
      }
    }
  };

  /**
   * 显示通知信息
   */
  function showNotification(message, type = "info") {
    // 创建通知元素
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 16px",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "10000",
      maxWidth: "300px",
      wordWrap: "break-word",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      transition: "all 0.3s ease"
    });
    
    // 设置颜色
    switch (type) {
      case "success":
        notification.style.backgroundColor = "#10b981";
        notification.style.color = "white";
        break;
      case "warning":
        notification.style.backgroundColor = "#f59e0b";
        notification.style.color = "white";
        break;
      case "error":
        notification.style.backgroundColor = "#ef4444";
        notification.style.color = "white";
        break;
      default:
        notification.style.backgroundColor = "#3b82f6";
        notification.style.color = "white";
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * 将响应内容统一转换为 Markdown 再渲染，无论来源平台格式如何都保持一致
   */
  function normalizeAndRender(response) {
    var markdown = "";
    if (response.html && response.html.trim()) {
      markdown = htmlToMarkdown(response.html);
    } else if (response.text && response.text.trim()) {
      markdown = response.text;
    }
    // ── 修复：trim() 后再渲染，防止 Gemini 等平台响应文本开头的大量空白行
    // 在 marked.js 中，开头的空行会被渲染成空 <p></p> 或 <br> 标签，
    // 导致内容框顶部出现大片空白。
    markdown = markdown.trim();
    if (!markdown) return '<span class="loading-text">等待响应...</span>';
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
    } else if (response.status === "ok" || response.status === "generating") {
      var content = normalizeAndRender(response);
      if (response.status === "generating") {
        content += '<span class="blinking-cursor"></span>';
      }
      return content;
    } else if (response.status === "error") {
      return `<div class="error-content"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>${escapeHTML(response.error || "未知错误")}</span></div>`;
    } else if (response.status === "not_open") {
      return '<span class="not-open-text">网页未打开</span>';
    }
    return "";
  }

  /**
   * 获取状态徽章
   */
  function getStatusBadge(status) {
    if (status === "loading") {
      return '<span class="status-badge loading">⏳ 加载中</span>';
    } else if (status === "generating") {
      return '<span class="status-badge generating" style="color: var(--primary-color);">🔄 生成中...</span>';
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
   * 创建总结卡片 - 支持实时流式、HTML格式、文字选择
   * 修改：点击整个卡片查看详情，移除冗余详情按钮
   */
  function createSummaryCard(summary, convId) {
    const div = document.createElement("div");
    div.className = "summary-card";
    div.dataset.convId = convId;
    // The click event is now handled by delegation in bindConversationEvents

    const isGenerating =
      summary.status === "generating" || summary.status === "loading";
    const modelName = AI_CONFIG[summary.model]?.name || summary.model;

    // 与 normalizeAndRender 保持一致：先转 markdown 再 trim() 再渲染，
    // 避免直接使用 summary.html 时开头的空白节点/空行在重新打开后渲染成大片空白。
    let bodyContent = "";
    if (!isGenerating) {
      let markdown = "";
      if (summary.html && summary.html.trim()) {
        try {
          markdown = htmlToMarkdown(summary.html);
        } catch (e) {
          markdown = summary.text || "";
        }
      } else if (summary.text && summary.text.trim()) {
        markdown = summary.text;
      }
      markdown = markdown.trim();
      if (markdown) {
        bodyContent = renderMarkdown(markdown);
      }
    }

    div.innerHTML = `
            <div class="summary-header">
                <div class="summary-header-left">
                    <span class="summary-title">✨ 智能总结</span>
                    <span class="summary-model">由 ${modelName} 生成</span>
                    ${isGenerating ? '<span class="status-badge generating" style="font-size:11px;">&#x1F504; 生成中...</span>' : ""}
                </div>
            </div>
            <div class="summary-body markdown-content" style="
                user-select: text !important; 
                -webkit-user-select: text !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                max-height: 400px !important;
                padding-right: 8px !important;
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow-wrap: break-word;
            ">
                ${bodyContent || '<span style="color: var(--text-secondary); font-style: italic;">正在生成总结...</span>'}
            </div>
        `;
    return div;
  }

  /**
   * 在模态框中查看总结详情
   */
  window.showSummaryDetail = function (convId) {
    const numericId = typeof convId === "string" ? parseInt(convId) : convId;
    const conv = conversations.find((c) => c.id === numericId);
    if (!conv || !conv.summary) return;

    const summary = conv.summary;
    const detailModal = document.getElementById("detailModal");
    const detailIcon = document.getElementById("detailIcon");
    const detailName = document.getElementById("detailName");
    const detailText = document.getElementById("detailText");
    const positionText = document.getElementById("positionText");
    const positionDots = document.getElementById("positionDots");

    const modelConfig = AI_CONFIG[summary.model];
    if (modelConfig) {
      detailIcon.src = chrome.runtime.getURL(modelConfig.icon);
      detailName.textContent = `✨ 智能总结 - ${modelConfig.name}`;
    } else {
      detailIcon.src = "";
      detailName.textContent = `✨ 智能总结`;
    }

    detailText.innerHTML = normalizeAndRender(summary);

    // 记录 context 以便复制按钮使用（provider 设为 null 表示这是总结弹窗）
    currentDetailContext = {
      provider: null,
      convId: numericId,
      availableProviders: [],
      isSummary: true,
    };

    // Hide position indicator for summary (single item)
    if (positionText) positionText.textContent = "";
    if (positionDots) positionDots.innerHTML = "";
    document.getElementById("modalPositionIndicator")?.classList.add("hidden");

    // 自适应宽度：确保模态框不会超出主窗口宽度
    const detailContent = detailModal.querySelector('.detail-content');
    if (detailContent) {
      const windowWidth = window.innerWidth;
      const modalMaxWidth = 1400; // CSS 中的最大宽度
      const modalWidthPercent = 94; // CSS 中的宽度百分比
      
      // 计算合适的宽度
      let suitableWidth;
      if (windowWidth < 400) {
        // 很小的窗口
        suitableWidth = '95%';
      } else if (windowWidth < 600) {
        // 小窗口
        suitableWidth = '92%';
      } else if (windowWidth < 800) {
        // 中等窗口
        suitableWidth = '90%';
      } else {
        // 大窗口，使用原来的设置
        suitableWidth = modalWidthPercent + '%';
      }
      
      // 应用宽度，但不超过最大宽度
      detailContent.style.width = suitableWidth;
      detailContent.style.maxWidth = modalMaxWidth + 'px';
      
      console.log(`[Modal Summary] Window width: ${windowWidth}px, Modal width: ${suitableWidth}`);
    }

    detailModal.classList.add("active");
  };

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

      // 处理链接：让所有链接在新窗口中打开
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const links = tempDiv.querySelectorAll("a[href]");
      links.forEach((link) => {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      });

      const toCircledNumber = (n) => {
        const map = {
          0: "⓪",
          1: "①",
          2: "②",
          3: "③",
          4: "④",
          5: "⑤",
          6: "⑥",
          7: "⑦",
          8: "⑧",
          9: "⑨",
          10: "⑩",
          11: "⑪",
          12: "⑫",
          13: "⑬",
          14: "⑭",
          15: "⑮",
          16: "⑯",
          17: "⑰",
          18: "⑱",
          19: "⑲",
          20: "⑳",
        };
        return map[n] || `(${n})`;
      };

      const maybeBeautifyCitationLink = (link) => {
        const raw = (link.textContent || "").trim();
        if (!raw) return;

        if (!/^[-−]?\d+(?:\s*[-‑–—]\s*\d+)*$/.test(raw)) return;
        if (link.querySelector("img, svg")) return;

        const nums = raw.match(/\d+/g) || [];
        if (nums.length < 1) return;

        const normalized = nums
          .map((s) => parseInt(s, 10))
          .filter((n) => Number.isFinite(n));
        if (normalized.length < 1) return;

        link.classList.add("ds-citation-link");
        link.dataset.rawCitation = raw;
        link.textContent = normalized.map((n) => toCircledNumber(n)).join("");
      };

      links.forEach((link) => {
        try {
          maybeBeautifyCitationLink(link);
        } catch (e) {}
      });

      // 应用语法高亮到代码块
      if (typeof hljs !== "undefined") {
        const codeBlocks = tempDiv.querySelectorAll("pre code");
        codeBlocks.forEach((block) => {
          const pre = block.parentElement;

          // 获取语言类名（如果有的话）
          const languageClass = Array.from(
            pre.classList || block.classList,
          ).find((cls) => cls.startsWith("language-"));
          const language = languageClass
            ? languageClass.replace("language-", "")
            : "plaintext";

          // 应用语法高亮
          hljs.highlightElement(block, { language: language });

          // 设置代码块为相对定位，以便放置按钮和语言标签
          pre.style.position = "relative";

          // 添加语言标签在代码块内部
          if (language && language !== "plaintext") {
            const langTag = document.createElement("div");
            langTag.className = "code-lang-tag";
            langTag.textContent = language;
            langTag.style.cssText = `
              position: absolute;
              top: 4px;
              left: 8px;
              background: var(--accent);
              color: white;
              font-size: 9px;
              padding: 1px 4px;
              border-radius: 2px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              z-index: 5;
            `;
            pre.appendChild(langTag);
          }

          // 添加复制按钮
          const copyBtn = document.createElement("button");
          copyBtn.className = "code-copy-btn";
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          copyBtn.setAttribute("aria-label", "Copy code");
          copyBtn.setAttribute("title", "Copy code");

          // 添加复制功能
          copyBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
              const codeText = block.textContent || block.innerText;
              await navigator.clipboard.writeText(codeText);

              // 显示复制成功状态
              const originalHTML = copyBtn.innerHTML;
              copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
              copyBtn.style.color = "var(--success, #2ea043)";

              setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = "";
              }, 1500);
            } catch (err) {
              console.error("Failed to copy code:", err);
            }
          });

          // 将按钮添加到代码块容器
          pre.appendChild(copyBtn);
        });
      }

      html = tempDiv.innerHTML;

      return html;
    } catch (e) {
      return escapeHTML(text);
    }
  }

  /**
   * 发送消息
   */
  async function handleSendMessage() {
    if (isProcessingMessage) return;
    const question = promptInput.value.trim();
    if (!question) return;

    const providers = getSelectedProviders();
    if (providers.length === 0) {
      alert(t("select_at_least_one"));
      return;
    }

    isProcessingMessage = true;
    sendBtn.disabled = true;
    sendBtn.classList.add("loading");

    // 折叠之前的对话并中断还在生成的对话
    if (currentConversationId) {
      // 遍历所有对话，如果有还没存档的，强制存档以中断未完成的轮询
      conversations.forEach((c) => {
        c.collapsed = true;
        if (!c.archived) {
          // 对于没完成的提供商，设置一个被中断的状态
          c.providers.forEach((p) => {
            if (
              c.responses[p] &&
              (c.responses[p].status === "loading" ||
                c.responses[p].status === "generating")
            ) {
              c.responses[p].status = "error";
              c.responses[p].error = "已被新对话中断";
            }
          });
          c.archived = true;
        }
      });
    }

    // 创建新对话
    const convId = createConversation(question, providers, [...selectedFiles]);
    await saveAllToStorage();

    // 清空输入
    promptInput.value = "";
    promptInput.style.height = "auto";
    selectedFiles = [];
    filePreview.style.display = "none";

    // 渲染并自动滚动到最底部
    renderConversations();
    setTimeout(() => {
      conversationStream.scrollTop = conversationStream.scrollHeight;
    }, 50);

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
    } finally {
      isProcessingMessage = false;
      sendBtn.disabled = false;
      sendBtn.classList.remove("loading");
    }
  }

  /**
   * 开始轮询响应
   */
  function startPollingResponses(convId, providers) {
    PollingManager.start(convId, providers, async () => {
      const conv = conversations.find((c) => c.id === convId);
      if (!conv || conv.archived) return true; // Terminate polling

      const terminalStates = [
        AI_STATUS.OK,
        AI_STATUS.ERROR,
        AI_STATUS.NOT_OPEN,
        AI_STATUS.TIMEOUT,
      ];
      const activeProviders = providers.filter(
        (p) => !terminalStates.includes(conv.responses[p].status),
      );

      if (activeProviders.length === 0) {
        archiveConversation(convId);
        return true; // Terminate polling
      }

      try {
        if (!startPollingResponses._inflight) {
          startPollingResponses._inflight = new Map();
        }
        const inflight = startPollingResponses._inflight;
        if (!inflight.has(convId)) inflight.set(convId, new Set());
        const inFlightSet = inflight.get(convId);

        const tasks = activeProviders
          .filter((p) => !inFlightSet.has(p))
          .map(async (provider) => {
            inFlightSet.add(provider);
            try {
              const result = await chrome.runtime.sendMessage({
                action: "fetch_response",
                provider: provider,
              });
              if (result && result.status === "ok" && result.response) {
                updateConversationResponse(convId, provider, result.response);
                updateConversationUI(convId);
              }
            } catch (e) {
            } finally {
              inFlightSet.delete(provider);
            }
          });

        await Promise.allSettled(tasks);
      } catch (e) {
        console.error(`[Poll] Error:`, e);
        // On critical message error, we might want to mark others as error or retry
      }

      const isAllDone = checkAllResponsesComplete(convId);
      updateConversationUI(convId);
      return isAllDone;
    });
  }

  /**
   * 初始化悬浮直达按钮逻辑
   */
  function initFloatJumpButton() {
    const floatBtn = document.getElementById("floatJumpSummary");
    if (!floatBtn) return;

    // 确保初始状态为隐藏
    floatBtn.style.display = "none";
    floatBtn.style.opacity = "0";

    // 按钮点击处理
    floatBtn.onclick = () => {
      const convEl = document.querySelector(
        `.conversation-item[data-id="${currentConversationId}"]`,
      );
      if (convEl) {
        const summaryCard = convEl.querySelector(".summary-card");
        if (summaryCard) {
          summaryCard.scrollIntoView({ behavior: "smooth", block: "center" });
          // 触觉/视觉反馈
          summaryCard.style.outline = "2px solid var(--primary-color)";
          setTimeout(() => {
            summaryCard.style.outline = "none";
          }, 1000);
        }
      }
    };

    // 统一的可见性更新函数（滚动时和状态变化时都调用）
    function updateFloatBtnVisibility() {
      if (!currentConversationId) {
        floatBtn.style.display = "none";
        return;
      }

      const conv = conversations.find((c) => c.id === currentConversationId);
      const convEl = document.querySelector(
        `.conversation-item[data-id="${currentConversationId}"]`,
      );

      if (!conv || !conv.summary || conv.collapsed || !convEl) {
        floatBtn.style.display = "none";
        return;
      }

      const summaryCard = convEl.querySelector(".summary-card");
      if (!summaryCard) {
        floatBtn.style.display = "none";
        return;
      }

      // 检查总结卡片是否在视野内
      const rect = summaryCard.getBoundingClientRect();
      const containerRect = conversationStream.getBoundingClientRect();

      // 如果卡片顶部在容器底部下方，说明还没滑到总结，显示按钮
      const isSummaryBelow = rect.top > containerRect.bottom - 50;
      // 如果卡片底部在容器顶部上方，说明已经滑过了总结，隐藏按钮
      const isSummaryAbove = rect.bottom < containerRect.top + 50;

      if (isSummaryBelow && !isSummaryAbove) {
        floatBtn.style.display = "flex";
        floatBtn.style.opacity = "1";
        floatBtn.style.transform = "translateY(0)";
      } else {
        floatBtn.style.opacity = "0";
        floatBtn.style.transform = "translateY(20px)";
        setTimeout(() => {
          if (floatBtn.style.opacity === "0") floatBtn.style.display = "none";
        }, 300);
      }
    }

    // 滚动监听
    conversationStream.onscroll = updateFloatBtnVisibility;

    // 暴露给外部调用，方便在总结生成后/对话切换时刷新按钮状态
    floatBtn._updateVisibility = updateFloatBtnVisibility;

    // 初始化时立即检查一次（此时无总结，确保隐藏）
    updateFloatBtnVisibility();
  }

  /**
   * 切换对话折叠状态
   */
  window.toggleConversation = function (convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    conv.collapsed = !conv.collapsed;
    if (!conv.collapsed) {
      currentConversationId = convId;
    }

    // 局部切换，不执行全量 renderConversations
    const convEl = document.querySelector(
      `.conversation-item[data-id="${convId}"]`,
    );
    if (convEl) {
      const newEl = createConversationElement(conv);
      convEl.replaceWith(newEl);
    } else {
      renderConversations();
    }

    // 如果展开，滚动到该对话
    if (!conv.collapsed) {
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${convId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }

    // 更新全部展开/折叠按钮的标题
    const toggleAllBtn = document.getElementById("toggleAllBtn");
    if (toggleAllBtn) {
      // 移除tooltip提示
    }
  };

  /**
   * 平铺布局切换
   */
  window.tileCards = function (convId) {
    const responsesDiv = document.getElementById(`responses-${convId}`);
    if (!responsesDiv) return;

    responsesDiv.classList.toggle("tiled-layout");

    // 保存状态到对话
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      conv.tiled = !conv.tiled;
    }
  };

  let currentDetailContext = {
    provider: null,
    convId: null,
    availableProviders: [],
  };

  /**
   * 显示响应详情
   */
  window.showResponseDetail = function (provider, convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    // 清除总结标记
    currentDetailContext = {
      provider: null,
      convId: null,
      availableProviders: [],
      isSummary: false,
    };

    const response = conv.responses[provider];
    if (!response || response.status !== "ok") return;

    // 保存当前上下文供左右导航使用
    const availableProviders = conv.providers.filter(
      (p) => conv.responses[p] && conv.responses[p].status === "ok",
    );
    currentDetailContext = { provider, convId, availableProviders };

    // 使用现有的详情模态框
    const detailModal = document.getElementById("detailModal");
    const detailIcon = document.getElementById("detailIcon");
    const detailName = document.getElementById("detailName");
    const detailText = document.getElementById("detailText");
    const positionText = document.getElementById("positionText");
    const positionDots = document.getElementById("positionDots");

    const config = AI_CONFIG[provider];
    detailIcon.src = config.icon ? chrome.runtime.getURL(config.icon) : "";
    detailName.textContent = config.name;

    detailText.innerHTML = normalizeAndRender(response);

    // 更新导航点和小标题
    if (positionText && positionDots) {
      const currentIndex = availableProviders.indexOf(provider);
      const total = availableProviders.length;
      positionText.textContent = `${currentIndex + 1} of ${total}`;
      positionDots.innerHTML = availableProviders
        .map(
          (_, idx) =>
            `<span class="dot ${idx === currentIndex ? "active" : ""}"></span>`,
        )
        .join("");

      if (total <= 1) {
        document
          .getElementById("modalPositionIndicator")
          ?.classList.add("hidden");
      } else {
        document
          .getElementById("modalPositionIndicator")
          ?.classList.remove("hidden");
      }
    }

    // 自适应宽度：确保模态框不会超出主窗口宽度
    const detailContent = detailModal.querySelector('.detail-content');
    if (detailContent) {
      const windowWidth = window.innerWidth;
      const modalMaxWidth = 1400; // CSS 中的最大宽度
      const modalWidthPercent = 94; // CSS 中的宽度百分比
      
      // 计算合适的宽度
      let suitableWidth;
      if (windowWidth < 400) {
        // 很小的窗口
        suitableWidth = '95%';
      } else if (windowWidth < 600) {
        // 小窗口
        suitableWidth = '92%';
      } else if (windowWidth < 800) {
        // 中等窗口
        suitableWidth = '90%';
      } else {
        // 大窗口，使用原来的设置
        suitableWidth = modalWidthPercent + '%';
      }
      
      // 应用宽度，但不超过最大宽度
      detailContent.style.width = suitableWidth;
      detailContent.style.maxWidth = modalMaxWidth + 'px';
      
      console.log(`[Modal] Window width: ${windowWidth}px, Modal width: ${suitableWidth}`);
    }

    detailModal.classList.add("active");
  };

  // 绑定模态框左右导航事件（点击）
  document.getElementById("modalNavLeft")?.addEventListener("click", () => {
    const { provider, convId, availableProviders } = currentDetailContext;
    if (!convId || availableProviders.length <= 1) return;
    let currentIndex = availableProviders.indexOf(provider);
    currentIndex =
      currentIndex > 0 ? currentIndex - 1 : availableProviders.length - 1;
    window.showResponseDetail(availableProviders[currentIndex], convId);
  });

  document.getElementById("modalNavRight")?.addEventListener("click", () => {
    const { provider, convId, availableProviders } = currentDetailContext;
    if (!convId || availableProviders.length <= 1) return;
    let currentIndex = availableProviders.indexOf(provider);
    currentIndex =
      currentIndex < availableProviders.length - 1 ? currentIndex + 1 : 0;
    window.showResponseDetail(availableProviders[currentIndex], convId);
  });

  // ── 键盘方向键导航：ArrowLeft / ArrowRight ───────────────────────────────
  // 当 detailModal 处于打开状态时，监听键盘左右箭头实现卡片切换。
  // 使用持久化的全局 handler，避免重复绑定。
  document.addEventListener("keydown", (e) => {
    const detailModal = document.getElementById("detailModal");
    if (!detailModal || !detailModal.classList.contains("active")) return;
    // 排除输入框内的按键事件，避免干扰用户正在输入
    if (
      e.target &&
      (e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable)
    )
      return;

    const { provider, convId, availableProviders } = currentDetailContext;
    if (!convId || availableProviders.length <= 1) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      let idx = availableProviders.indexOf(provider);
      idx = idx > 0 ? idx - 1 : availableProviders.length - 1;
      // 给左按钮添加视觉反馈
      const leftBtn = document.getElementById("modalNavLeft");
      if (leftBtn) {
        leftBtn.classList.add("keyboard-active");
        setTimeout(() => leftBtn.classList.remove("keyboard-active"), 300);
      }
      window.showResponseDetail(availableProviders[idx], convId);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      let idx = availableProviders.indexOf(provider);
      idx = idx < availableProviders.length - 1 ? idx + 1 : 0;
      // 给右按钮添加视觉反馈
      const rightBtn = document.getElementById("modalNavRight");
      if (rightBtn) {
        rightBtn.classList.add("keyboard-active");
        setTimeout(() => rightBtn.classList.remove("keyboard-active"), 300);
      }
      window.showResponseDetail(availableProviders[idx], convId);
    } else if (e.key === "Escape") {
      // Esc 关闭模态框
      detailModal.classList.remove("active");
    }
  });

  /**
   * 智能总结
   */
  window.handleSummarize = async function (convId) {
    // 如果没有传入convId，使用当前对话
    if (!convId) {
      convId = currentConversationId;
    }

    const conv = conversations.find((c) => c.id === convId);
    if (!conv || !conv.archived) {
      showNotification(t("wait_for_responses"), "info");
      return;
    }

    // 构建总结提示词
    let prompt = customSummarizePrompt || getDefaultSummarizePrompt();

    // 收集所有模型的回答内容
    const modelContents = [];

    conv.providers.forEach((provider) => {
      const response = conv.responses[provider];
      if (
        !response ||
        (response.status !== "ok" && response.status !== "generating")
      )
        return;

      const config = AI_CONFIG[provider];
      const modelName = config?.name || provider;

      // 优先级1：response.text（最干净的纯文本）
      let contentText = (response.text || "").trim();

      // 优先级2：从 html 用 htmlToMarkdown 转换（保留格式结构）
      if (!contentText && response.html && response.html.trim()) {
        try {
          contentText = htmlToMarkdown(response.html).trim();
        } catch (e) {}
      }

      // 优先级3：直接剥离 html 标签取纯文本
      if (!contentText && response.html) {
        try {
          const tmp = document.createElement("div");
          tmp.innerHTML = response.html;
          contentText = (tmp.innerText || tmp.textContent || "").trim();
        } catch (e) {}
      }

      if (contentText.length > 0) {
        modelContents.push({ name: modelName, text: contentText });
        console.log(
          `[Summarize] ${modelName}: ${contentText.length} chars included`,
        );
      } else {
        console.warn(`[Summarize] ${modelName}: no content found, skipping`);
      }
    });

    // 如果没有任何模型内容，提示用户
    if (modelContents.length === 0) {
      showNotification("没有可总结的内容，请等待模型回复完成", "error");
      return;
    }

    // 拼接：问题 + 所有模型回答
    prompt += "\n\n";
    prompt += `【用户问题】\n${conv.question}\n\n`;
    prompt += "━".repeat(40) + "\n\n";

    modelContents.forEach(({ name, text }) => {
      prompt += `【${name} 的回答】\n${text}\n\n`;
      prompt += "━".repeat(40) + "\n\n";
    });

    console.log(
      `[Summarize] Total prompt length: ${prompt.length} chars, models: ${modelContents.map((m) => m.name).join(", ")}`,
    );

    // 创建临时总结状态（覆盖旧总结，支持无限次重新总结）
    conv.summary = {
      model: summarizeModel,
      text: "",
      html: "",
      status: "loading",
      timestamp: Date.now(),
    };

    // 展开当前对话以显示总结进度，并在渲染后滚动到底部
    conv.collapsed = false;
    renderConversations();
    setTimeout(() => {
      conversationStream.scrollTop = conversationStream.scrollHeight;
    }, 50);

    try {
      // 发送总结请求
      await chrome.runtime.sendMessage({
        action: "summarize_responses",
        provider: summarizeModel,
        prompt: prompt,
      });

      // 开始轮询总结结果
      startPollingSummary(convId, summarizeModel);
    } catch (e) {
      console.error("[Summarize] Error:", e);
      conv.summary = null;
      renderConversations();
      showNotification(t("summarize_error"), "error");
    }
  };

  /**
   * 轮询总结结果 - 优化：局部更新 DOM 避免闪烁，增加稳定性检测防溢出
   */
  function startPollingSummary(convId, provider) {
    let lastLocalText = "";
    let stableCounter = 0;

    const interval = setInterval(async () => {
      const conv = conversations.find((c) => c.id === convId);
      if (!conv || !conv.summary) {
        clearInterval(interval);
        return;
      }

      try {
        const result = await chrome.runtime.sendMessage({
          action: "fetch_all_responses",
          providers: [provider],
        });

        if (result && result.status === "ok" && result.responses) {
          const response = result.responses[provider];

          if (
            response &&
            (response.status === "generating" || response.status === "ok") &&
            response.text
          ) {
            const newText = response.text;
            const isTextStable = newText === lastLocalText;

            if (isTextStable && response.status === "generating") {
              stableCounter++;
            } else {
              stableCounter = 0;
            }
            lastLocalText = newText;

            // 稳定检测保底逻辑：
            // 如果 text 连续 15 次轮询（约20秒）没变，且已经有了一定内容（>50字），
            // 或者网页 provider 已经返回 ok
            const isActuallyDone =
              response.status === "ok" ||
              (stableCounter >= 15 && newText.length > 50);

            // 更新内存数据
            conv.summary = {
              model: provider,
              text: newText,
              html: response.html || "",
              status: isActuallyDone ? "ok" : "generating",
              timestamp: Date.now(),
            };

            // 局部更新 UI 避免 flashing
            updateSummaryCardUI(convId, conv.summary);

            if (isActuallyDone) {
              // 总结彻底完成，强制标记并保存到存储，确保重启后内容还在
              clearInterval(interval);
              conv.archived = true;
              conv.summary.status = "ok"; // 确保状态是 ok，不是 generating
              await saveAllToStorage();
              // 最终全量渲染一次确保状态一致
              renderConversations();
              // 显式刷新按钮状态，确保总结按钮重新可点击（支持无限次重新总结）
              updateActionButtons();
              // 总结完成后刷新悬浮直达按钮可见性
              const floatBtn = document.getElementById("floatJumpSummary");
              if (floatBtn && floatBtn._updateVisibility) {
                floatBtn._updateVisibility();
              }
              showNotification(t("summarize_complete"), "success");
            }
          }
        }
      } catch (e) {
        console.error("[Polling] Error:", e);
      }
    }, 1200);
  }

  /**
   * 局部更新总结卡片的 DOM 内容，避免全量 renderConversations() 导致的闪烁
   */
  function updateSummaryCardUI(convId, summary) {
    // 在 DOM 中找到对应的卡片容器
    const convEl = document.querySelector(
      `.conversation-item[data-id="${convId}"]`,
    );
    if (!convEl) return;

    let summaryCard = convEl.querySelector(".summary-card");
    if (!summaryCard) {
      // 如果还没渲染卡片（可能是第一次获取到内容），则全量渲染一次
      renderConversations();
      return;
    }

    // 更新状态徽章 (如果有)
    const badge = summaryCard.querySelector(
      ".status-badge.generating, .status-badge.loading",
    );
    if (summary.status === "ok" && badge) {
      badge.remove();
    }

    // 更新内容主体
    const body = summaryCard.querySelector(".summary-body");
    if (body) {
      const renderedSummary = normalizeAndRender(summary);
      if (body.innerHTML !== renderedSummary) {
        body.innerHTML = renderedSummary;
      }
    }
  }

  /**
   * 局部更新对话内容的 DOM，避免全量 renderConversations() 导致的闪烁
   */
  function updateConversationUI(convId) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;

    const convEl = document.querySelector(
      `.conversation-item[data-id="${convId}"]`,
    );
    if (!convEl) {
      renderConversations();
      return;
    }

    // 1. 如果是折叠状态，更新摘要统计
    if (conv.collapsed) {
      const metaEl = convEl.querySelector(".conversation-meta");
      if (metaEl) {
        const newMeta = `
                    <span>${getResponseCount(conv)} 个AI已回答</span>
                    ${conv.summary ? '<span class="summary-badge">✨ 已总结</span>' : ""}
                    ${conv.archived ? '<span class="archived-badge">📦</span>' : ""}
                `;
        if (metaEl.innerHTML !== newMeta) metaEl.innerHTML = newMeta;
      }
      return;
    }

    // 2. 如果是展开状态，更新响应卡片
    const responsesDiv = convEl.querySelector(`#responses-${convId}`);
    if (responsesDiv) {
      const cards = responsesDiv.querySelectorAll(".response-card");
      conv.providers.forEach((provider) => {
        const response = conv.responses[provider];
        // 查找该 provider 对应的卡片
        let card = null;
        for (const c of cards) {
          if (c.dataset.provider === provider) {
            card = c;
            break;
          }
        }

        if (card) {
          // a. 更新状态类名
          const statusClasses = [
            "loading",
            "generating",
            "ok",
            "error",
            "not_open",
          ];
          statusClasses.forEach((cls) => {
            if (response.status === cls) card.classList.add(cls);
            else card.classList.remove(cls);
          });

          // b. 更新状态徽章 (Badge)
          const badgeArea = card.querySelector(".response-card-info");
          if (badgeArea) {
            const currentBadge = badgeArea.querySelector(
              ".status-badge, .response-status-badge",
            );
            const newBadgeHTML = getStatusBadge(response.status);

            if (currentBadge) {
              // 临时创建一个元素来比较 HTML 内容
              const temp = document.createElement("div");
              temp.innerHTML = newBadgeHTML;
              const newBadge = temp.firstElementChild;
              if (newBadge && currentBadge.outerHTML !== newBadge.outerHTML) {
                currentBadge.replaceWith(newBadge);
              }
            } else {
              badgeArea.insertAdjacentHTML("beforeend", newBadgeHTML);
            }
          }

          // c. 更新字符统计和按钮
          const actionsArea = card.querySelector(".response-card-actions");
          if (actionsArea) {
            const isLatestConversation = conv.id === latestConversationId;
            const showRefresh = isLatestConversation; // Always show refresh for latest conversation
            const newActionsHTML = `
                            ${response.status === "ok" && response.text ? `<div class="response-char-count">${response.text.length} 字</div>` : ""}
                            ${
                              showRefresh
                                ? `
                                <button class="card-refresh-btn" data-action="refresh" data-provider="${provider}" data-conv-id="${conv.id}" title="手动刷新获取最新回复">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                    </svg>
                                </button>`
                                : `
                                <button class="card-detail-btn" data-action="detail" data-provider="${provider}" data-conv-id="${conv.id}" title="查看详情">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                                    </svg>
                                </button>`
                            }
                        `;
            // Remove onclick based comparison to prevent false positives in HTML comparison
            if (actionsArea.innerHTML.trim() !== newActionsHTML.trim())
              actionsArea.innerHTML = newActionsHTML;
          }

          // d. 更新主体内容 (Body)
          const body = card.querySelector(".response-card-body");
          if (body) {
            const newBodyHTML = renderResponseBody(response);
            if (body.innerHTML !== newBodyHTML) {
              body.innerHTML = newBodyHTML;
            }
          }
        }
      });
    }

    // 3. 更新全局按钮（如总结按钮的启用禁用状态）
    updateActionButtons();
  }

  /**
   * 获取默认总结提示词
   */
  function getDefaultSummarizePrompt() {
    if (currentLang === "zh-CN") {
      return `你是一位专业的多源信息综合分析师。以下是来自多个 AI 模型对同一问题的回答。请按照以下结构进行深度综合总结：

## 📌 核心结论
综合所有模型的观点，给出最可靠、最全面的核心答案。如果各模型结论一致，直接呈现；如果有分歧，给出你认为最合理的判断并说明理由。

## ✅ 各模型共识（高可信度内容）
列出所有或大多数模型都认同的关键观点、事实或建议。这些是最值得参考的内容。

## 💡 各模型独特亮点
提取每个模型回答中独有的、有价值的补充信息、视角或细节，标注来源模型名称。避免重复，只保留真正有增量价值的内容。

## ⚠️ 分歧与差异点
明确指出各模型之间存在矛盾、不同结论或相反建议的地方，分析可能的原因，帮助用户判断哪种观点更可信。

## 🎯 综合建议与行动指南
基于以上分析，给出最终的实用建议或行动步骤。要具体、可执行，避免空泛。

---
**注意事项**：
- 不要简单罗列各模型的原话，要真正做到"综合"与"提炼"
- 对于事实性内容，优先采纳多数模型一致的观点
- 对于主观性建议，综合各模型的优点给出平衡的结论
- 如发现某模型有明显错误或偏差，请明确指出

以下是各 AI 模型的回答内容：
`;
    } else {
      return `You are a professional multi-source information synthesis analyst. Below are responses from multiple AI models to the same question. Please provide a deep, structured synthesis following this format:

## 📌 Core Conclusion
Synthesize all models' perspectives into the most reliable and comprehensive answer. If models agree, present it directly; if they diverge, give your best-supported judgment and explain why.

## ✅ Consensus Points (High-confidence content)
List the key points, facts, or recommendations that all or most models agree on. These are the most trustworthy insights.

## 💡 Unique Highlights from Each Model
Extract valuable unique insights, perspectives, or details from each model's response that others missed. Label the source model. Only include genuinely additive content.

## ⚠️ Disagreements & Contradictions
Clearly identify where models contradict each other, reach different conclusions, or give opposing advice. Analyze possible reasons and help the user determine which view is more credible.

## 🎯 Integrated Recommendations & Action Plan
Based on the analysis above, provide final practical recommendations or action steps. Be specific and actionable, not vague.

---
**Notes**:
- Do not simply list quotes from each model — truly synthesize and distill
- For factual content, prioritize the majority consensus view
- For subjective advice, balance the strengths of each model's perspective
- If a model contains obvious errors or bias, clearly flag it

Here are the responses from each AI model:
`;
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

    // 更新切换按钮状态
    const btn = modelToggleAllBtn || document.getElementById("modelToggleAllBtn");
    if (btn) {
      const checkboxes = modelsModal.querySelectorAll('input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(
        (checkbox) => checkbox.checked,
      );

      const toggleText = btn.querySelector(".toggle-text");
      if (toggleText) {
        toggleText.textContent = allChecked ? "全不选" : "全选";
      }

      if (allChecked) {
        btn.classList.add("deselect-mode");
      } else {
        btn.classList.remove("deselect-mode");
      }
    }
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
   * 通用自定义确认弹窗
   * @param {string} title  标题
   * @param {string} desc   描述文字
   * @param {string} okText 确认按钮文字
   * @returns {Promise<boolean>}
   */
  function showConfirmModal(title, desc, okText = "确认") {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirmModal");
      const titleEl = document.getElementById("confirmModalTitle");
      const descEl = document.getElementById("confirmModalDesc");
      const okBtn = document.getElementById("confirmModalOk");
      const cancelBtn = document.getElementById("confirmModalCancel");

      if (!modal) {
        resolve(window.confirm(desc));
        return;
      }

      titleEl.textContent = title;
      descEl.textContent = desc;
      okBtn.textContent = okText;

      modal.classList.add("active");

      function onOk() {
        cleanup(true);
      }
      function onCancel() {
        cleanup(false);
      }
      function onOverlay(e) {
        if (e.target === modal) cleanup(false);
      }
      function onEscape(e) {
        if (e.key === "Escape") cleanup(false);
      }

      function cleanup(result) {
        modal.classList.remove("active");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onOverlay);
        document.removeEventListener("keydown", onEscape);
        resolve(result);
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onOverlay);
      document.addEventListener("keydown", onEscape);
    });
  }

  /**
   * 清空历史
   */
  async function clearAllHistory() {
    const title =
      currentLang === "zh-CN" ? "清空所有对话历史" : "Clear All History";
    const desc =
      currentLang === "zh-CN"
        ? "确定要清空所有对话历史吗？此操作不可恢复。"
        : "Are you sure you want to clear all conversation history? This cannot be undone.";
    const okText = currentLang === "zh-CN" ? "确认清空" : "Clear All";

    const confirmed = await showConfirmModal(title, desc, okText);
    if (!confirmed) return;

    // 停止所有正在运行的轮询
    if (typeof PollingManager !== "undefined") {
      PollingManager.stopAll && PollingManager.stopAll();
    }

    conversations = [];
    currentConversationId = null;
    latestConversationId = null;

    // 使用统一存储函数，确保 storage_version 也一并保存
    await saveAllToStorage();

    // 强制清空 DOM 并显示空状态
    conversationStream.innerHTML = "";
    const emptyState = document.getElementById("emptyState");
    if (emptyState) emptyState.style.display = "flex";
    conversationStream.appendChild(emptyState || document.createElement("div"));

    renderConversations();
    updateActionButtons();
    showNotification(t("history_cleared"), "success");
  }

  /**
   * 删除单条对话
   */
  async function deleteConversation(convId) {
    const title = "删除此对话";
    const desc = "确定要删除这条对话吗？删除后不可恢复。";
    const okText = "确认删除";

    const confirmed = await showConfirmModal(title, desc, okText);
    if (!confirmed) return;

    const index = conversations.findIndex((c) => c.id === convId);
    if (index === -1) return;

    conversations.splice(index, 1);

    if (currentConversationId === convId) {
      currentConversationId =
        conversations.length > 0
          ? conversations[conversations.length - 1].id
          : null;
    }

    // 更新最新对话ID
    if (latestConversationId === convId) {
      latestConversationId =
        conversations.length > 0
          ? conversations[conversations.length - 1].id
          : null;
    }

    await saveAllToStorage();
    renderConversations();
    updateActionButtons();
    showNotification("对话已删除", "success");
  }

  // 暴露给事件委托
  window.deleteConversation = deleteConversation;

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

  // 输入框自动调整高度
  promptInput.addEventListener("input", function () {
    this.style.height = "auto";
    const newHeight = Math.min(this.scrollHeight, window.innerHeight * 0.4);
    this.style.height = newHeight + "px";
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

  // 全选/全不选切换功能（模型弹窗）
  if (modelToggleAllBtn) {
    modelToggleAllBtn.addEventListener("click", () => {
      const checkboxes = modelsModal.querySelectorAll('input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(
        (checkbox) => checkbox.checked,
      );

      checkboxes.forEach((checkbox) => {
        checkbox.checked = !allChecked;
      });

      // 更新按钮文本
      const toggleText = modelToggleAllBtn.querySelector(".toggle-text");
      if (toggleText) toggleText.textContent = allChecked ? "全选" : "全不选";

      // 更新按钮标题
      modelToggleAllBtn.title = allChecked ? "全选所有模型" : "取消全选";

      // 更新按钮样式状态
      if (allChecked) {
        modelToggleAllBtn.classList.remove("deselect-mode");
      } else {
        modelToggleAllBtn.classList.add("deselect-mode");
      }
    });
  }

  // 语言
  langToggleBtn.addEventListener("click", toggleLanguage);

  // 清空历史
  clearHistoryBtn.addEventListener("click", clearAllHistory);

  // 操作按钮
  if (summarizeBtn) {
    summarizeBtn.addEventListener("click", () => window.handleSummarize());
  }

  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", () => window.copyAllResponses());
  }

  // 全部展开/折叠
  if (toggleAllBtn) {
    // 初始化按钮标题
    // 移除tooltip提示

    toggleAllBtn.addEventListener("click", () => {
      // 检查当前是否有任何消息是展开的
      const hasExpandedConversations = conversations.some((c) => !c.collapsed);

      // 如果有展开的消息，则全部折叠；否则全部展开
      const shouldExpandAll = !hasExpandedConversations;

      conversations.forEach((c) => {
        c.collapsed = !shouldExpandAll;
      });

      renderConversations();

      // 更新按钮标题
      // 移除tooltip提示

      // 如果是全部展开，滚到底部
      if (shouldExpandAll) {
        setTimeout(() => {
          conversationStream.scrollTop = conversationStream.scrollHeight;
        }, 50);
      }
    });
  }

  // 总结设置
  const summarizeSettingsInModelsBtn = document.getElementById(
    "summarizeSettingsInModelsBtn",
  );
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

  if (summarizeSettingsInModelsBtn) {
    summarizeSettingsInModelsBtn.addEventListener("click", () => {
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

  // Header actions
  if (launchOnlyBtn) {
    launchOnlyBtn.addEventListener("click", () => {
      const providers = getSelectedProviders();
      if (providers.length === 0) {
        alert(t("select_at_least_one"));
        return;
      }
      chrome.runtime.sendMessage({
        action: "launch_only_providers",
        providers: providers,
      });
      showNotification("正在打开选中的AI网页...", "info");
    });
  }

  if (tileBtn) {
    tileBtn.addEventListener("click", () => {
      const providers = getSelectedProviders();
      if (providers.length === 0) {
        alert(t("select_at_least_one"));
        return;
      }
      chrome.runtime.sendMessage({
        action: "tile_windows",
        providers: providers,
      });
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const title =
        currentLang === "zh-CN" ? "关闭所有 AI 窗口？" : "Close All Windows?";
      const desc =
        currentLang === "zh-CN"
          ? "确定要一键关闭所有 AI 对话窗口吗？正在运行的回答将不会被保存，此操作不会关闭当前控制面板。"
          : "Close all AI conversation windows? In-progress responses will not be saved. The control panel will remain open.";
      const okText = currentLang === "zh-CN" ? "确认关闭" : "Close All";

      showConfirmModal(title, desc, okText).then((confirmed) => {
        if (confirmed) {
          chrome.runtime.sendMessage({
            action: "close_all_windows",
          });
          showNotification(
            currentLang === "zh-CN"
              ? "正在关闭所有 AI 网页..."
              : "Closing all AI windows...",
            "info",
          );
        }
      });
    });
  }

  // 关闭详情模态框
  const closeDetailBtn = document.getElementById("closeDetailBtn");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => {
      document.getElementById("detailModal").classList.remove("active");
    });
  }

  // 复制此响应按钮
  const copyDetailBtn = document.getElementById("copyDetailBtn");
  if (copyDetailBtn) {
    copyDetailBtn.addEventListener("click", async () => {
      const { provider, convId, isSummary } = currentDetailContext;
      let textToCopy = "";

      if (convId) {
        const conv = conversations.find((c) => c.id === convId);
        if (conv) {
          if (isSummary) {
            // 总结弹窗：取总结文本
            textToCopy = (conv.summary?.text || "").trim();
          } else if (provider) {
            // 普通响应弹窗：取该模型的文本
            const response = conv.responses[provider];
            if (response) {
              textToCopy = (response.text || "").trim();
              // 兜底：从 html 转 markdown 再取文本
              if (!textToCopy && response.html) {
                try {
                  textToCopy = htmlToMarkdown(response.html).trim();
                } catch (e) {
                  const tmp = document.createElement("div");
                  tmp.innerHTML = response.html;
                  textToCopy = (tmp.innerText || tmp.textContent || "").trim();
                }
              }
            }
          }
        }
      }

      // 最终兜底：直接从弹窗 DOM 里取可见文本
      if (!textToCopy) {
        const detailTextEl = document.getElementById("detailText");
        if (detailTextEl) {
          textToCopy = (
            detailTextEl.innerText ||
            detailTextEl.textContent ||
            ""
          ).trim();
        }
      }

      if (!textToCopy) {
        showNotification("没有可复制的内容", "error");
        return;
      }

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = copyDetailBtn.textContent;
        copyDetailBtn.textContent = "✓ 已复制";
        copyDetailBtn.style.background = "var(--success, #2ea043)";
        setTimeout(() => {
          copyDetailBtn.textContent = originalText;
          copyDetailBtn.style.background = "";
        }, 1500);
      } catch (e) {
        console.error("[Copy] Error:", e);
        showNotification("复制失败，请手动选择文字复制", "error");
      }
    });
  }

  // Modal resize handles logic
  const detailModal = document.getElementById("detailModal");
  const detailContent = detailModal?.querySelector(".detail-content");
  const leftHandle = detailModal?.querySelector(".modal-resize-handle-left");
  const rightHandle = detailModal?.querySelector(".modal-resize-handle-right");

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
      document.body.style.userSelect = "none";
      // Also pointer-events none to iframes if any

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopResize);
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
      const newWidth = Math.max(
        400,
        Math.min(distance * 2, window.innerWidth - 40),
      );

      // Apply new width, overriding max-width so it can grow
      detailContent.style.maxWidth = "none";
      detailContent.style.width = `${newWidth}px`;
    }

    async function stopResize() {
      isResizing = false;
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stopResize);

      // 保存宽度到存储
      if (detailContent.style.width) {
        try {
          await chrome.storage.local.set({
            modalWidth: detailContent.style.width,
          });
          console.log("[Modal] Saved width:", detailContent.style.width);
        } catch (e) {
          console.error("[Modal] Save width error:", e);
        }
      }
    }

    leftHandle.addEventListener("mousedown", startResize);
    rightHandle.addEventListener("mousedown", startResize);

    // 初始化加载保存的宽度
    chrome.storage.local.get(["modalWidth"], (result) => {
      if (result.modalWidth && detailContent) {
        detailContent.style.maxWidth = "none";
        detailContent.style.width = result.modalWidth;
        console.log("[Modal] Restored width:", result.modalWidth);
      }
    });

  // 窗口大小变化时，更新模态框宽度
  window.addEventListener('resize', () => {
    const detailModal = document.getElementById("detailModal");
    if (detailModal && detailModal.classList.contains("active")) {
      const detailContent = detailModal.querySelector('.detail-content');
      if (detailContent) {
        const windowWidth = window.innerWidth;
        const modalMaxWidth = 1400;
        const modalWidthPercent = 94;
        
        // 计算合适的宽度
        let suitableWidth;
        if (windowWidth < 400) {
          suitableWidth = '95%';
        } else if (windowWidth < 600) {
          suitableWidth = '92%';
        } else if (windowWidth < 800) {
          suitableWidth = '90%';
        } else {
          suitableWidth = modalWidthPercent + '%';
        }
        
        // 应用宽度，但不超过最大宽度
        detailContent.style.width = suitableWidth;
        detailContent.style.maxWidth = modalMaxWidth + 'px';
        
        console.log(`[Modal Resize] Window width: ${windowWidth}px, Modal width: ${suitableWidth}`);
      }
    }
  });

    // Reset width when closing modal to avoid it getting stuck huge forever if desired, or keep it.
    // Keeping it is usually what users want for persistence across a session.
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
                <button class="file-remove-btn" data-file-index="${index}">&times;</button>
            </div>
        `,
      )
      .join("");

    // 绑定文件移除按钮事件
    filePreviewList.querySelectorAll(".file-remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
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

  // 初始化悬浮按钮
  initFloatJumpButton();

  console.log("[AI Multiverse v2.0] Initialized");
});
