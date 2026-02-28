// === AI Multiverse Content Script ===
// Injected into AI chat pages to fill input and send messages

console.log(
  "[AI Multiverse] Content script loaded on:",
  window.location.hostname,
);

// Ensure AI_STATUS is defined even if config.js loading failed
if (typeof AI_STATUS === "undefined") {
  window.AI_STATUS = {
    GENERATING: "generating",
    OK: "ok",
    LOADING: "loading",
    ERROR: "error",
    NOT_OPEN: "not_open",
    SENDING: "sending",
    TIMEOUT: "timeout",
  };
}

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
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Basic text sanitization - prevents HTML injection
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (typeof text !== "string") return "";
  // Remove HTML tags
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Remove reasoning/thinking blocks from AI response
 * Some models (DeepSeek R1, ChatGPT o1, etc.) include step-by-step reasoning
 * before the final answer. This function filters out those parts.
 * @param {HTMLElement} element - DOM element containing the response
 * @param {string} provider - Provider name for special handling
 * @returns {HTMLElement} - Cloned element with thinking blocks removed
 */
function removeThinkingBlocks(element, provider = "") {
  // Clone to avoid modifying the original DOM
  const cloned = element.cloneNode(true);

  // ── Gemini：移除回复顶部的 AI 名称标签元素 ──────────────────────────────
  // Gemini 的 model-response 容器内顶部有一个显示 "Gemini" 字样的标签元素，
  // 使用宽泛选择器时会被一同提取，需在 DOM 层提前移除。
  if (provider === "gemini") {
    // 移除仅含 AI 名称文本的短小标签节点（profile pill / author label）
    const shortTextSelectors = [
      ".model-response-profile-pill",
      ".response-author",
      ".message-author",
      '[class*="profile-pill"]',
      '[class*="author-name"]',
      '[class*="response-label"]',
      '[class*="model-label"]',
      '[class*="bot-name"]',
    ];
    shortTextSelectors.forEach((sel) => {
      try {
        cloned.querySelectorAll(sel).forEach((el) => el.remove());
      } catch (e) {}
    });

    // 再做一次文本扫描：移除 innerText 仅为 "Gemini" 或类似 AI 名称的任何元素
    try {
      cloned.querySelectorAll("span, div, p").forEach((el) => {
        const txt = (el.innerText || el.textContent || "").trim();
        if (
          /^(Gemini|Google\s*Gemini|Gemini\s*说|Gemini\s*says)$/i.test(txt) &&
          el.children.length === 0
        ) {
          el.remove();
        }
      });
    } catch (e) {}
  }

  // For Kimi: remove UI chrome injected around tables and code blocks
  // Kimi renders a "表格" label + "复制" copy button above each table/code block.
  // These are purely decorative UI elements and pollute the extracted text/html.
  if (provider === "kimi") {
    // Remove table header UI (contains "表格" label and copy button)
    cloned
      .querySelectorAll(
        ".table-header, .code-header, [class*='table-header'], [class*='code-header']",
      )
      .forEach((el) => el.remove());

    // Remove standalone copy buttons inside markdown blocks
    cloned
      .querySelectorAll(
        "button, [class*='copy-btn'], [class*='copyBtn'], [class*='copy-button']",
      )
      .forEach((el) => el.remove());

    console.log("[AI Multiverse] Kimi: removed UI chrome elements from clone");
  }

  // For Yuanbao (腾讯元宝), the deep search component has thinking + answer
  // Structure: .hyc-component-deepsearch-cot
  //   ├── .hyc-component-deepsearch-cot__think (thinking - REMOVE)
  //   └── .hyc-content-md (answer - KEEP)
  if (provider === "yuanbao") {
    // ── 方式1：按已知结构精确移除思考子节点 ────────────────────────────────
    const deepSearchComponents = cloned.querySelectorAll(
      ".hyc-component-deepsearch-cot",
    );
    deepSearchComponents.forEach((component) => {
      const thinkingSections = component.querySelectorAll(
        ".hyc-component-deepsearch-cot__think",
      );
      thinkingSections.forEach((el) => el.remove());
    });

    // ── 方式2：移除更广泛的深度思考容器（应对 Yuanbao DOM 更新）────────────
    const broadThinkingSelectors = [
      // 已知结构的变体
      '[class*="deepsearch-cot__think"]',
      '[class*="deep-think"]',
      '[class*="deepthink"]',
      '[class*="think-process"]',
      '[class*="thinking-process"]',
      '[class*="think-content"]',
      // collapsible 类型的思考块
      "details",
      '[class*="reasoning-block"]',
      '[class*="thought-block"]',
    ];
    broadThinkingSelectors.forEach((sel) => {
      try {
        cloned.querySelectorAll(sel).forEach((el) => {
          // 仅移除包含"深度思考"/"思考"等关键词的元素，避免误删正文
          const txt = (el.innerText || el.textContent || "").substring(0, 60);
          if (/深度思考|思考过程|思考中|reasoning|thinking/i.test(txt)) {
            el.remove();
          }
        });
      } catch (e) {}
    });

    // ── 方式3：移除"深度思考"标题行本身（纯标签，无实质内容）───────────────
    try {
      cloned.querySelectorAll("span, div, p, h1, h2, h3, h4").forEach((el) => {
        const txt = (el.innerText || el.textContent || "").trim();
        if (
          /^(深度思考|深度搜索|思考过程)[：:。\s]*$/.test(txt) &&
          el.children.length === 0
        ) {
          el.remove();
        }
      });
    } catch (e) {}

    return cloned;
  }

  // 1. Remove elements with 'thinking'/'reasoning' keywords in class names
  const thinkingClasses = [
    "thinking",
    "reasoning",
    "thought",
    "chain-of-thought",
    "cot",
  ];
  thinkingClasses.forEach((cls) => {
    const els = cloned.querySelectorAll(`[class*="${cls}"]`);
    els.forEach((el) => el.remove());
  });

  // 2. Remove elements with specific data attributes (some platforms use them)
  const dataAttributes = ["data-thinking", "data-reasoning"];
  dataAttributes.forEach((attr) => {
    const els = cloned.querySelectorAll(`[${attr}]`);
    els.forEach((el) => el.remove());
  });

  // 3. Remove collapsible reasoning blocks (common in ChatGPT o1)
  const collapsibleSelectors = [
    '[aria-label*="Reasoning"]',
    '[aria-label*="Thinking"]',
    'details[summary*="thought"]',
    'details[summary*="Thinking"]',
    ".reasoning-block",
  ];
  collapsibleSelectors.forEach((sel) => {
    try {
      const els = cloned.querySelectorAll(sel);
      els.forEach((el) => el.remove());
    } catch (e) {
      /* ignore invalid selectors */
    }
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
  const thinkingPattern1 =
    /^(Thinking|Reasoning|思考|推理|Thought)[:：]\s*\n((?:[ \t].*\n)+)/gim;
  text = text.replace(thinkingPattern1, "");

  // Pattern 2: Thinking in quotes or brackets (e.g., "Let's think step by step...")
  const thinkingPattern2 = /``[\s\S]*?thinking[\s\S]*?``/gi;
  text = text.replace(thinkingPattern2, "");

  // Pattern 3: Remove empty lines after filtering
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

// === Diagnose Selectors (Debug Tool) ===
function diagnoseSelectors(provider) {
  let config = null;

  // Find config for this provider
  if (typeof AI_CONFIG !== "undefined" && AI_CONFIG[provider]) {
    config = AI_CONFIG[provider];
  } else if (typeof AI_CONFIG !== "undefined") {
    for (const key in AI_CONFIG) {
      const conf = AI_CONFIG[key];
      const domain = conf.urlPattern
        .replace("*://", "")
        .replace("/*", "")
        .split("/")[0];
      if (window.location.hostname.includes(domain)) {
        config = conf;
        break;
      }
    }
  }

  if (!config || !config.selectors || !config.selectors.response) {
    return { status: "error", message: "No response selectors configured" };
  }

  const results = [];
  const selectors = config.selectors.response;

  selectors.forEach((sel, idx) => {
    try {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) {
        const lastEl = elements[elements.length - 1];
        const text = (lastEl.innerText || lastEl.textContent || "").trim();
        results.push({
          selector: sel,
          found: elements.length,
          lastElementLength: text.length,
          lastElementPreview: text.substring(0, 100),
          valid: text.length > 0,
        });
      } else {
        results.push({
          selector: sel,
          found: 0,
          lastElementLength: 0,
          lastElementPreview: "",
          valid: false,
        });
      }
    } catch (e) {
      results.push({
        selector: sel,
        found: 0,
        lastElementLength: 0,
        lastElementPreview: "",
        valid: false,
        error: e.message,
      });
    }
  });

  // Find best selector
  const best = results
    .filter((r) => r.valid)
    .sort((a, b) => b.lastElementLength - a.lastElementLength)[0];

  return {
    status: "ok",
    provider: provider,
    url: window.location.href,
    hostname: window.location.hostname,
    results: results,
    bestSelector: best ? best.selector : null,
    bestLength: best ? best.lastElementLength : 0,
  };
}

// === Message Listener ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "alive" });
    return;
  }
  if (request.action === "fill_and_send") {
    // Reset text-change tracking so previous response doesn't interfere with new one
    resetProviderTracking(request.provider);
    handleFillAndSend(request.text, request.provider, request.files || [])
      .then(() => sendResponse({ status: "done" }))
      .catch((err) => sendResponse({ status: "error", error: err.message }));
    return true;
  }
  if (request.action === "extract_response") {
    // Yuanbao: 优先通过 /detail API 提取，API 返回结构化 JSON，
    // 可精确区分 type:"think"（深度思考）和 type:"text"（正文），避免 DOM 刮取遗漏。
    if (request.provider === "yuanbao") {
      extractYuanbaoViaAPI()
        .then((apiResult) => {
          if (apiResult && apiResult.status === "ok" && apiResult.text) {
            sendResponse(apiResult);
          } else {
            // API 失败时降级到 DOM 方式
            const result = extractLatestResponse(request.provider);
            sendResponse(result);
          }
        })
        .catch(() => {
          const result = extractLatestResponse(request.provider);
          sendResponse(result);
        });
      return true; // 异步响应
    }
    const result = extractLatestResponse(request.provider);
    sendResponse(result);
    return;
  }
  // Network streaming status updates from background
  if (request.action === "streaming_started") {
    console.log(
      `[AI Multiverse] ✓ Network: ${request.provider} streaming started`,
    );
    _networkStreamingStatus[request.provider] = {
      isStreaming: true,
      conversationId: request.conversationId,
      startTime: Date.now(),
    };
    return;
  }
  if (request.action === "streaming_completed") {
    console.log(
      `[AI Multiverse] ✓ Network: ${request.provider} streaming completed`,
    );
    _networkStreamingStatus[request.provider] = {
      isStreaming: false,
      conversationId: request.conversationId,
      endTime: Date.now(),
    };
    return;
  }
  if (request.action === "streaming_error") {
    console.log(
      `[AI Multiverse] ✗ Network: ${request.provider} streaming error:`,
      request.error,
    );
    _networkStreamingStatus[request.provider] = {
      isStreaming: false,
      error: request.error,
    };
    return;
  }
});

// === Extract Latest AI Response ===
/**
 * 通过元宝 /detail API 提取最新 AI 回复，精确过滤深度思考内容。
 *
 * API 返回的 speechesV2[].content[] 中：
 *   { type: "think", content: "..." }      → 深度思考过程，需跳过
 *   { type: "deepSearch", contents: [...] } → 深度搜索过程，需跳过
 *   { type: "searchGuid", docs: [...] }     → 引用来源列表，需跳过
 *   { type: "text",  msg: "..." }           → 正文回答，保留
 *
 * conversationId 从当前页面 URL 中提取（路径最后一段或 ?conversation= 参数）。
 * agentId 从 URL 路径中提取（yuanbao.tencent.com/chat/<agentId>/<convId>）。
 */
async function extractYuanbaoViaAPI() {
  try {
    // ── 1. 从 URL 中提取 conversationId 和 agentId ─────────────────────────
    const url = window.location.href;
    const urlObj = new URL(url);

    console.log(
      "[AI Multiverse] Yuanbao API: 开始提取，当前 URL:",
      urlObj.pathname + urlObj.search,
    );

    // 尝试从查询参数获取 conversationId
    let conversationId =
      urlObj.searchParams.get("conversation") ||
      urlObj.searchParams.get("conversationId");

    // 尝试从路径中提取（格式：/chat/<agentId>/<conversationId>）
    const pathParts = urlObj.pathname.replace(/^\/+|\/+$/g, "").split("/");
    // pathParts 可能是 ["chat", "naQivTmsDa"] 或 ["chat", "naQivTmsDa", "<uuid>"]
    let agentId = null;
    if (pathParts[0] === "chat") {
      agentId = pathParts[1] || null;
      if (!conversationId && pathParts[2]) {
        conversationId = pathParts[2];
      }
    }

    // 若 conversationId 不在路径里，尝试从 DOM / localStorage 取
    if (!conversationId) {
      // 元宝有时把 conversationId 存在 URL hash
      const hash = urlObj.hash.replace(/^#/, "");
      if (hash && /^[0-9a-f-]{36}$/i.test(hash)) {
        conversationId = hash;
      }
    }

    if (!conversationId) {
      console.warn(
        "[AI Multiverse] Yuanbao API: 无法从 URL 提取 conversationId（需要 UUID 格式），降级到 DOM 方式",
      );
      return null;
    }

    console.log(
      "[AI Multiverse] Yuanbao API: 提取到 conversationId:",
      conversationId.substring(0, 8) + "...",
      agentId ? "agentId: " + agentId.substring(0, 8) + "..." : "无 agentId",
    );

    // ── 2. 请求 /detail API ──────────────────────────────────────────────────
    const apiUrl = new URL(
      "https://yuanbao.tencent.com/api/user/agent/conversation/v1/detail",
    );

    console.log(
      "[AI Multiverse] Yuanbao API: 正在请求 /detail API...",
      apiUrl.toString(),
    );

    const resp = await fetch(apiUrl.toString(), {
      method: "POST",
      credentials: "include", // 携带登录 Cookie
      headers: { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
      body: JSON.stringify({
        conversationId: conversationId,
        ...(agentId && { agentId: agentId })
      })
    });

    // 添加调试信息
    console.log("[AI Multiverse] Yuanbao API: Request timestamp:", new Date().toISOString());
    console.log("[AI Multiverse] Yuanbao API: Request URL:", apiUrl.toString());
    console.log("[AI Multiverse] Yuanbao API: Request body:", JSON.stringify({
      conversationId: conversationId,
      ...(agentId && { agentId: agentId })
    }));

    if (!resp.ok) {
      console.warn(
        "[AI Multiverse] Yuanbao API: HTTP 错误",
        resp.status,
        resp.statusText,
      );
      return null;
    }

    const data = await resp.json();
    
    // 添加调试信息
    console.log("[AI Multiverse] Yuanbao API: Response timestamp:", new Date().toISOString());
    console.log("[AI Multiverse] Yuanbao API: Response status:", resp.status);
    console.log("[AI Multiverse] Yuanbao API: Response headers:", Object.from(resp.headers.entries()));
    
    // ── 3. 找到最新一条 AI 回复 ──────────────────────────────────────────────
    if (!data || !Array.isArray(data.convs)) {
      console.warn(
        "[AI Multiverse] Yuanbao API: 响应数据结构异常，无 convs 字段",
      );
      return null;
    }

    const convs = data.convs;
    if (convs.length === 0) {
      console.warn("[AI Multiverse] Yuanbao API: 对话列表为空");
      return null;
    }

    // convs 列表按 index 降序排列（最新在前），找第一条 speaker === "ai" 的
    const latestAI = convs.find(
      (c) =>
        c.speaker === "ai" &&
        Array.isArray(c.speechesV2) &&
        c.speechesV2.length > 0,
    );
    if (!latestAI) {
      console.warn(
        "[AI Multiverse] Yuanbao API: 未找到有效的 AI 回复（speaker === 'ai'）",
      );
      return null;
    }

    console.log(
      "[AI Multiverse] Yuanbao API: 找到最新 AI 回复，speechesV2 数量:",
      latestAI.speechesV2.length,
    );

    // ── 4. 从 speechesV2 中拼接所有 type:"text" 内容，跳过 type:"think" ──────
    const textParts = [];
    let skippedTypes = new Set();

    for (const speech of latestAI.speechesV2) {
      if (!Array.isArray(speech.content)) continue;
      for (const item of speech.content) {
        // 记录跳过的内容类型（用于调试）
        if (
          !["text", "think", "deepSearch", "searchGuid", "deepSearch"].includes(
            item.type,
          )
        ) {
          console.log("[AI Multiverse] Yuanbao API: 未知内容类型:", item.type);
        }

        if (item.type === "text" && item.msg) {
          // msg 中 \u003c/\u003e 是 HTML 实体，保留原始 Markdown
          textParts.push(item.msg);
        } else if (item.type) {
          skippedTypes.add(item.type);
        }
        // type === "think" → 深度思考过程，跳过
        // type === "deepSearch" → 深度搜索过程，跳过
        // type === "searchGuid" → 引用来源列表，跳过
      }
    }

    console.log(
      "[AI Multiverse] Yuanbao API: 过滤掉的内容类型:",
      Array.from(skippedTypes).join(", ") || "无",
    );

    const combined = textParts.join("\n\n").trim();
    if (!combined) {
      console.debug(
        "[AI Multiverse] Yuanbao API: 提取后无有效文本内容（可能全部是思考/搜索内容）",
      );
      return null;
    }

    console.log(
      "[AI Multiverse] Yuanbao API: ✓ 成功提取回复，字数:",
      combined.length,
    );
    return { status: "ok", text: combined, html: "" };
  } catch (err) {
    console.warn(
      "[AI Multiverse] Yuanbao API 提取失败:",
      err.name || "Error",
      err.message,
    );
    // 打印详细错误堆栈（开发环境）
    if (
      window.location.hostname === "localhost" ||
      urlObj.searchParams.has("debug")
    ) {
      console.error(err);
    }
    return null;
  }
}

function extractLatestResponse(provider) {
  let config = null;

  // Find config for this provider
  if (typeof AI_CONFIG !== "undefined" && AI_CONFIG[provider]) {
    config = AI_CONFIG[provider];
  } else if (typeof AI_CONFIG !== "undefined") {
    for (const key in AI_CONFIG) {
      const conf = AI_CONFIG[key];
      const domain = conf.urlPattern
        .replace("*://", "")
        .replace("/*", "")
        .split("/")[0];
      if (window.location.hostname.includes(domain)) {
        config = conf;
        break;
      }
    }
  }

  if (!config || !config.selectors || !config.selectors.response) {
    return { status: "error", error: "No response selectors configured" };
  }

  // Smart selection variables
  let bestEl = null;
  let bestSelector = null;
  const candidates = [];

  // ===================================================================
  // 千问特殊处理（Bug Fix）：
  // 当千问刚开始生成新回复时，新的回复容器存在但内容为空。
  // 若不提前处理，空容器会被后续的非空检测过滤掉，
  // 导致从其他宽泛选择器中选中含有"所有历史回复"的大容器，
  // 进而把上一条的旧回复内容显示出来。
  // 解决方案：提前检测"最新容器为空 + 正在生成"的情况，直接返回 GENERATING。
  // ===================================================================
  if (provider === "qwen") {
    const primarySelectors = config.selectors.response.slice(0, 3);
    for (const sel of primarySelectors) {
      try {
        const elements = Array.from(document.querySelectorAll(sel)).filter(
          (el) => !el.getAttribute("data-multiverse-old"),
        );
        if (elements.length < 1) continue;
        const lastEl = elements[elements.length - 1];
        const lastText = (lastEl.innerText || lastEl.textContent || "").trim();
        if (lastText.length === 0) {
          // 最新容器为空，检查是否正在生成
          const networkStatus = _networkStreamingStatus["qwen"];
          const stopBtn = document.querySelector(
            'button:has(svg[data-icon-type="qwpcicon-stopChat"]), [class*="stop-icon"]',
          );
          const timeSinceSend = Date.now() - (_lastSendTimes["qwen"] || 0);
          if (
            networkStatus?.isStreaming ||
            (isElementVisible(stopBtn) && !isElementDisabled(stopBtn)) ||
            timeSinceSend < 8000
          ) {
            console.log(
              "[AI Multiverse] Qwen: New response container is empty, generation starting...",
            );
            return { status: AI_STATUS.GENERATING, text: "", html: "" };
          }
        }
        break; // 若最新容器有内容，退出提前检测，走正常流程
      } catch (e) {}
    }
  }

  // ===================================================================
  // Kimi 特殊处理（Bug Fix）：
  // Kimi 在"搜索"阶段时，新的 segment-assistant 容器已创建但 segment-content-box
  // 内容为空（或仅含加载指示器）。旧容器内的 .markdown 子元素没有被标记为
  // data-multiverse-old（标记在外层 div.segment.segment-assistant 上），
  // 导致 fallback 选择器捡到旧答案并误判为"已完成"。
  // 解决方案：提前检测"最新容器存在且内容为空 + 正在生成"的情况，直接返回 GENERATING。
  // ===================================================================
  if (provider === "kimi") {
    const latestSegments = Array.from(
      document.querySelectorAll("div.segment.segment-assistant"),
    ).filter((el) => !el.getAttribute("data-multiverse-old"));
    if (latestSegments.length > 0) {
      const latestSegment = latestSegments[latestSegments.length - 1];
      const contentBox = latestSegment.querySelector(
        ".segment-content-box, .markdown-container .markdown, .markdown",
      );
      const contentText = contentBox
        ? (contentBox.innerText || contentBox.textContent || "").trim()
        : (latestSegment.innerText || latestSegment.textContent || "").trim();
      if (contentText.length === 0) {
        const networkStatus = _networkStreamingStatus["kimi"];
        const timeSinceSend = Date.now() - (_lastSendTimes["kimi"] || 0);
        if (networkStatus?.isStreaming || timeSinceSend < 30000) {
          console.log(
            "[AI Multiverse] Kimi: New segment content is empty, search/generation in progress...",
          );
          return { status: AI_STATUS.GENERATING, text: "", html: "" };
        }
      }
    }
  }

  for (const sel of config.selectors.response) {
    try {
      const elements = Array.from(document.querySelectorAll(sel)).filter(
        (el) => !el.getAttribute("data-multiverse-old"),
      );

      if (elements.length === 0) continue;

      let element = elements[elements.length - 1];

      // Kimi 特殊处理
      if (provider === "kimi") {
        // 1. 如果选中的是 segment.segment-assistant，优先取其内部的
        //    .segment-content-box（真正的 markdown 内容），
        //    避免把 segment-assistant-actions 等 UI 壳层也纳入提取范围
        const contentBox = element.querySelector(
          ".segment-content-box, .markdown-container .markdown",
        );
        if (contentBox) {
          element = contentBox;
          console.log(
            "[AI Multiverse] Kimi: narrowed to segment-content-box, len=",
            (element.innerText || "").length,
          );
        }
      }

      // DeepSeek 特殊处理：
      // DeepSeek R1 先输出 THINK 片段（思考块），再输出 RESPONSE 片段（真正答案）。
      // 两者在 DOM 里可能共用同一个父容器，而 THINK 内容远比 RESPONSE 长，
      // 导致我们在找"最后一个 ds-markdown"时可能选到了思考块而非答案块。
      //
      // 策略：
      // 1. 找到所有非旧的 ds-markdown 元素
      // 2. 过滤掉位于思考块容器内部的那些（ds-thinking / ds-think 等）
      // 3. 如果过滤后有剩余，取最后一个作为真正的答案容器
      // 4. 如果过滤后为空（纯思考阶段），用原来选中的元素（思考块），
      //    此时 removeThinkingBlocks 会将其清空，触发 GENERATING 状态
      if (provider === "deepseek") {
        const allDs = Array.from(
          document.querySelectorAll(
            "div.ds-markdown, .ds-render-content, .ds-markdown--block",
          ),
        ).filter((el) => !el.getAttribute("data-multiverse-old"));

        if (allDs.length > 0) {
          // 过滤掉在思考块容器内的元素
          const responseOnly = allDs.filter((el) => {
            const inThink =
              el.closest('[class*="ds-think"]') ||
              el.closest('[class*="ds-thinking"]') ||
              el.closest("details") ||
              el.closest('[class*="think-block"]') ||
              el.closest('[class*="thinking-block"]');
            return !inThink;
          });

          if (responseOnly.length > 0) {
            // 取最后一个纯答案容器
            element = responseOnly[responseOnly.length - 1];
            console.log(
              `[AI Multiverse] DeepSeek: using RESPONSE container, len=${
                (element.innerText || "").length
              }`,
            );
          } else {
            // 仅有思考块，尚未开始输出答案
            console.log(
              "[AI Multiverse] DeepSeek: only THINK container found, waiting for RESPONSE...",
            );
            // 保持原来选中的元素，removeThinkingBlocks 会将其清空
          }
        }
      }

      // Walk UP to find the immediate wrapping container
      // ===================================================================
      // Bug Fix：原条件 parentText.length >= elText.length * 0.95 实际上"永远成立"
      // （因为父元素的文本必然 >= 子元素），导致会一路向上走到包含所有历史回复的大容器。
      // 正确逻辑：只有当父元素是"薄包装层"时才向上走——即子元素的文本量
      // 覆盖了父元素的 82% 以上（父元素只是多了一点外壳，没有包含其他内容）。
      // ===================================================================
      let current = element;
      for (let i = 0; i < 5; i++) {
        const parent = current.parentElement;
        if (!parent) break;
        const parentMatchesSel = config.selectors.response.some((s) => {
          try {
            return parent.matches(s);
          } catch (e) {
            return false;
          }
        });
        if (parentMatchesSel) {
          const parentText = (
            parent.innerText ||
            parent.textContent ||
            ""
          ).trim();
          const elText = (
            current.innerText ||
            current.textContent ||
            ""
          ).trim();

          // 检查父元素是否包含过多空白
          const parentLines = parentText.split("\n");
          const elLines = elText.split("\n");
          const parentEmptyLines = parentLines.filter(
            (l) => l.trim() === "",
          ).length;
          const elEmptyLines = elLines.filter((l) => l.trim() === "").length;

          // 如果父元素的空行比子元素多很多（超过3行），不要向上走
          if (parentEmptyLines - elEmptyLines > 3) {
            console.log(
              `[AI Multiverse] Skipping parent due to excessive blank lines (${parentEmptyLines} vs ${elEmptyLines})`,
            );
            break;
          }

          // 只有子元素文本 >= 父元素文本的82%时才向上走（父元素只是薄包装层）
          if (elText.length > 0 && elText.length >= parentText.length * 0.82) {
            element = parent;
            current = parent;
            continue;
          }
        }
        break;
      }

      const text = (element.innerText || element.textContent || "").trim();
      if (text.length > 0 || element.querySelector("svg, img, table")) {
        candidates.push({ element, text, selector: sel, length: text.length });
      }
    } catch (e) {}
  }

  if (candidates.length > 0) {
    // ===================================================================
    // Bug Fix：过滤掉是其他候选元素"祖先"的候选元素
    // 原因：宽泛选择器如 [data-role="assistant"] 可能匹配到包含所有历史回复
    // 的大容器，而更精确的选择器只匹配当前回复。过滤后，大容器被剔除，
    // 只保留最精确（最深层）的当前回复元素。
    // ===================================================================
    const filteredCandidates = candidates.filter(
      (c) =>
        !candidates.some(
          (other) => other !== c && c.element.contains(other.element),
        ),
    );
    const finalCandidates =
      filteredCandidates.length > 0 ? filteredCandidates : candidates;
    finalCandidates.sort((a, b) => b.length - a.length);
    bestEl = finalCandidates[0].element;
    bestSelector = finalCandidates[0].selector;
  }

  // Fallback: try common containers
  if (!bestEl) {
    // ===================================================================
    // Bug Fix（Kimi / 通用）：
    // 若所有主选择器均未命中（新 segment 尚未建立，正处于搜索阶段），
    // 且距离发送时间 < 30s，则直接返回 GENERATING，
    // 避免下方 fallback 选择器捡到旧 segment 内部的 .markdown 子元素。
    // ===================================================================
    const _timeSinceSendFallback = Date.now() - (_lastSendTimes[provider] || 0);
    if (provider === "kimi" && _timeSinceSendFallback < 30000) {
      console.log(
        "[AI Multiverse] Kimi: no new segment found yet, returning GENERATING to avoid stale fallback",
      );
      return { status: AI_STATUS.GENERATING, text: "", html: "" };
    }

    const fallbackSelectors = [
      ".markdown-body:not([data-multiverse-old])",
      '[class*="markdown"]:not([data-multiverse-old])',
      '[class*="message-content"]:not([data-multiverse-old])',
      '[class*="assistant"]:not([data-multiverse-old])',
    ];
    for (const sel of fallbackSelectors) {
      try {
        const elements = Array.from(document.querySelectorAll(sel)).filter(
          // ── 祖先过滤 ──────────────────────────────────────────────────
          // CSS :not([data-multiverse-old]) 只检查元素自身，不检查祖先。
          // 旧容器（如 div.segment.segment-assistant）的子元素（如 .markdown）
          // 自身没有该标记，会被选中，导致展示旧内容。
          // 此处追加 JS 层过滤：排除任何祖先带有 data-multiverse-old 的元素。
          (el) => !el.closest("[data-multiverse-old]"),
        );
        if (elements.length > 0) {
          bestEl = elements[elements.length - 1];
          break;
        }
      } catch (e) {}
    }
  }

  // ── Gemini 专用最终兜底 ────────────────────────────────────────────────────
  // 当所有选择器均失败时（可能因为所有 model-response 都被标为 data-multiverse-old，
  // 但 Gemini Angular 框架在更新时复用了同一个元素而非创建新元素），
  // 忽略 data-multiverse-old 标记，直接取最后一个有实际内容的 model-response。
  // 这是绝对最后的兜底，只在确实找不到任何元素时才触发。
  //
  // ⚠️ 关键约束：以下两种情况下绝不启用此兜底：
  //   1. 网络层仍在流式传输（streaming_started 已收到但 streaming_completed 未收到）
  //   2. 发送后 90 秒内（给智能总结等长文本回复足够的生成时间）
  //
  // 原因：新问题发送后，旧的 model-response 元素已被标为 data-multiverse-old，
  // 新元素尚未出现（或为空）。若此时忽略 data-multiverse-old 直接取旧元素，
  // 会把上一次的答案误判为正在生成的内容，导致面板展示旧回答。
  // 智能总结场景：Gemini 需处理大量文本，生成时间可能超过 30-60s，
  // 因此将时间窗口从 15s 延长到 90s，并优先依赖网络流式状态判断。
  if (!bestEl && provider === "gemini") {
    const _geminiTimeSinceSend = Date.now() - (_lastSendTimes["gemini"] || 0);
    const _geminiNetworkStatus = _networkStreamingStatus["gemini"];
    // 条件1：网络层正在流式传输 → 必然在生成中，直接抑制
    const _geminiIsStreaming = _geminiNetworkStatus?.isStreaming === true;
    // 条件2：流式传输刚完成（completedAt 在 3s 内）→ DOM 可能还未更新，继续抑制
    const _geminiJustCompleted =
      _geminiNetworkStatus?.isStreaming === false &&
      _geminiNetworkStatus?.endTime &&
      Date.now() - _geminiNetworkStatus.endTime < 3000;
    // 条件3：时间窗口内（90s），兜底处于无信号的盲区，保守抑制
    const _geminiInTimeWindow = _geminiTimeSinceSend < 90000;

    if (_geminiIsStreaming || _geminiJustCompleted || _geminiInTimeWindow) {
      // 新问题刚发出 / 正在生成中，绝不显示旧内容，直接返回空白生成状态
      console.log(
        `[AI Multiverse] Gemini: suppressing last-resort fallback` +
          ` (streaming=${_geminiIsStreaming}, justCompleted=${_geminiJustCompleted},` +
          ` timeSinceSend=${_geminiTimeSinceSend}ms)`,
      );
      return { status: AI_STATUS.GENERATING, text: "", html: "" };
    }
    try {
      const allModelResponses = Array.from(
        document.querySelectorAll(
          "model-response, ms-model-response, message-content",
        ),
      );
      if (allModelResponses.length > 0) {
        // 优先选有实际文字内容的最后一个
        const nonEmpty = allModelResponses.filter(
          (el) => (el.innerText || el.textContent || "").trim().length > 10,
        );
        if (nonEmpty.length > 0) {
          bestEl = nonEmpty[nonEmpty.length - 1];
          console.log(
            "[AI Multiverse] Gemini: last-resort fallback (ignoring data-multiverse-old), element:",
            bestEl.tagName,
            "len:",
            (bestEl.innerText || "").length,
          );
        } else if (allModelResponses.length > 0) {
          bestEl = allModelResponses[allModelResponses.length - 1];
          console.log(
            "[AI Multiverse] Gemini: last-resort fallback (empty element), element:",
            bestEl.tagName,
          );
        }
      }
    } catch (e) {}
  }

  if (!bestEl) {
    // Return generating status if we just sent a message recently without warning
    const now = Date.now();
    const timeSinceSend = now - (_lastSendTimes[provider] || 0);

    if (timeSinceSend < 5000) {
      // Silence warnings for the first 5 seconds while waiting for AI to start
      return { status: AI_STATUS.GENERATING, text: "", html: "" };
    }

    // Special handling for ChatGPT - extend timeout and reduce warning frequency
    const timeoutThreshold = provider === "chatgpt" ? 60000 : 30000; // 60s for ChatGPT, 30s for others
    
    // Check network streaming status for ChatGPT
    const networkStatus = _networkStreamingStatus[provider];
    const isStreaming = networkStatus?.isStreaming === true;
    
    if (timeSinceSend < timeoutThreshold || isStreaming) {
      // Only show warning every 15 seconds for ChatGPT, every 10 seconds for others
      const warningInterval = provider === "chatgpt" ? 15000 : 10000;
      const shouldShowWarning = Math.floor(timeSinceSend / warningInterval) > Math.floor((timeSinceSend - 1000) / warningInterval);
      
      // Suppress warning if network is actively streaming
      if (shouldShowWarning && !isStreaming) {
        console.warn(`[AI Multiverse] Still waiting for ${provider} response... (${Math.floor(timeSinceSend / 1000)}s)`);
      } else if (isStreaming) {
        console.log(`[AI Multiverse] ${provider} is actively streaming (${Math.floor(timeSinceSend / 1000)}s)`);
      }
      return { status: AI_STATUS.GENERATING, text: "", html: "" };
    }

    console.warn(
      "[AI Multiverse] No response element found for provider:",
      provider,
    );
    console.warn("[AI Multiverse] Page title:", document.title);
    console.warn(
      "[AI Multiverse] Available selectors:",
      config.selectors.response,
    );
    return { status: AI_STATUS.NOT_OPEN, text: "", html: "" };
  }

  const lastEl = bestEl;

  // Remove thinking/reasoning blocks from the DOM element
  const cleanedEl = removeThinkingBlocks(lastEl, provider);

  // Extract text content from cleaned element
  const text = cleanedEl.innerText || cleanedEl.textContent || "";
  let trimmed = text.trim();

  // Additional text-based filtering for embedded thinking content
  trimmed = filterThinkingText(trimmed);

  // ── Yuanbao 深度思考内容过滤 ────────────────────────────────────────────
  // removeThinkingBlocks 已在 DOM 层移除 .hyc-component-deepsearch-cot__think，
  // 但 Yuanbao 可能更新了结构，在此用文本兜底：移除"深度思考"块直到正文开始。
  if (provider === "yuanbao") {
    // 方式1：移除以"深度思考"/"已深度思考"开头的整个段落块（直到空行或下一大段）
    trimmed = trimmed.replace(/^已?深度思考[\s\S]*?(?=\n{2,}|$)/, "").trim();
    // 方式2：移除行首为"深度思考"的单行标签（含括号内容，如"已深度思考(用时3秒)"）
    trimmed = trimmed.replace(/^已?深度思考[（(][^）)]*[）)]?\s*/m, "").trim();
    trimmed = trimmed.replace(/^已?深度思考[：:：]?\s*/m, "").trim();
    // 方式3：移除连续的"思考中..."/"正在思考"等状态文本
    trimmed = trimmed
      .replace(/^(思考中|正在思考|深度思考中)[.…。]*\s*/m, "")
      .trim();
    // 方式4：移除"已完成深度搜索(用时N秒)"标题行
    trimmed = trimmed
      .replace(/^已完成深度搜索[（(][^）)]*[）)]\s*/m, "")
      .trim();
  }

  // ── Gemini "Gemini说" / "Gemini says" 前缀清理 ──────────────────────────
  // 当 model-response 的宽泛选择器生效时，可能把页面顶部的 AI 名称标签
  // 一同提取进来，形如 "Gemini说\n实际回答内容"。
  if (provider === "gemini") {
    // 移除行首的 "Gemini说"、"Gemini 说"、"Gemini says"、"Gemini:" 等变体
    trimmed = trimmed
      .replace(/^Gemini\s*(?:说|说：|说:|says|says:|：|:)\s*/i, "")
      .trim();
    // 移除单独成行的 "Gemini"（名称行后紧跟实际内容）
    trimmed = trimmed.replace(/^Gemini\s*\n+/i, "").trim();
  }

  // Clean up excessive blank lines (3+ consecutive newlines -> 2)
  trimmed = trimmed.replace(/\n{3,}/g, "\n\n");

  // Remove ALL leading blank lines and whitespace (特别针对 Gemini)
  // 使用更激进的方法：移除开头所有的空行、空白字符、换行符
  trimmed = trimmed.replace(
    /^[\s\n\r\t\u00A0\u2000-\u200B\u2028\u2029\u3000]+/,
    "",
  );

  // Remove trailing blank lines
  trimmed = trimmed.replace(/[\s\n\r]+$/, "");

  // Get the HTML content - clone to avoid modifying original page
  const clonedEl = cleanedEl.cloneNode(true);

  // ── 第一步：移除会破坏卡片布局的危险元素 ────────────────────────────────
  // 移除注入的 <style>/<script>/<link> 标签，防止其影响整个页面样式
  try {
    clonedEl
      .querySelectorAll('style, script, link[rel="stylesheet"]')
      .forEach((el) => el.remove());
  } catch (e) {}

  // 移除所有 style 属性中的 position:fixed/absolute/sticky（会让内容飞出卡片）
  // 以及 width/height 超大值（会撑破卡片）
  try {
    clonedEl.querySelectorAll("[style]").forEach((el) => {
      let s = el.getAttribute("style") || "";
      // 移除 position fixed/absolute/sticky
      s = s.replace(/position\s*:\s*(fixed|absolute|sticky)\s*;?/gi, "");
      // 移除超大 width（>100%或>800px）
      s = s.replace(/width\s*:\s*(\d{4,}px|[2-9]\d{2,}%)[^;]*;?/gi, "");
      // 移除负 margin（会让内容超出容器）
      s = s.replace(/margin[^:]*:\s*-\d+[^;]*;?/gi, "");
      if (s.trim()) {
        el.setAttribute("style", s);
      } else {
        el.removeAttribute("style");
      }
    });
  } catch (e) {}

  // ── 第二步：移除按钮、复制图标等无关 UI 元素 ─────────────────────────────
  const unwantedSelectors = [
    "button",
    '[role="button"]',
    ".copy-btn",
    ".download-btn",
    '[class*="copy"]',
    '[class*="Copy"]',
    '[class*="download"]',
    '[class*="Download"]',
    '[aria-label*="copy"]',
    '[aria-label*="Copy"]',
    '[aria-label*="\u590d\u5236"]',
    '[aria-label*="\u4e0b\u8f7d"]',
    '[title*="copy"]',
    '[title*="Copy"]',
    '[title*="\u590d\u5236"]',
    '[title*="\u4e0b\u8f7d"]',
    // ── DeepSeek 搜索引用角标（-1、-5、-9 之类的上标引用编号）────────────
    // DeepSeek 搜索模式在正文中插入超链接引用角标，提取到卡片后无法跳转，
    // 且其内部文本格式为 "-数字"，拼接后形成 "-1-5-9" 噪音，统一移除。
    '[class*="ds-footnote"]',
    '[class*="footnote-ref"]',
    '[class*="citation-tag"]',
    '[class*="citation-link"]',
    '[class*="citation-marker"]',
    '[class*="search-citation"]',
    '[class*="reference-tag"]',
    // ── Yuanbao 深度搜索引用来源区域（含网站图标/logo 图片）──────────────
    // 深度搜索完成后会在底部插入参考资料列表，其中包含来源网站的 favicon/图标，
    // 这些图标不属于回答正文，需要整块移除。
    '[class*="deepsearch-sources"]',
    '[class*="deepSearch-sources"]',
    '[class*="source-list"]',
    '[class*="sourceList"]',
    '[class*="reference-list"]',
    '[class*="referenceList"]',
    '[class*="cite-list"]',
    '[class*="citeList"]',
    '[class*="search-source"]',
    '[class*="searchSource"]',
    '[class*="web-search-result"]',
  ];
  unwantedSelectors.forEach((selector) => {
    try {
      clonedEl.querySelectorAll(selector).forEach((el) => el.remove());
    } catch (e) {}
  });

  // ── DeepSeek 引用角标兜底清理 ─────────────────────────────────────────────
  // 上方选择器依赖 class 名，若 DeepSeek 混淆了类名则会漏掉。
  // 兜底：遍历所有 <sup> 子元素，若其文本内容匹配 "-数字" 格式（DeepSeek 引用
  // 角标的内部格式），则直接移除该元素。
  if (provider === "deepseek") {
    try {
      clonedEl.querySelectorAll("sup").forEach((sup) => {
        const t = (sup.innerText || sup.textContent || "").trim();
        // 匹配 "-1"、"-15"、"-1-5-9" 等纯负数/多段负数格式
        if (/^(-\d+)+$/.test(t)) {
          sup.remove();
        }
      });
    } catch (e) {}
  }

  // 移除纯图标 SVG（复制/操作按钮）
  try {
    clonedEl.querySelectorAll("svg").forEach((svg) => {
      const parent = svg.parentElement;
      if (parent && parent.textContent.trim().length < 10) {
        const t = parent.textContent.trim().toLowerCase();
        if (t.includes("\u590d\u5236") || t.includes("copy") || t === "") {
          parent.remove();
        }
      }
    });
  } catch (e) {}

  // ── Yuanbao 专项：移除引用来源图片/图标（favicon 等）────────────────────
  // 元宝深度搜索的引用来源列表中包含来源网站的图标图片，
  // 这些图片不属于回答正文内容，统一移除。
  if (provider === "yuanbao") {
    try {
      // 移除所有 img 标签（来源图标、logo 等）
      clonedEl.querySelectorAll("img").forEach((img) => img.remove());
      // 移除包含链接 URL 的小图标容器（通常是 <a> 内的纯图标）
      clonedEl.querySelectorAll("a").forEach((a) => {
        const text = (a.innerText || a.textContent || "").trim();
        // 如果链接内几乎没有文字，只有图片/图标，则移除整个链接容器
        if (text.length < 5 && !a.querySelector("p, span, div")) {
          a.remove();
        }
      });
    } catch (e) {}
  }

  // ── 第三步：DOM 级别移除开头的空块元素（Gemini 等平台常见） ──────────────
  // 比正则更可靠：真正遍历 DOM 节点，移除开头所有内容为空的块级元素
  try {
    const blockTags = new Set([
      "P",
      "DIV",
      "BR",
      "SPAN",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "SECTION",
      "ARTICLE",
      "HEADER",
      "FOOTER",
    ]);
    let firstChild = clonedEl.firstChild;
    while (firstChild) {
      const next = firstChild.nextSibling;
      if (firstChild.nodeType === Node.TEXT_NODE) {
        if (firstChild.textContent.trim() === "") {
          clonedEl.removeChild(firstChild);
          firstChild = next;
          continue;
        }
        break; // 遇到有内容的文本节点，停止
      }
      if (firstChild.nodeType === Node.ELEMENT_NODE) {
        const tag = firstChild.tagName.toUpperCase();
        const isEmpty =
          firstChild.textContent.replace(/\u00a0/g, "").trim() === "" &&
          !firstChild.querySelector("img, video, audio, canvas, svg");
        if (blockTags.has(tag) && isEmpty) {
          clonedEl.removeChild(firstChild);
          firstChild = next;
          continue;
        }
      }
      break; // 遇到有内容的元素，停止
    }
  } catch (e) {}

  // ── Gemini "Gemini说" / "Gemini says" 前缀清理（HTML 层） ──────────────────
  // trimmed（文本）已在上方移除前缀，此处同步清理 clonedEl 的 DOM，
  // 确保 html 字段也不含 "Gemini说" 前缀，避免在卡片及详情弹窗中仍然显示。
  if (provider === "gemini") {
    try {
      // 遍历 clonedEl 开头的文本节点/元素节点，找到包含 "Gemini说" 前缀的节点并清除
      const geminiPrefixRe = /^Gemini\s*(?:说|说：|说:|says|says:|：|:)\s*/i;
      const geminiNameRe = /^Gemini\s*$/i;

      // 1. 处理直接的文本节点
      for (const node of Array.from(clonedEl.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const cleaned = node.textContent
            .replace(geminiPrefixRe, "")
            .replace(geminiNameRe, "");
          if (cleaned !== node.textContent) {
            node.textContent = cleaned;
          }
          if (node.textContent.trim()) break; // 遇到有内容节点停止
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const txt = (node.innerText || node.textContent || "").trim();
          // 若整个元素只包含 "Gemini说" 之类的前缀文字，直接移除该元素
          if (geminiPrefixRe.test(txt) || geminiNameRe.test(txt)) {
            // 确认该元素不含任何实质内容（移除前缀后为空）
            const afterClean = txt
              .replace(geminiPrefixRe, "")
              .replace(geminiNameRe, "")
              .trim();
            if (afterClean.length === 0) {
              node.remove();
              continue;
            }
          }
          // 尝试清理元素内的第一个文本节点
          const firstText = node.firstChild;
          if (firstText && firstText.nodeType === Node.TEXT_NODE) {
            const cleaned = firstText.textContent
              .replace(geminiPrefixRe, "")
              .replace(geminiNameRe, "");
            if (cleaned !== firstText.textContent) {
              firstText.textContent = cleaned;
            }
          }
          if ((node.innerText || node.textContent || "").trim()) break;
        }
      }
    } catch (e) {}
  }

  let html = clonedEl.innerHTML || "";

  if (!trimmed) {
    const fallbackText = (lastEl.innerText || lastEl.textContent || "").trim();
    if (fallbackText) {
      return {
        status: getGenerationStatus(provider, lastEl),
        text: fallbackText.replace(/\n{3,}/g, "\n\n"),
        html: html,
        length: fallbackText.length,
      };
    }
    // Content exists but is empty - likely still generating
    return { status: AI_STATUS.GENERATING, text: "", html: "" };
  }

  return {
    status: getGenerationStatus(provider, lastEl),
    text: trimmed,
    html: html,
    length: trimmed.length,
  };
}

// Track last known text per provider for change-based detection
const _lastResponseTexts = {};
const _stableCounters = {};
const _lastSendTimes = {}; // Track when the last prompt was sent
const _networkStreamingStatus = {}; // Track network-based streaming status

// Prevent duplicate submissions
const _submissionLock = {};
const SUBMISSION_LOCK_TIMEOUT = 5000; // 5 seconds timeout

// Helper: Check if element is effectively visible
function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return false;
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    parseFloat(style.opacity) > 0.1
  );
}

// Helper: Check if element is effectively disabled
function isElementDisabled(el) {
  if (!el) return true;
  const style = window.getComputedStyle(el);
  return (
    el.disabled ||
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.classList.contains("disabled") ||
    el.classList.contains("is-disabled") ||
    style.pointerEvents === "none" ||
    (style.opacity !== "" && parseFloat(style.opacity) < 0.45)
  );
}

// Reset tracking state for a provider when a new conversation starts
function resetProviderTracking(provider) {
  delete _lastResponseTexts[provider];
  delete _stableCounters[provider];
}

// === Status Detection (Network-First) ===
// 判断逻辑完全基于网络请求信号：
//   - background.js 的 webRequest 监听器在流式请求开始/结束时通知 content script
//   - 所有 7 个平台（gemini/grok/chatgpt/deepseek/kimi/qwen/yuanbao）均已在
//     API_PATTERNS 中配置了端点匹配规则
//   - 不再依赖 DOM 启发式（停止按钮选择器、光标动画等），避免平台改版后失效
//
// 如果某个平台的网络信号一直缺失，请提供该平台的 API 端点 URL，
// 将其添加到 background.js 的 API_PATTERNS 即可。

function getGenerationStatus(provider, lastEl) {
  const now = Date.now();
  const timeSinceSend = now - (_lastSendTimes[provider] || 0);

  // 0. 发送后 3 秒内的宽限期：避免在 AI 开始响应前误判为完成
  if (timeSinceSend < 3000) {
    console.log(`[AI Multiverse] ${provider}: Generating (grace period)`);
    return AI_STATUS.GENERATING;
  }

  const currentText = (lastEl?.innerText || lastEl?.textContent || "").trim();

  // 1. 【最高优先级】网络流式状态（最可靠）
  const networkStatus = _networkStreamingStatus[provider];
  if (networkStatus) {
    if (networkStatus.isStreaming) {
      // ─── Kimi / gRPC-HTTP2 安全阀 ───────────────────────────────────────
      // Kimi 使用 gRPC over HTTP/2，一次请求包含"搜索阶段"和"回答阶段"，
      // 搜索完成后有较长空档期（DOM 稳定但回答尚未开始），原来 6 周期
      // （约 4.8s）的阈值会在这个空档期误判为完成，导致实际回答被丢弃。
      //
      // 修复策略：
      //   - isStreaming=true 时：阈值提高到 60 周期（约 48s），覆盖 Kimi
      //     搜索→回答之间最长的空档期；同时设置最大超时兜底（180s）
      //   - 非 Kimi 平台维持原来 6 周期，不影响其他模型
      if (currentText.length > 0) {
        if (currentText !== _lastResponseTexts[provider]) {
          _lastResponseTexts[provider] = currentText;
          _stableCounters[provider] = 0;
        } else {
          _stableCounters[provider] = (_stableCounters[provider] || 0) + 1;
        }
        // Kimi 需要更高的稳定阈值，避免搜索空档期误判
        const stableThreshold = provider === "kimi" ? 60 : 6;
        // 最大超时保护：Kimi 超过 180s 仍未 onCompleted，强制完成
        const maxTimeout = provider === "kimi" ? 180000 : 60000;
        const isMaxTimeout = timeSinceSend > maxTimeout;

        if (_stableCounters[provider] >= stableThreshold || isMaxTimeout) {
          console.log(
            `[AI Multiverse] ${provider}: OK (stable ${_stableCounters[provider]} cycles` +
              (isMaxTimeout ? ", max timeout reached" : "") +
              `, gRPC safety valve)`,
          );
          return AI_STATUS.OK;
        }
      }
      console.log(
        `[AI Multiverse] ${provider}: Generating (network stream active, stable=${_stableCounters[provider] || 0})`,
      );
      return AI_STATUS.GENERATING;
    }

    const timeSinceStreamEnd = now - (networkStatus.endTime || 0);
    if (timeSinceStreamEnd < 800) {
      // 流刚结束，DOM 可能还在渲染最后几段内容（React/Vue 框架有渲染延迟）
      console.log(
        `[AI Multiverse] ${provider}: Generating (stream ended ${timeSinceStreamEnd}ms ago, waiting for DOM)`,
      );
      return AI_STATUS.GENERATING;
    }
    // 流结束超过 800ms → 落入内容稳定性检测
    // ─── DeepSeek R1 / 长思考块安全阀 ──────────────────────────────────────
    // DeepSeek R1 先输出几千字的思考块，思考结束后有 1-2s 停顿，
    // 随后才开始输出真正的答案。停顿期间内容看似"稳定"，
    // 若此时通过稳定计数器判为完成，答案内容将全部丢失。
    // 解决方案：流结束后 5 秒内，要求更多稳定周期（6 次，约 4.8s），
    // 确保思考块 → 答案 的过渡期被覆盖。
    if (timeSinceStreamEnd < 5000) {
      if (currentText !== _lastResponseTexts[provider]) {
        _lastResponseTexts[provider] = currentText;
        _stableCounters[provider] = 0;
        console.log(
          `[AI Multiverse] ${provider}: Generating (post-stream content changing, len=${currentText.length})`,
        );
        return AI_STATUS.GENERATING;
      }
      _stableCounters[provider] = (_stableCounters[provider] || 0) + 1;
      console.log(
        `[AI Multiverse] ${provider}: Post-stream stable ${_stableCounters[provider]}/6`,
      );
      if (_stableCounters[provider] >= 6) {
        console.log(
          `[AI Multiverse] ${provider}: OK (post-stream stable 6 cycles)`,
        );
        return AI_STATUS.OK;
      }
      return AI_STATUS.GENERATING;
    }
    // 流结束超过 5s → 正常 3 周期稳定即可完成
  }

  // 2. 内容存在性检查
  // 若网络信号缺失（例如 API_PATTERNS 未匹配到当前端点），此处作为安全兜底
  if (currentText.length === 0) {
    if (timeSinceSend < 15000) {
      console.log(
        `[AI Multiverse] ${provider}: Generating (waiting for content)`,
      );
      return AI_STATUS.GENERATING;
    }
    console.log(`[AI Multiverse] ${provider}: NOT_OPEN (no content after 15s)`);
    return AI_STATUS.NOT_OPEN;
  }

  // 3. 内容稳定性检测：连续 3 次轮询（~2.4s）内容不变则判为完成
  if (currentText !== _lastResponseTexts[provider]) {
    _lastResponseTexts[provider] = currentText;
    _stableCounters[provider] = 0;
    console.log(
      `[AI Multiverse] ${provider}: Generating (content changing, length: ${currentText.length})`,
    );
    return AI_STATUS.GENERATING;
  }

  _stableCounters[provider] = (_stableCounters[provider] || 0) + 1;
  console.log(
    `[AI Multiverse] ${provider}: Stable for ${_stableCounters[provider]}/3 cycles`,
  );

  if (_stableCounters[provider] >= 3) {
    console.log(`[AI Multiverse] ${provider}: OK (content stable 3 cycles)`);
    return AI_STATUS.OK;
  }

  return AI_STATUS.GENERATING;
}

// === Main Handler ===
async function handleFillAndSend(text, provider, files = []) {
  // Check if already submitting for this provider
  const now = Date.now();
  if (
    _submissionLock[provider] &&
    now - _submissionLock[provider] < SUBMISSION_LOCK_TIMEOUT
  ) {
    console.log(
      `[AI Multiverse] Submission already in progress for ${provider}, skipping duplicate`,
    );
    return; // Skip duplicate submission
  }

  // Acquire submission lock
  _submissionLock[provider] = now;

  // 0. Mark send time IMMEDIATELY to prevent early status completion
  _lastSendTimes[provider] = Date.now();

  console.log("[AI Multiverse Content] handleFillAndSend called");
  console.log("[AI Multiverse Content] Provider:", provider);
  console.log("[AI Multiverse Content] Text length:", text?.length);
  console.log(
    "[AI Multiverse Content] Text first 300 chars:",
    text?.substring(0, 300),
  );
  console.log("[AI Multiverse Content] Files count:", files?.length);

  // Input validation
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Invalid text input");
  }
  if (!provider || typeof provider !== "string") {
    throw new Error("Invalid provider");
  }
  if (!files || !Array.isArray(files)) {
    console.warn("[AI Multiverse] Invalid files array, treating as empty");
    files = [];
  }

  let config = null;

  // 1. Try to find config by provider ID passed from background
  console.log(
    "[AI Multiverse] Looking for config, AI_CONFIG defined:",
    typeof AI_CONFIG !== "undefined",
  );
  if (typeof AI_CONFIG !== "undefined" && AI_CONFIG[provider]) {
    config = AI_CONFIG[provider];
    console.log("[AI Multiverse] Found config for provider:", provider);
  } else {
    // Fallback: try to match by URL if provider ID is missing or invalid
    if (typeof AI_CONFIG !== "undefined") {
      for (const key in AI_CONFIG) {
        const conf = AI_CONFIG[key];
        // Simple check: is the domain matching?
        // urlPattern: *://gemini.google.com/*
        const domain = conf.urlPattern
          .replace("*://", "")
          .replace("/*", "")
          .split("/")[0];
        if (window.location.hostname.includes(domain)) {
          config = conf;
          break;
        }
        if (conf.urlPatternAlt) {
          const domainAlt = conf.urlPatternAlt
            .replace("*://", "")
            .replace("/*", "")
            .split("/")[0];
          if (window.location.hostname.includes(domainAlt)) {
            config = conf;
            break;
          }
        }
      }
    }
  }

  if (!config) {
    console.warn(
      "No specific configuration found for this site, using strict defaults.",
    );
    config = {
      selectors: {
        input: ["textarea", 'div[contenteditable="true"]'],
        button: ['button[type="submit"]'],
      },
      sendMethod: "enter",
      fillMethod: "main-world",
    };
  } else if (!config.selectors) {
    // Should not happen if config is valid
    config.selectors = { input: [], button: [] };
  }

  // 0. Mark existing responses as old
  if (config.selectors.response) {
    config.selectors.response.forEach((sel) => {
      try {
        document
          .querySelectorAll(sel)
          .forEach((el) => el.setAttribute("data-multiverse-old", "true"));
      } catch (e) {}
    });
  }

  // 1. Find Input Element
  let inputEl = null;
  for (let attempt = 0; attempt < MAX_INPUT_WAIT_ATTEMPTS; attempt++) {
    inputEl = findElement(config.selectors.input);
    if (inputEl) break;
    await delay(DELAY.LONG);
  }

  if (!inputEl) throw new Error("Input element not found");

  console.log("[AI Multiverse] Target input found:", inputEl.tagName);
  console.log("[AI Multiverse] fillMethod:", config.fillMethod);
  console.log("[AI Multiverse] sendMethod:", config.sendMethod);

  // 2. Fill it
  const isKimi =
    provider === "kimi" ||
    /kimi\.moonshot\.cn|kimi\.com/i.test(window.location.hostname);
  const isQwen =
    provider === "qwen" ||
    /qianwen|tongyi|qwen\.ai/i.test(window.location.hostname);
  const isGemini =
    provider === "gemini" ||
    /gemini\.google\.com/i.test(window.location.hostname);
  // 千问和 Kimi 的 UI 比较重，给它们更长的时间完成内部状态更新
  // Gemini 改用 paste 方式后，Quill 需要约 400ms 完成 Delta 更新和按钮激活
  const fillSettleDelay = isQwen ? 1200 : isKimi ? 800 : isGemini ? 600 : 50;

  if (config.fillMethod === "main-world") {
    await requestMainWorldFill(config.selectors.input[0], text, provider);
    await delay(fillSettleDelay);
  } else {
    await fillContentEditable(inputEl, text, provider);
    await delay(fillSettleDelay);
  }

  // 2.5 Upload files if provided
  if (files && files.length > 0 && config.supportsFiles) {
    console.log(
      "[AI Multiverse] Uploading",
      files.length,
      "files to",
      provider,
    );
    await uploadFiles(files, config, provider);
  }

  // 3. Send it
  // 千问特殊处理：在主世界（MAIN world）执行点击，和 Slate.js 同一上下文
  // 这样可以等待 React 状态更新后再点击，不受 content script 隔离限制
  if (isQwen) {
    console.log("[AI Multiverse] Qwen: requesting main world click");
    // 千问使用主世界点击，不重复调用 sendMessage
    await requestMainWorldClick(provider);
    // 等待确保消息发送完成 (增加等待时间到2秒)
    await delay(2000);
    // Release submission lock
    delete _submissionLock[provider];
    return;
  }
  await sendMessage(inputEl, config, provider);
  // Release submission lock
  delete _submissionLock[provider];
}

// Request background script to run executeScript in MAIN world
async function requestMainWorldFill(selector, text, provider) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "perform_main_world_fill",
        selector: selector,
        text: text,
        provider: provider, // Pass provider to use specific logic
      },
      (response) => {
        resolve(response);
      },
    );
  });
}

// Request background script to click button in MAIN world (for Qwen/Slate.js)
async function requestMainWorldClick(provider) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "perform_main_world_click",
        provider: provider,
      },
      (response) => {
        resolve(response);
      },
    );
  });
}

// === ContentEditable Fill (Pure Content Script version) ===
async function fillContentEditable(element, text, provider) {
  const isKimi =
    provider === "kimi" ||
    /kimi\.moonshot\.cn|kimi\.com/i.test(window.location.hostname);

  console.log("[AI Multiverse] fillContentEditable called for", provider);

  element.focus();
  element.click();
  await delay(DELAY.MEDIUM);

  try {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand("delete", false, null);

    if (element.innerText.trim().length > 0) {
      selection.selectAllChildren(element);
      document.execCommand("delete", false, null);
    }
  } catch (e) {}

  await delay(DELAY.SHORT);

  if (isKimi) {
    // ── Kimi 专属填充逻辑 ────────────────────────────────────────────────────
    // 诊断结论：
    //   1. innerText 直接赋值后 React reconciliation 会在 100ms 内把 DOM 重置为空
    //   2. execCommand("insertText") 遇到 \n 会拆成多段分别触发事件，内容混乱重复
    //   3. beforeinput/input 的 data 字段被 Kimi 编辑器当作"要插入的内容"执行
    // 方案：ClipboardEvent("paste") + DataTransfer 携带完整文本
    //   Kimi 的 onPaste 处理器读取 clipboardData 中的完整文本并写入 React state，
    //   多行文本完整保留，不截断，React state 正确更新。
    element.focus();
    // 先清空：selectAll + cut 触发 Kimi 的 cut 处理器清空 React state
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
    try {
      element.dispatchEvent(
        new ClipboardEvent("cut", { bubbles: true, cancelable: true }),
      );
    } catch (e) {}
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    } catch (e) {
      console.warn(
        "[AI Multiverse] Kimi fillContentEditable: paste failed:",
        e,
      );
    }
    console.log(
      "[AI Multiverse] Kimi fillContentEditable: fill completed via paste, length:",
      text.length,
    );
  } else {
    // 其他模型：沿用原始 execCommand 逻辑（Gemini/Grok/ChatGPT/Yuanbao 等）
    // ⚠️ 注意：execCommand("insertText") 对超过 5000 字符的长文本会静默截断。
    // 智能总结场景下提示词 + 全部 AI 回答可能超过 10000 字符，需要直接使用 textContent。
    let success = false;
    if (text.length <= 5000) {
      try {
        success = document.execCommand("insertText", false, text);
      } catch (e) {}
    }

    if (!success || element.innerText.trim().length === 0) {
      console.log(
        "[AI Multiverse] fillContentEditable: using textContent for text, length:",
        text.length,
      );
      element.textContent = text;
    }

    // Comprehensive events
    const events = ["input", "change", "blur", "keyup"];
    events.forEach((type) =>
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true })),
    );

    try {
      const inputEventInit = {
        bubbles: true,
        composed: true,
        data: text.substring(text.length - 1),
        inputType: "insertText",
      };
      element.dispatchEvent(new InputEvent("beforeinput", inputEventInit));
      element.dispatchEvent(new InputEvent("input", inputEventInit));
    } catch (e) {}
  }

  console.log("[AI Multiverse] fillContentEditable completed");
}

// === Send Message ===
async function sendMessage(inputEl, config, provider) {
  const isAsyncUI =
    provider === "deepseek" ||
    provider === "qwen" ||
    /deepseek|qwen|qianwen/i.test(window.location.hostname);
  const isGeminiSend =
    provider === "gemini" ||
    /gemini\.google\.com/i.test(window.location.hostname);
  const isQwen =
    provider === "qwen" ||
    /qianwen|tongyi\.aliyun|qwen\.ai/i.test(window.location.hostname);

  const clickButton = async () => {
    // Gemini 改用 paste 方式后，Quill 更新 Delta 需要约 400-600ms，
    // 因此增加等待次数和间隔，确保按钮从 disabled 变为 enabled 后再点击
    const maxAttempts = isGeminiSend
      ? 40
      : isAsyncUI
        ? MAX_BUTTON_WAIT_ATTEMPTS_ASYNC
        : MAX_BUTTON_WAIT_ATTEMPTS_SYNC;
    const interval = isGeminiSend
      ? 100
      : isAsyncUI
        ? BUTTON_WAIT_INTERVAL_ASYNC
        : BUTTON_WAIT_INTERVAL_SYNC;

    for (let i = 0; i < maxAttempts; i++) {
      const targetEl = findElement(config.selectors.button);
      if (targetEl) {
        console.log(
          "[AI Multiverse] Found button element:",
          targetEl.tagName,
          targetEl.className,
        );

        // 千问特殊处理：可能找到的是 SVG 或 span，需要找到真正的可点击元素
        let clickableBtn;
        if (isQwen) {
          if (
            targetEl.tagName === "svg" ||
            targetEl.tagName === "SVG" ||
            targetEl.tagName === "SPAN" ||
            targetEl.tagName === "DIV"
          ) {
            // 向上查找可点击的父元素
            clickableBtn =
              targetEl.closest("button") ||
              targetEl.closest('div[role="button"]') ||
              targetEl.closest('div[class*="Button"]') ||
              targetEl.closest('div[class*="send"]') ||
              targetEl.closest('div[class*="slot"]') ||
              targetEl.parentElement;
            console.log(
              "[AI Multiverse] Qwen: Found parent element:",
              clickableBtn
                ? `${clickableBtn.tagName}.${clickableBtn.className}`
                : "null",
            );
          } else {
            clickableBtn = targetEl;
          }
        } else {
          // 如果找到的是 SVG 等子元素，则提升到真正带点击行为的父节点
          clickableBtn =
            targetEl.tagName === "BUTTON" ||
            targetEl.getAttribute("role") === "button"
              ? targetEl
              : targetEl.closest("button") ||
                targetEl.closest('[role="button"]') ||
                targetEl.closest('div[class*="Btn"]') ||
                targetEl.closest('div[class*="slot"]') ||
                targetEl;
        }

        if (!clickableBtn) {
          console.log(
            "[AI Multiverse] Could not find clickable parent, attempt",
            i + 1,
          );
          await delay(interval);
          continue;
        }

        console.log(
          "[AI Multiverse] Clickable button:",
          clickableBtn.tagName,
          clickableBtn.className,
        );

        // 检查禁用标记，避免在按钮灰掉时强行连点
        // 千问特殊处理：只检测按钮本身，不用 closest 检查父容器
        // （Slate.js 外层容器可能有 disabled 样式类，但按钮本身应该可以点击）
        let isDisabled;
        if (isQwen) {
          isDisabled =
            clickableBtn.disabled ||
            clickableBtn.getAttribute("aria-disabled") === "true" ||
            clickableBtn.classList.contains("ant-btn-disabled");
          if (!isDisabled) {
            const opacity = parseFloat(
              window.getComputedStyle(clickableBtn).opacity,
            );
            if (!isNaN(opacity)) isDisabled = opacity < 0.3;
          }
          if (isDisabled) {
            console.log(
              `[AI Multiverse] Qwen: button not ready at attempt ${i}, waiting...`,
            );
          }
        } else if (isGeminiSend) {
          // Gemini 禁用态：优先看显式 disabled 标记，避免仅凭透明度误判
          isDisabled =
            clickableBtn.disabled ||
            clickableBtn.getAttribute("disabled") !== null ||
            clickableBtn.getAttribute("aria-disabled") === "true";
          // 某些版本会用 pointer-events 禁止点击
          if (!isDisabled) {
            const style = window.getComputedStyle(clickableBtn);
            if (style.pointerEvents === "none") isDisabled = true;
          }
          if (isDisabled) {
            console.log(
              `[AI Multiverse] Gemini: send button not ready at attempt ${i}, waiting...`,
            );
          }
        } else {
          isDisabled =
            clickableBtn.disabled ||
            clickableBtn.getAttribute("aria-disabled") === "true" ||
            clickableBtn.classList.contains("disabled") ||
            clickableBtn.classList.contains("ds-icon-button--disabled") ||
            clickableBtn.classList.contains("kimi-disabled") ||
            clickableBtn.closest('[class*="disabled"]');
        }

        if (!isDisabled) {
          console.log("[AI Multiverse] Button is enabled, clicking...");

          // 千问特殊处理：只使用事件序列，不调用.click()避免重复提交
          if (isQwen) {
            console.log("[AI Multiverse] Qwen: Using event sequence only");
            clickableBtn.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
            );
            await delay(50);
            clickableBtn.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
            );
            await delay(50);
            clickableBtn.dispatchEvent(
              new MouseEvent("click", { bubbles: true, cancelable: true }),
            );
            await delay(50);
            console.log("[AI Multiverse] Qwen: Click sequence completed");
          } else {
            // 模拟一次"正常人"点击：只触发一次 click 调用，杜绝多次发送
            await delay(DELAY.SHORT);

            // 特殊处理：对于非BUTTON元素，直接触发事件
            if (clickableBtn.tagName !== "BUTTON") {
              clickableBtn.dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true }),
              );
              clickableBtn.dispatchEvent(
                new MouseEvent("mouseup", { bubbles: true }),
              );
            }

            if (typeof clickableBtn.click === "function") {
              clickableBtn.click();
            } else {
              clickableBtn.dispatchEvent(
                new MouseEvent("click", {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                }),
              );
            }
          }

          console.log("[AI Multiverse] Button clicked successfully");
          return true;
        } else {
          console.log(
            "[AI Multiverse] Button not found or disabled, attempt",
            i + 1,
          );
        }
      }

      // Fallback: 如果异步 UI 的发送按钮长时间不激活，则尝试一次 Enter 提交
      // 注意：Kimi 明确只走“点击发送”，不做 Enter 回退，避免重复发送。
      if (isAsyncUI && provider !== "kimi" && i === 25) {
        console.log("[AI Multiverse] Fast fallback to Enter for", provider);
        sendEnterKey(inputEl);
        // 不立即 return，后续如果按钮激活，还会再尝试一次 click 以保证成功发送
      }

      await delay(interval);
    }
    return false;
  };

  switch (config.sendMethod) {
    case "form": {
      const form = inputEl.closest("form");
      if (form) {
        await delay(DELAY.SHORT);
        try {
          form.requestSubmit();
          return;
        } catch (e) {}
      }
      if (await clickButton()) return;
      sendEnterKey(inputEl);
      break;
    }
    case "button": {
      if (await clickButton()) {
        console.log("[AI Multiverse] Button click sequence executed");
      } else {
        console.log(
          "[AI Multiverse] Active button not found, falling back to Enter",
        );
        // 对 Kimi 不做 Enter 回退，只依赖按钮点击，符合“聚焦 → 粘贴 → 点击发送”的真实用户行为
        if (provider !== "kimi") {
          sendEnterKey(inputEl);
        }
      }
      break;
    }
    case "enter":
    default:
      // For Kimi and Qwen, ensure input is focused and wait a bit before sending Enter
      const isKimi =
        provider === "kimi" ||
        /kimi\.moonshot\.cn|kimi\.com/i.test(window.location.hostname);
      const isQwen =
        provider === "qwen" ||
        /qianwen|tongyi|qwen\.ai/i.test(window.location.hostname);

      if (isKimi || isQwen) {
        console.log(
          "[AI Multiverse]",
          isKimi ? "Kimi" : "Qwen",
          ": Ensuring focus before Enter",
        );
        inputEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        inputEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        inputEl.focus();
        inputEl.click();
        // Give extra time for framework state sync
        await delay(isQwen ? 1500 : 800);
      }

      // For Qwen, try button click first as it's more reliable
      if (isQwen) {
        console.log("[AI Multiverse] Qwen: Attempting button click first");
        const btnClicked = await clickButton();
        if (btnClicked) {
          console.log("[AI Multiverse] Qwen: Button click successful");
          return;
        }
        console.log(
          "[AI Multiverse] Qwen: Button click failed, falling back to Enter",
        );
      }

      sendEnterKey(inputEl);

      // 移除千问的备用点击逻辑，避免重复提交
      break;
  }
}

function sendEnterKey(el) {
  const opts = {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    charCode: 13,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  el.dispatchEvent(new KeyboardEvent("keydown", opts));
  el.dispatchEvent(new KeyboardEvent("keypress", opts));
  el.dispatchEvent(new KeyboardEvent("keyup", opts));
}

function findElement(selectors) {
  console.log("[AI Multiverse] findElement searching for:", selectors);
  // 1. Precise search (visible only)
  for (const sel of selectors) {
    try {
      const elements = Array.from(document.querySelectorAll(sel));
      // Find the LAST visible element (most recent)
      const visibleEl = elements.reverse().find((el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return (
          el.offsetParent !== null &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      });

      if (visibleEl) {
        console.log("[AI Multiverse] Found visible element:", sel);
        return visibleEl;
      }
    } catch (e) {}
  }
  // 2. Loose search
  for (const sel of selectors) {
    try {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) {
        const el = elements[elements.length - 1];
        console.log("[AI Multiverse] Found element (last in DOM):", sel);
        return el;
      }
    } catch (e) {}
  }
  console.log("[AI Multiverse] findElement returning null");
  return null;
}

// === File Upload Functions ===

/**
 * Helper function to convert Data URL to File object
 */
function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(",");
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
    console.warn("[AI Multiverse] No files to upload");
    return;
  }
  if (!config || !provider) {
    console.error("[AI Multiverse] Invalid config or provider");
    throw new Error("Invalid config or provider");
  }

  // Filter files based on provider's supported types
  const supportedFiles = filterSupportedFiles(files, config, provider);

  if (supportedFiles.length === 0) {
    console.warn("[AI Multiverse] No supported files for", provider);
    return;
  }

  if (supportedFiles.length < files.length) {
    console.warn(
      "[AI Multiverse] Filtered out unsupported files for",
      provider,
    );
  }

  // Upload each file with retry logic
  for (let i = 0; i < supportedFiles.length; i++) {
    const file = supportedFiles[i];
    console.log(
      "[AI Multiverse] Uploading file",
      i + 1,
      "/",
      supportedFiles.length,
      ":",
      file.name,
    );

    let lastError = null;
    let success = false;

    for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
      if (retry > 0) {
        console.log(
          "[AI Multiverse] Retry",
          retry,
          "/",
          MAX_RETRIES,
          "for",
          file.name,
        );
        await delay(DELAY.RETRY * retry); // Exponential backoff
      }

      try {
        await Promise.race([
          uploadSingleFile(file, config, provider),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Upload timeout")),
              UPLOAD_TIMEOUT,
            ),
          ),
        ]);
        console.log("[AI Multiverse] File uploaded successfully:", file.name);
        success = true;
      } catch (error) {
        lastError = error;
        console.error(
          "[AI Multiverse] Upload attempt",
          retry + 1,
          "failed:",
          file.name,
          error.message,
        );
      }
    }

    if (!success) {
      throw new Error(
        `File upload failed after ${MAX_RETRIES + 1} attempts: ${file.name} - ${lastError.message}`,
      );
    }
  }
}

/**
 * Filter files based on provider's supported types
 */
function filterSupportedFiles(files, config, provider) {
  if (!config.supportsFiles || !config.supportedFileTypes) {
    console.warn(
      "[AI Multiverse] Provider",
      provider,
      "does not support file uploads",
    );
    return [];
  }

  return files.filter((file) => {
    const fileType = file.type;
    const fileName = file.name;
    const supportedTypes = config.supportedFileTypes;

    for (const type of supportedTypes) {
      // Check MIME type exact match
      if (type === fileType) return true;

      // Check file extension
      if (type.startsWith(".")) {
        if (fileName.toLowerCase().endsWith(type.toLowerCase())) return true;
      } else if (type.startsWith(".*")) {
        const ext = type.substring(1);
        if (fileName.endsWith(ext)) return true;
      }

      // Check wildcard MIME type (e.g., image/*)
      if (type.endsWith("/*")) {
        const prefix = type.substring(0, type.length - 1);
        if (fileType.startsWith(prefix)) return true;
      }
    }

    console.warn(
      "[AI Multiverse] File not supported:",
      fileName,
      "| Type:",
      fileType,
      "| Provider:",
      provider,
    );
    return false;
  });
}

/**
 * Upload a single file
 */
async function uploadSingleFile(file, config, provider) {
  // Different upload strategies per provider
  switch (provider) {
    case "gemini":
      await uploadToGemini(file, config);
      break;
    case "chatgpt":
      await uploadToChatGPT(file, config);
      break;
    case "grok":
      await uploadToGrok(file, config);
      break;
    case "kimi":
      await uploadToKimi(file, config);
      break;
    case "deepseek":
      await uploadToDeepSeek(file, config);
      break;
    case "qwen":
      await uploadToQwen(file, config);
      break;
    case "yuanbao":
      await uploadToYuanbao(file, config);
      break;
    default:
      console.warn(
        "[AI Multiverse] Unknown provider for file upload:",
        provider,
      );
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
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

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

      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await delay(UPLOAD_DELAY);
      return;
    }
  }

  throw new Error("Could not find file upload mechanism for Gemini");
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

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await delay(UPLOAD_DELAY_LONG); // ChatGPT upload might take longer
    return;
  }

  throw new Error("Could not find file input for ChatGPT");
}

/**
 * Upload file to Grok
 */
async function uploadToGrok(file, config) {
  const uploadButton = findElement([
    'button[aria-label*="Upload"]',
    'button[aria-label*="上传"]',
    'button[title*="Upload"]',
  ]);

  if (uploadButton) {
    uploadButton.click();
    await delay(DELAY.LONG);

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const fileObj = dataURLtoFile(file.data, file.name);
      const dt = new DataTransfer();
      dt.items.add(fileObj);
      fileInput.files = dt.files;

      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await delay(UPLOAD_DELAY);
      return;
    }
  }

  throw new Error("Could not find file upload mechanism for Grok");
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

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await delay(UPLOAD_DELAY_LONG);
    return;
  }

  throw new Error("Could not find file input for Kimi");
}

/**
 * Upload file to DeepSeek
 */
async function uploadToDeepSeek(file, config) {
  const uploadButton = findElement([
    'button[aria-label*="image"]',
    'button[aria-label*="图片"]',
    'button[title*="image"]',
  ]);

  if (uploadButton) {
    uploadButton.click();
    await delay(DELAY.LONG);

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const fileObj = dataURLtoFile(file.data, file.name);
      const dt = new DataTransfer();
      dt.items.add(fileObj);
      fileInput.files = dt.files;

      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
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

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await delay(UPLOAD_DELAY);
    return;
  }

  throw new Error("Could not find file upload mechanism for DeepSeek");
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

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await delay(UPLOAD_DELAY_LONG);
    return;
  }

  throw new Error("Could not find file input for Qwen");
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

    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await delay(UPLOAD_DELAY_LONG);
    return;
  }

  throw new Error("Could not find file input for Yuanbao");
}
