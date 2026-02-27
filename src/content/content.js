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
    const deepSearchComponents = cloned.querySelectorAll(
      ".hyc-component-deepsearch-cot",
    );
    console.log(
      `[AI Multiverse] Found ${deepSearchComponents.length} deep search components in Yuanbao response`,
    );

    deepSearchComponents.forEach((component) => {
      // Remove only the thinking child, keep the answer content
      const thinkingSections = component.querySelectorAll(
        ".hyc-component-deepsearch-cot__think",
      );
      console.log(
        `[AI Multiverse] Removing ${thinkingSections.length} thinking sections from component`,
      );
      thinkingSections.forEach((el) => el.remove());
    });

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
    const fallbackSelectors = [
      ".markdown-body:not([data-multiverse-old])",
      '[class*="markdown"]:not([data-multiverse-old])',
      '[class*="message-content"]:not([data-multiverse-old])',
      '[class*="assistant"]:not([data-multiverse-old])',
    ];
    for (const sel of fallbackSelectors) {
      try {
        const elements = document.querySelectorAll(sel);
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
  if (!bestEl && provider === "gemini") {
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

    if (timeSinceSend < 30000) {
      console.warn(`[AI Multiverse] Still waiting for ${provider} response...`);
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
  // Skip aggressive text filtering for Yuanbao to preserve content
  if (provider !== "yuanbao") {
    trimmed = filterThinkingText(trimmed);
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
  ];
  unwantedSelectors.forEach((selector) => {
    try {
      clonedEl.querySelectorAll(selector).forEach((el) => el.remove());
    } catch (e) {}
  });

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
      // gRPC over HTTP/2 的 onCompleted 有时不会触发（持久连接复用），
      // 导致 isStreaming 永远为 true。
      // 当内容已经连续稳定 6 个周期（约 4.8s）时，强制判定为完成。
      if (currentText.length > 0) {
        if (currentText !== _lastResponseTexts[provider]) {
          _lastResponseTexts[provider] = currentText;
          _stableCounters[provider] = 0;
        } else {
          _stableCounters[provider] = (_stableCounters[provider] || 0) + 1;
        }
        if (_stableCounters[provider] >= 6) {
          console.log(
            `[AI Multiverse] ${provider}: OK (stable 6 cycles despite isStreaming=true, gRPC safety valve)`,
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
  // 千问和 Kimi 的 UI 比较重，给它们更长的时间完成内部状态更新
  const fillSettleDelay = isQwen ? 1200 : isKimi ? 800 : 50;

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

  let success = false;
  try {
    success = document.execCommand("insertText", false, text);
  } catch (e) {}

  if (!success || element.innerText.trim().length === 0) {
    if (isKimi) element.innerText = text;
    else element.textContent = text;
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

  console.log("[AI Multiverse] fillContentEditable completed");
}

// === Send Message ===
async function sendMessage(inputEl, config, provider) {
  const isAsyncUI =
    provider === "deepseek" ||
    provider === "qwen" ||
    /deepseek|qwen|qianwen/i.test(window.location.hostname);
  const isGemini =
    provider === "gemini" ||
    /gemini\.google\.com/i.test(window.location.hostname);
  const isQwen =
    provider === "qwen" ||
    /qianwen|tongyi\.aliyun|qwen\.ai/i.test(window.location.hostname);

  const clickButton = async () => {
    // Gemini 使用更短的等待时间，因为它的按钮通常很快就可用
    const maxAttempts = isGemini
      ? 20
      : isAsyncUI
        ? MAX_BUTTON_WAIT_ATTEMPTS_ASYNC
        : MAX_BUTTON_WAIT_ATTEMPTS_SYNC;
    const interval = isGemini
      ? 50
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
