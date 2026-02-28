// 1. Import shared configuration FIRST to ensure global constants are available
try {
  importScripts("config.js");
} catch (e) {
  console.warn("[Background] Could not import config.js directly:", e);
}

// 2. Global Status Constants (Fallback if config.js failed to load)
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

/**
 * Enhanced Message Sending with Retry & Timeout
 */
async function sendMessageWithRetry(
  tabId,
  message,
  maxRetries = 2,
  timeout = 12000,
) {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await Promise.race([
        chrome.tabs.sendMessage(tabId, message),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), timeout),
        ),
      ]);
    } catch (err) {
      const isTabClosed =
        err.message.includes("Could not establish connection") ||
        err.message.includes("receiving end does not exist");

      // If tab is closed or final retry, throw error
      if (isTabClosed || i === maxRetries) throw err;

      // Exponential backoff
      await delay(800 * Math.pow(1.5, i));

      // Re-verify tab still exists
      try {
        await chrome.tabs.get(tabId);
      } catch (e) {
        throw new Error("TAB_CLOSED");
      }
    }
  }
}

let popupWindowId = null;

// Track which windowId belongs to which provider
let providerWindows = {};
let summaryWindows = {}; // Track separate windows for summarization
let isSummarizing = {}; // Track if a provider is currently used for summarization
let savedLayout = {}; // Store saved window layouts

// === Extension Click/Command Behavior ===
async function togglePopup() {
  const popupUrl = chrome.runtime.getURL("src/sidepanel/sidepanel.html");
  let existingWin = null;

  // 1. Try to find existing popup by URL
  // First check tracked ID (fast path)
  if (popupWindowId !== null) {
    try {
      const win = await chrome.windows.get(popupWindowId);
      if (win) existingWin = win;
    } catch (e) {
      popupWindowId = null;
    }
  }

  // Fallback: Check all windows (robust path for service worker restart)
  if (!existingWin) {
    const windows = await chrome.windows.getAll({
      populate: true,
      windowTypes: ["popup"],
    });
    for (const win of windows) {
      if (
        win.tabs &&
        win.tabs.length > 0 &&
        win.tabs[0].url &&
        win.tabs[0].url.startsWith(popupUrl)
      ) {
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
      chrome.windows.update(existingWin.id, { state: "minimized" });
    } else {
      chrome.windows.update(existingWin.id, {
        focused: true,
        state: "normal",
        drawAttention: true,
      });
    }
  } else {
    // Open as a standalone popup window (app-like experience)
    const newWin = await chrome.windows.create({
      url: "src/sidepanel/sidepanel.html",
      type: "popup",
      width: 870, // Increased from 580 (50% wider)
      height: 800,
      focused: true,
    });
    popupWindowId = newWin.id;
  }
}

chrome.action.onClicked.addListener(togglePopup);

chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    togglePopup();
  }
});

// === Translations for Background Worker ===
const TRANSLATIONS = {
  en: {
    err_script_injection_failed: "Script injection failed",
    sent: "Sent!",
    err_prefix: "Error: ",
    closed_windows: "Closed {count} windows, {tabs} tabs",
  },
  "zh-CN": {
    err_script_injection_failed: "脚本注入失败",
    sent: "发送成功！",
    err_prefix: "错误：",
    closed_windows: "已关闭 {count} 个窗口，{tabs} 个标签页",
  },
};

let backgroundLang = "en";

// Load language preference
chrome.storage.local.get(["lang"], (result) => {
  backgroundLang = result.lang || "en";
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
    } catch (e) {
      popupWindowId = null;
    }
  }
  const popupUrl = chrome.runtime.getURL("src/sidepanel/sidepanel.html");
  const windows = await chrome.windows.getAll({ populate: true });
  for (const win of windows) {
    if (win.tabs && win.tabs.some((t) => t.url && t.url.startsWith(popupUrl))) {
      popupWindowId = win.id;
      return popupWindowId;
    }
  }
  return null;
}

// === Provider Configuration ===
const PROVIDER_CONFIG =
  typeof AI_CONFIG !== "undefined"
    ? AI_CONFIG
    : {
        gemini: {
          urlPattern: "*://gemini.google.com/*",
          baseUrl: "https://gemini.google.com/app",
        },
      };

// === Message Listener ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Proactively track/verify our window ID
  ensurePopupWindowId().then(() => {
    if (request.action === "broadcast_message") {
      handleBroadcast(request.message, request.providers);
      sendResponse({ status: "Processing..." });
    } else if (request.action === "tile_windows") {
      handleTileWindows(request.providers);
      sendResponse({ status: "Tiling..." });
    } else if (request.action === "launch_only_providers") {
      handleLaunchOnly(request.providers);
      sendResponse({ status: "Launching..." });
    } else if (request.action === "close_all_windows") {
      handleCloseAll();
      sendResponse({ status: "Closing..." });
    } else if (request.action === "open_popup_window") {
      chrome.windows
        .create({
          url: chrome.runtime.getURL("src/sidepanel/sidepanel.html"),
          type: "popup",
          width: 870, // Increased from 580 (50% wider)
          height: 800,
          focused: true,
        })
        .then((win) => {
          popupWindowId = win.id;
        });
      sendResponse({ status: "OK" });
    } else if (request.action === "diagnose_selectors") {
      handleDiagnoseSelectors(request.provider)
        .then((result) => {
          sendResponse(result);
        })
        .catch((err) => {
          sendResponse({ status: "error", error: err.message });
        });
      return true;
    } else if (request.action === "fetch_all_responses") {
      fetchAllResponses(request.providers)
        .then((responses) => {
          sendResponse({ status: "ok", responses });
        })
        .catch((err) => {
          sendResponse({ status: "error", error: err.message });
        });
      return true;
    } else if (request.action === "summarize_responses") {
      handleSummarizeResponses(request.provider, request.prompt)
        .then(() => {
          sendResponse({ status: "ok" });
        })
        .catch((err) => {
          sendResponse({ status: "error", error: err.message });
        });
      return true;
    } else if (request.action === "perform_main_world_fill") {
      if (sender.tab && sender.tab.id) {
        executeMainWorldFill(
          sender.tab.id,
          request.selector,
          request.text,
          request.provider,
        )
          .then(() => sendResponse({ status: "done" }))
          .catch((err) => {
            console.error("Main world fill error:", err);
            sendResponse({ status: "error", error: err.message });
          });
        return true;
      }
    } else if (request.action === "perform_main_world_click") {
      if (sender.tab && sender.tab.id) {
        executeMainWorldClick(sender.tab.id, request.provider)
          .then(() => sendResponse({ status: "done" }))
          .catch((err) => {
            console.error("Main world click error:", err);
            sendResponse({ status: "error", error: err.message });
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
    const isSummary = isSummarizing[providerKey];

    if (isSummary) {
      if (summaryWindows[providerKey]) {
        try {
          await chrome.windows.get(summaryWindows[providerKey].windowId);
          tabId = summaryWindows[providerKey].tabId;
        } catch (e) {
          delete summaryWindows[providerKey];
        }
      }
    } else {
      // Find chat tab for this provider
      if (providerWindows[providerKey]) {
        try {
          await chrome.windows.get(providerWindows[providerKey].windowId);
          tabId = providerWindows[providerKey].tabId;
        } catch (e) {
          delete providerWindows[providerKey];
        }
      }

      if (!tabId) {
        const config = PROVIDER_CONFIG[providerKey];
        const patternsToCheck = [config.urlPattern];
        if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
        if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

        // Critical filter to avoid matching all tabs if pattern is missing
        const uniquePatterns = [
          ...new Set(
            patternsToCheck.filter(
              (p) => typeof p === "string" && p.length > 0,
            ),
          ),
        ];

        // Ensure we don't accidentally pick up the summary tab as a chat tab
        const summaryTabIdToIgnore = summaryWindows[providerKey]
          ? summaryWindows[providerKey].tabId
          : -1;

        for (const pattern of uniquePatterns) {
          try {
            const tabs = await chrome.tabs.query({ url: pattern });
            // Skip internal extension tabs, current control panel, and the summary tab
            const validTab = tabs.find(
              (t) =>
                t.url &&
                !t.url.startsWith("chrome-extension://") &&
                t.windowId !== popupWindowId &&
                t.id !== summaryTabIdToIgnore,
            );
            if (validTab) {
              tabId = validTab.id;
              providerWindows[providerKey] = {
                windowId: validTab.windowId,
                tabId: tabId,
              };
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (!tabId) {
      results[providerKey] = {
        status: AI_STATUS.NOT_OPEN,
        text: "",
        name: PROVIDER_CONFIG[providerKey].name,
      };
      return;
    }

    try {
      // Ensure content script is injected
      await ensureContentScript(tabId);

      // Use enhanced message sending
      const response = await sendMessageWithRetry(tabId, {
        action: "extract_response",
        provider: providerKey,
      });

      results[providerKey] = {
        ...response,
        name: PROVIDER_CONFIG[providerKey].name,
        icon: PROVIDER_CONFIG[providerKey].icon,
      };
    } catch (err) {
      const isTimeout = err.message === "TIMEOUT";
      results[providerKey] = {
        status: isTimeout ? AI_STATUS.TIMEOUT : AI_STATUS.ERROR,
        text: "",
        error: err.message,
        name: PROVIDER_CONFIG[providerKey].name,
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
  const useSummaryTab = isSummarizing[provider];
  const targetWindows = useSummaryTab ? summaryWindows : providerWindows;

  if (targetWindows[provider]) {
    try {
      await chrome.windows.get(targetWindows[provider].windowId);
      tabId = targetWindows[provider].tabId;
    } catch (e) {
      delete targetWindows[provider];
    }
  }

  if (!tabId) {
    return { status: "error", error: "No tab open for this provider" };
  }

  try {
    // Ensure content script is injected
    await ensureContentScript(tabId);
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "diagnose_selectors",
      provider: provider,
    });
    return response;
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

// === Handle Summarize Responses ===
async function handleSummarizeResponses(provider, prompt) {
  console.log("[AI Multiverse Background] handleSummarizeResponses called");
  console.log("[AI Multiverse Background] Provider:", provider);
  console.log("[AI Multiverse Background] Prompt length:", prompt?.length);
  console.log(
    "[AI Multiverse Background] Prompt first 300 chars:",
    prompt?.substring(0, 300),
  );
  console.log(
    "[AI Multiverse Background] Prompt last 300 chars:",
    prompt?.substring(prompt.length - 300),
  );

  if (!PROVIDER_CONFIG[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  isSummarizing[provider] = true;
  const config = PROVIDER_CONFIG[provider];

  let tabId = null;

  // Check saved summaryWindows
  if (summaryWindows[provider]) {
    try {
      await chrome.windows.get(summaryWindows[provider].windowId);
      tabId = summaryWindows[provider].tabId;
      console.log(
        "[AI Multiverse Background] Found existing summary tab:",
        tabId,
      );
    } catch (e) {
      console.log("[AI Multiverse Background] Saved summary window not found");
      delete summaryWindows[provider];
    }
  }

  // If no existing summary tab, create a new window for it
  if (!tabId) {
    console.log(
      "[AI Multiverse Background] Creating new window for summary:",
      provider,
    );
    const newWin = await chrome.windows.create({
      url: config.baseUrl,
      type: "normal",
      focused: false,
    });
    tabId = newWin.tabs[0].id;
    summaryWindows[provider] = { windowId: newWin.id, tabId: tabId };
    console.log("[AI Multiverse Background] Created summary tab:", tabId);

    // Wait for tab to load with timeout
    await waitForTabLoad(tabId, 30000);
    // Allow extra time for hydration
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("[AI Multiverse Background] Summary tab loaded");
  }

  // Ensure content script is injected
  await ensureContentScript(tabId);
  console.log("[AI Multiverse Background] Content script ensured");

  // Send the summarization prompt
  console.log(
    "[AI Multiverse Background] Sending fill_and_send message to tab",
    tabId,
  );
  await chrome.tabs.sendMessage(tabId, {
    action: "fill_and_send",
    text: prompt,
    provider: provider,
    files: [],
  });
  console.log("[AI Multiverse Background] Message sent successfully");
}

// === Main World Injection (Provider-Aware Fill) ===
async function executeMainWorldFill(tabId, selector, text, provider) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: "MAIN",
    args: [selector, text, provider || ""],
    func: (sel, val, providerName) => {
      const hostname = window.location.hostname;
      console.log(
        `[AI Multiverse] Filling ${providerName} with text, length:`,
        val.length,
      );

      // ── 通用：找到最后一个可见元素 ──────────────────────────────────────────
      const findEl = (selectors) => {
        if (typeof selectors === "string") selectors = [selectors];
        for (const s of selectors) {
          try {
            const elements = Array.from(document.querySelectorAll(s));
            const visibleEl = elements
              .reverse()
              .find(
                (el) =>
                  el.offsetParent !== null &&
                  el.getBoundingClientRect().width > 0,
              );
            if (visibleEl) return visibleEl;
            if (elements.length > 0) return elements[0];
          } catch (e) {}
        }
        return null;
      };

      // ════════════════════════════════════════════════════════════════════════
      // Gemini (Quill 编辑器 / contenteditable)
      // 策略：ClipboardEvent("paste") + DataTransfer 携带完整文本
      //
      // 原因：execCommand("insertText") 在 Quill 编辑器中对长文本存在以下问题：
      //   1. 文本超过一定长度时静默截断，导致提示词和 AI 回复内容丢失
      //   2. 包含特殊字符（如 ━、中文标点）时可能失败
      //   3. Quill 内部的 Delta 模型未更新，发送按钮一直保持禁用态，无法提交
      //
      // paste 方案：
      //   Quill 的 onPaste 处理器会读取 clipboardData 中的完整 text/plain 并
      //   正确写入内部 Delta 模型，任意长度文本均可完整填入，按钮随即激活。
      // ════════════════════════════════════════════════════════════════════════
      if (hostname.includes("gemini.google.com")) {
        const el = findEl([
          'div.ql-editor[contenteditable="true"]',
          'div[role="textbox"]',
          ".ql-editor",
          'div[contenteditable="true"]',
        ]);
        if (!el) return false;

        el.focus();

        // ── Step 1: 清空现有内容 ─────────────────────────────────────────────
        // selectAll + cut：让 Quill 的 cut 处理器把内部 Delta 也清空
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
        try {
          el.dispatchEvent(
            new ClipboardEvent("cut", { bubbles: true, cancelable: true }),
          );
        } catch (e) {}

        // 兜底：如果 cut 没清空，再用 execCommand delete
        try {
          if (el.innerText.trim().length > 0) {
            document.execCommand("selectAll", false, null);
            document.execCommand("delete", false, null);
          }
        } catch (e) {}

        el.focus();

        // ── 统一处理：分块使用 execCommand 填入完整文本 ───────────────────────
        // 无论长短文本，都使用 execCommand 分块插入。这样既不会被长度截断，也能完美激活发送按钮
        console.log(
          "[AI Multiverse] Gemini: using chunked execCommand for text, length:",
          val.length,
        );

        let success = true;
        const chunkSize = 4000;
        for (let i = 0; i < val.length; i += chunkSize) {
          const chunk = val.slice(i, i + chunkSize);
          try {
            const chunkSuccess = document.execCommand(
              "insertText",
              false,
              chunk,
            );
            if (!chunkSuccess) success = false;
          } catch (e) {
            console.warn(
              "[AI Multiverse] Gemini: execCommand failed for chunk:",
              e,
            );
            success = false;
          }
        }

        if (!success || el.innerText.trim().length === 0) {
          console.log(
            "[AI Multiverse] Gemini: execCommand failed, using textContent fallback",
          );
          el.textContent = val;
          try {
            el.dispatchEvent(
              new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: val,
              }),
            );
            el.dispatchEvent(
              new Event("input", { bubbles: true, composed: true }),
            );
            el.dispatchEvent(
              new Event("change", { bubbles: true, composed: true }),
            );
          } catch (e) {}
        }

        // ── Step 4: 补发 input / keyup 确保 Quill 按钮状态更新 ──────────────
        try {
          el.dispatchEvent(
            new Event("input", { bubbles: true, composed: true }),
          );
          el.dispatchEvent(
            new Event("change", { bubbles: true, composed: true }),
          );
          // keyup 触发 Gemini 内部"输入非空"检测，使发送按钮从 disabled → enabled
          el.dispatchEvent(
            new KeyboardEvent("keyup", {
              key: "a",
              code: "KeyA",
              bubbles: true,
              composed: true,
            }),
          );
        } catch (e) {}

        console.log(
          "[AI Multiverse] Gemini: fill completed, editor text length:",
          el.innerText.trim().length,
        );
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // Grok (TipTap / ProseMirror 编辑器)
      // 策略：分块 execCommand("insertText") 主路径，失败回退 textContent
      // ════════════════════════════════════════════════════════════════════════
      if (hostname.includes("grok.com")) {
        const tiptapList = Array.from(
          document.querySelectorAll("div.tiptap.ProseMirror"),
        );
        const el =
          tiptapList.reverse().find((e) => e.offsetParent !== null) ||
          tiptapList[0] ||
          null;
        if (!el) return false;

        el.focus();
        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
        } catch (e) {}
        el.focus();

        let success = true;
        const chunkSize = 4000;
        for (let i = 0; i < val.length; i += chunkSize) {
          const chunk = val.slice(i, i + chunkSize);
          try {
            const chunkSuccess = document.execCommand(
              "insertText",
              false,
              chunk,
            );
            if (!chunkSuccess) success = false;
          } catch (e) {
            console.warn(
              "[AI Multiverse] Grok: execCommand failed for chunk:",
              e,
            );
            success = false;
          }
        }

        if (!success || el.innerText.trim().length === 0) {
          console.log(
            "[AI Multiverse] Grok: execCommand failed, using textContent fallback",
          );
          el.textContent = val;
        }

        try {
          el.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: val,
            }),
          );
          el.dispatchEvent(
            new Event("input", { bubbles: true, composed: true }),
          );
          el.dispatchEvent(
            new Event("change", { bubbles: true, composed: true }),
          );
          const lastChar = val.slice(-1) || " ";
          el.dispatchEvent(
            new KeyboardEvent("keyup", {
              key: lastChar,
              bubbles: true,
              composed: true,
            }),
          );
        } catch (e) {}

        console.log("[AI Multiverse] Grok: fill completed");
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // Kimi (React contenteditable)
      // 策略：ClipboardEvent("paste") + DataTransfer 携带完整文本
      // 原因：
      //   1. innerText 直接赋值后 React reconciliation 会在 100ms 内把 DOM 重置为空
      //   2. execCommand("insertText") 遇到 \n 会拆成多段分别触发事件，内容混乱
      //   3. beforeinput/input 事件的 data 字段会被 Kimi 编辑器当作"要插入的内容"执行
      //   4. paste 事件：Kimi 的 onPaste 处理器会读取 clipboardData 中的完整文本
      //      并正确写入 React state，多行文本完整保留，不截断
      // ════════════════════════════════════════════════════════════════════════
      if (
        hostname.includes("kimi.moonshot.cn") ||
        hostname.includes("kimi.com")
      ) {
        const el = findEl([
          'div[contenteditable="true"]',
          "div.chat-input",
          'div[class*="input"]',
          'div[class*="editor"]',
        ]);
        if (!el) return false;

        el.focus();

        // 先清空现有内容：selectAll + cut 触发 Kimi 的 cut 处理器清空 React state
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
        try {
          el.dispatchEvent(
            new ClipboardEvent("cut", { bubbles: true, cancelable: true }),
          );
        } catch (e) {}

        // 用 paste 事件携带完整文本，Kimi 的 onPaste 正确更新 React state
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", val);
          el.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: dt,
              bubbles: true,
              cancelable: true,
            }),
          );
        } catch (e) {
          console.warn("[AI Multiverse] Kimi: paste event failed:", e);
        }

        console.log(
          "[AI Multiverse] Kimi: fill completed via paste, length:",
          val.length,
        );
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // DeepSeek (React textarea)
      // 策略：React value setter + valueTracker 欺骗，确保 React 感知到变化
      // 独立处理逻辑，不使用 insertText
      // ════════════════════════════════════════════════════════════════════════
      if (hostname.includes("chat.deepseek.com")) {
        const el = findEl([
          "textarea#chat-input",
          'textarea[placeholder*="DeepSeek"]',
          "textarea",
        ]);
        if (!el) return false;

        el.focus();
        const proto = HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) {
          setter.call(el, "");
        } else {
          el.value = "";
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));

        if (setter) setter.call(el, val);
        else el.value = val;
        if (el._valueTracker) el._valueTracker.setValue("");

        try {
          const lastChar = val.slice(-1) || " ";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
          el.dispatchEvent(
            new KeyboardEvent("keydown", { key: lastChar, bubbles: true }),
          );
          el.dispatchEvent(
            new KeyboardEvent("keyup", { key: lastChar, bubbles: true }),
          );
        } catch (e) {}

        console.log(
          "[AI Multiverse] DeepSeek: fill completed, length:",
          val.length,
        );
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // ChatGPT (React contenteditable div)
      // 策略：分块 execCommand("insertText") 主路径，失败回退 textContent
      // ════════════════════════════════════════════════════════════════════════
      if (hostname.includes("chatgpt.com")) {
        const el = findEl([
          "div#prompt-textarea",
          'div[contenteditable="true"][id="prompt-textarea"]',
          'div[contenteditable="true"]',
        ]);
        if (!el) return false;

        // ChatGPT 有时也用 textarea
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
          el.focus();
          const proto =
            el.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(el, "");
          else el.value = "";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          if (setter) setter.call(el, val);
          else el.value = val;
          if (el._valueTracker) el._valueTracker.setValue("");
          try {
            const lastChar = val.slice(-1) || " ";
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
            el.dispatchEvent(
              new KeyboardEvent("keydown", { key: lastChar, bubbles: true }),
            );
            el.dispatchEvent(
              new KeyboardEvent("keyup", { key: lastChar, bubbles: true }),
            );
          } catch (e) {}
        } else {
          el.focus();
          try {
            document.execCommand("selectAll", false, null);
            document.execCommand("delete", false, null);
          } catch (e) {}
          el.focus();
          let success = true;
          const chunkSize = 4000;
          for (let i = 0; i < val.length; i += chunkSize) {
            const chunk = val.slice(i, i + chunkSize);
            try {
              const chunkSuccess = document.execCommand(
                "insertText",
                false,
                chunk,
              );
              if (!chunkSuccess) success = false;
            } catch (e) {
              console.warn(
                "[AI Multiverse] ChatGPT: execCommand failed for chunk:",
                e,
              );
              success = false;
            }
          }

          if (!success || el.innerText.trim().length === 0) {
            console.log(
              "[AI Multiverse] ChatGPT: execCommand failed, using textContent fallback",
            );
            el.textContent = val;
          }
          try {
            el.dispatchEvent(
              new InputEvent("beforeinput", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: val,
              }),
            );
            el.dispatchEvent(
              new Event("input", { bubbles: true, composed: true }),
            );
            el.dispatchEvent(
              new Event("change", { bubbles: true, composed: true }),
            );
            const lastChar = val.slice(-1) || " ";
            el.dispatchEvent(
              new KeyboardEvent("keyup", {
                key: lastChar,
                bubbles: true,
                composed: true,
              }),
            );
          } catch (e) {}
        }

        console.log(
          "[AI Multiverse] ChatGPT: fill completed, length:",
          val.length,
        );
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // 通义千问 (Slate.js contenteditable)
      // 策略：beforeinput(insertText, data=全文) —— Slate 监听 beforeinput 更新内部 state
      // 注意：不能先手动写 DOM 再发 beforeinput，否则 Slate 会重复插入
      // 独立处理逻辑，不使用 insertText
      // ════════════════════════════════════════════════════════════════════════
      if (
        hostname.includes("qianwen") ||
        hostname.includes("tongyi.aliyun.com") ||
        hostname.includes("qwen.ai")
      ) {
        const el = findEl([
          'div[role="textbox"]',
          'div[data-slate-editor="true"]',
          'div[data-placeholder*="千问"]',
          "textarea#msg-input",
          "textarea",
        ]);
        if (!el) return false;

        // 千问有时也用 textarea
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
          el.focus();
          const proto =
            el.tagName === "TEXTAREA"
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(el, "");
          else el.value = "";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          if (setter) setter.call(el, val);
          else el.value = val;
          if (el._valueTracker) el._valueTracker.setValue("");
          try {
            const lastChar = val.slice(-1) || " ";
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
            el.dispatchEvent(
              new KeyboardEvent("keydown", { key: lastChar, bubbles: true }),
            );
            el.dispatchEvent(
              new KeyboardEvent("keyup", { key: lastChar, bubbles: true }),
            );
          } catch (e) {}
          console.log("[AI Multiverse] Qwen textarea: fill completed");
          return true;
        }

        // Slate.js contenteditable：全选 + beforeinput(insertText, data=全文)
        el.focus();
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}

        el.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: val,
          }),
        );
        el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));

        console.log(
          "[AI Multiverse] Qwen Slate: fill completed, length:",
          val.length,
        );
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // 腾讯元宝 (Quill 编辑器 / contenteditable)
      // 策略：分块 execCommand("insertText") 主路径，失败回退 textContent
      // ════════════════════════════════════════════════════════════════════════
      if (hostname.includes("yuanbao.tencent.com")) {
        const el = findEl([".ql-editor", 'div[contenteditable="true"]']);
        if (!el) return false;

        el.focus();
        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
        } catch (e) {}
        el.focus();

        let success = true;
        const chunkSize = 4000;
        for (let i = 0; i < val.length; i += chunkSize) {
          const chunk = val.slice(i, i + chunkSize);
          try {
            const chunkSuccess = document.execCommand(
              "insertText",
              false,
              chunk,
            );
            if (!chunkSuccess) success = false;
          } catch (e) {
            console.warn(
              "[AI Multiverse] Yuanbao: execCommand failed for chunk:",
              e,
            );
            success = false;
          }
        }

        if (!success || el.innerText.trim().length === 0) {
          console.log(
            "[AI Multiverse] Yuanbao: execCommand failed, using textContent fallback",
          );
          el.textContent = val;
        }

        try {
          // 触发长文本所需的 input/beforeinput 事件
          el.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: val,
            }),
          );
          el.dispatchEvent(
            new Event("input", { bubbles: true, composed: true }),
          );
          el.dispatchEvent(
            new Event("change", { bubbles: true, composed: true }),
          );
          const lastChar = val.slice(-1) || " ";
          el.dispatchEvent(
            new KeyboardEvent("keyup", {
              key: lastChar,
              bubbles: true,
              composed: true,
            }),
          );
        } catch (e) {}

        console.log(
          "[AI Multiverse] Yuanbao: fill completed, length:",
          val.length,
        );
        return true;
      }

      // ════════════════════════════════════════════════════════════════════════
      // 通用兜底（未匹配到具体模型时）
      // ════════════════════════════════════════════════════════════════════════
      const genericEl = findEl([
        sel,
        "textarea",
        'div[contenteditable="true"]',
        'div[role="textbox"]',
      ]);
      if (!genericEl) return false;

      if (genericEl.tagName === "TEXTAREA" || genericEl.tagName === "INPUT") {
        genericEl.focus();
        genericEl.value = val;
        genericEl.dispatchEvent(new Event("input", { bubbles: true }));
        genericEl.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        genericEl.focus();
        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
        } catch (e) {}
        let success = false;
        try {
          success = document.execCommand("insertText", false, val);
        } catch (e) {}
        if (!success || genericEl.innerText.trim().length === 0) {
          genericEl.textContent = val;
        }
        genericEl.dispatchEvent(
          new Event("input", { bubbles: true, composed: true }),
        );
        genericEl.dispatchEvent(
          new Event("change", { bubbles: true, composed: true }),
        );
      }

      console.log("[AI Multiverse] Generic fallback: fill completed");
      return true;
    },
  });
}

// === Main World Click (for Qwen/Slate.js where content script click doesn't work) ===
async function executeMainWorldClick(tabId, provider) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: "MAIN",
    args: [provider || ""],
    func: (providerName) => {
      const hostname = window.location.hostname;
      console.log(`[AI Multiverse] Main world click for ${providerName}`);

      // Helper: find visible element
      const findBtn = (selectors) => {
        for (const s of selectors) {
          try {
            const elements = Array.from(document.querySelectorAll(s));
            const visibleEl = elements
              .reverse()
              .find(
                (el) =>
                  el.offsetParent !== null &&
                  el.getBoundingClientRect().width > 0,
              );
            if (visibleEl) return visibleEl;
            if (elements.length > 0) return elements[0];
          } catch (e) {}
        }
        return null;
      };

      // Helper: check if button is effectively disabled (Slate.js context)
      const isQwenBtnDisabled = (btn) => {
        if (!btn) return true;
        if (btn.disabled) return true;
        if (btn.getAttribute("aria-disabled") === "true") return true;
        if (btn.classList.contains("ant-btn-disabled")) return true;
        // 千问使用动态类名如 'disabled-ZaDDJC'，需要检查类名中是否包含 'disabled'
        if (btn.className && btn.className.includes("disabled")) return true;
        const opacity = parseFloat(window.getComputedStyle(btn).opacity);
        if (!isNaN(opacity) && opacity < 0.3) return true;
        return false;
      };

      // Helper: perform click sequence
      const doClick = (btn) => {
        console.log(
          "[AI Multiverse] Main world: clicking button",
          btn.tagName,
          btn.className,
        );

        // 修复：移除了原来在点击前"clearInput"的逻辑。
        // clearInput 在填充内容之后、发送之前把输入框清空，
        // 会导致 Slate.js DOM 被破坏，配合填充阶段的重复插入问题一起
        // 造成最终提交的内容出现重复。正确做法是直接点击发送按钮。
        if (typeof btn.click === "function") {
          btn.click();
        } else {
          const clickOpts = {
            bubbles: true,
            composed: true,
            cancelable: true,
            view: window,
          };
          btn.dispatchEvent(new MouseEvent("mousedown", clickOpts));
          btn.dispatchEvent(new MouseEvent("mouseup", clickOpts));
          btn.dispatchEvent(new MouseEvent("click", clickOpts));
        }

        return true;
      };

      if (
        hostname.includes("qianwen") ||
        hostname.includes("tongyi.aliyun.com") ||
        hostname.includes("qwen.ai")
      ) {
        // Try button selectors in order of priority
        const btnSelectors = [
          // 千问发送按钮的精确选择器 - 先找到图标，然后向上查找可点击元素
          'span[data-icon-type="qwpcicon-sendChat"]',
          'div[class*="operateBtn"]',
          'button:has(svg[data-icon-type="qwpcicon-sendChat"])',
          ".text-area-slot-container button",
          'div[class*="sendButton"] button',
          'div[class*="SendButton"] button',
          "button.ant-btn-primary",
          // Broader fallbacks
          '.text-area-slot-container div[role="button"]',
          'div[class*="sendButton"]',
          'div[class*="SendButton"]',
        ];

        let btn = findBtn(btnSelectors);
        if (!btn) {
          console.warn("[AI Multiverse] Qwen: no button found in main world");
          // 尝试使用 Enter 键作为备用方案
          const editor =
            document.querySelector('div[data-slate-editor="true"]') ||
            document.querySelector('div[role="textbox"]');
          if (editor) {
            console.log("[AI Multiverse] Qwen: fallback to Enter key");
            editor.focus();
            const enterOpts = {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              charCode: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
            };
            editor.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
            editor.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
            editor.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
            return true;
          }
          return false;
        }

        // 千问的发送按钮是 div.operateBtn-JsB9e2，父链中没有任何 <button> 元素。
        // 直接向上找 div[class*="operateBtn"]，找不到则 fallback 到 parentElement。
        {
          const operateBtn = btn.closest('div[class*="operateBtn"]');
          if (operateBtn) {
            btn = operateBtn;
          } else if (
            btn.tagName !== "BUTTON" &&
            btn.getAttribute("role") !== "button"
          ) {
            const parent =
              btn.closest("button") ||
              btn.closest('[role="button"]') ||
              btn.parentElement;
            if (parent) btn = parent;
          }
        }

        console.log(
          "[AI Multiverse] Qwen main world btn:",
          btn.tagName,
          JSON.stringify([...btn.classList]),
        );
        console.log(
          "[AI Multiverse] Qwen btn disabled:",
          isQwenBtnDisabled(btn),
        );

        // If button is disabled, wait up to 3000ms via polling using setTimeout chain
        // (Note: executeScript func is sync, we can't await here)
        // So we do a non-blocking retry via requestAnimationFrame
        let attempts = 0;
        const maxAttempts = 60; // 60 * 50ms = 3000ms
        let clicked = false; // 防止重复点击

        const tryClick = () => {
          if (clicked) return; // 已经点击过，不再重复
          attempts++;
          // Re-find button each time
          let freshBtn = findBtn(btnSelectors);
          if (freshBtn) {
            // 千问发送按钮是 div.operateBtn，父链无 <button>，直接找 operateBtn div
            {
              const operateBtn = freshBtn.closest('div[class*="operateBtn"]');
              if (operateBtn) {
                freshBtn = operateBtn;
              } else if (
                freshBtn.tagName !== "BUTTON" &&
                freshBtn.getAttribute("role") !== "button"
              ) {
                const parent =
                  freshBtn.closest("button") ||
                  freshBtn.closest('[role="button"]') ||
                  freshBtn.parentElement;
                if (parent) freshBtn = parent;
              }
            }
            if (!isQwenBtnDisabled(freshBtn)) {
              clicked = true; // 标记已点击
              doClick(freshBtn);
              return;
            }
          }
          if (attempts < maxAttempts) {
            setTimeout(tryClick, 50);
          } else {
            // Last resort: click anyway ignoring disabled
            if (freshBtn && !clicked) {
              clicked = true;
              console.log(
                "[AI Multiverse] Qwen: force clicking despite disabled state",
              );
              doClick(freshBtn);
            } else if (!clicked) {
              // Try Enter key on editor
              const editor = document.querySelector(
                'div[data-slate-editor="true"]',
              );
              if (editor) {
                console.log(
                  "[AI Multiverse] Qwen: trying Enter on Slate editor",
                );
                editor.focus();
                const enterOpts = {
                  key: "Enter",
                  code: "Enter",
                  keyCode: 13,
                  which: 13,
                  charCode: 13,
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                };
                editor.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
                editor.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
                editor.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
              }
            }
          }
        };

        tryClick();
        return true;
      }

      return false;
    },
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
        const win = await chrome.windows.get(
          providerWindows[providerKey].windowId,
        );
        // CRITICAL: NEVER tile the extension's own control panel
        if (win && win.id !== popupWindowId) {
          winId = win.id;
        }
      } catch (e) {
        delete providerWindows[providerKey];
      }
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
          const validTab = tabs.find(
            (t) =>
              t.windowId &&
              t.windowId !== popupWindowId &&
              !t.url.startsWith("chrome-extension://"),
          );
          if (validTab) {
            winId = validTab.windowId;
            providerWindows[providerKey] = {
              windowId: winId,
              tabId: validTab.id,
            };
            break;
          }
        } catch (e) {}
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
    } catch (e) {
      popupWindowId = null;
    }
  }

  // Strategy B: Use stored display preference
  if (!targetDisplay) {
    try {
      const stored = await chrome.storage.local.get("lastTileDisplayId");
      if (stored.lastTileDisplayId) {
        const found = displayInfo.find(
          (d) => d.id === stored.lastTileDisplayId,
        );
        if (found) targetDisplay = found;
      }
    } catch (e) {
      /* ignore */
    }
  }

  // Strategy C: Default to primary display
  if (!targetDisplay) {
    targetDisplay = displayInfo.find((d) => d.isPrimary) || displayInfo[0];
  }

  // Persist the display choice for next time
  chrome.storage.local.set({ lastTileDisplayId: targetDisplay.id });

  const {
    width: screenW,
    height: screenH,
    left: screenX,
    top: screenY,
  } = targetDisplay.workArea;

  // 3. Calculate Layout
  const count = windowsToTile.length;
  let cols, rows;
  if (count === 1) {
    cols = 1;
    rows = 1;
  } else if (count === 2) {
    cols = 2;
    rows = 1;
  } else if (count <= 4) {
    cols = 2;
    rows = 2;
  } else if (count <= 6) {
    cols = 3;
    rows = 2;
  } else {
    cols = 3;
    rows = Math.ceil(count / 3);
  }

  const winW = Math.floor(screenW / cols);
  const winH = Math.floor(screenH / rows);

  // 4. Apply Layout (parallel for speed)
  const tilePromises = windowsToTile.map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    return chrome.windows
      .update(item.windowId, {
        left: screenX + col * winW,
        top: screenY + row * winH,
        width: winW,
        height: winH,
        state: "normal",
        focused: false,
      })
      .catch((e) => console.error(`Failed to tile ${item.provider}:`, e));
  });

  await Promise.all(tilePromises);

  // No longer focusing first window - let user manually select which window to view
  // If Browse Mode is enabled, mouse hover will auto-focus
}

// Helper: find which display a window is on
function findDisplayForWindow(win, displayInfo) {
  const cx = win.left + win.width / 2;
  const cy = win.top + win.height / 2;
  return (
    displayInfo.find((d) => {
      const b = d.bounds;
      return (
        cx >= b.left &&
        cx < b.left + b.width &&
        cy >= b.top &&
        cy < b.top + b.height
      );
    }) || null
  );
}

// === Helper Functions ===
async function ensureContentScript(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url.startsWith("chrome://")) return false;

    await chrome.tabs.sendMessage(tabId, { action: "ping" });
    return true;
  } catch (e) {
    try {
      // Must inject config.js first
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["src/config.js", "src/content/content.js"],
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    } catch (injectError) {
      console.error("Injection failed:", injectError);
      return false;
    }
  }
}

function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let cleanupTimer = null;

    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
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
      if (tab && tab.status === "complete") {
        cleanup();
        resolve();
        return;
      }

      // Set timeout to prevent infinite waiting
      cleanupTimer = setTimeout(() => {
        cleanup();
        resolve(); // Resolve anyway to avoid blocking
      }, timeout);
    });
  });
}

async function handleBroadcast(message, providers, files = []) {
  const tasks = providers.map((p) => sendToProvider(p, message, files));
  await Promise.allSettled(tasks);
}

async function sendToProvider(providerKey, message, files = []) {
  if (!PROVIDER_CONFIG[providerKey]) return;

  // Clear summarizing flag since this is a chat message
  isSummarizing[providerKey] = false;

  const config = PROVIDER_CONFIG[providerKey];
  let tabId = null;

  // Try finding tracked window
  if (providerWindows[providerKey]) {
    try {
      const win = await chrome.windows.get(
        providerWindows[providerKey].windowId,
      );
      if (win && win.id !== popupWindowId) {
        tabId = providerWindows[providerKey].tabId;
      } else {
        delete providerWindows[providerKey];
      }
    } catch (e) {
      delete providerWindows[providerKey];
    }
  }

  // Try finding existing window
  if (!tabId) {
    const patternsToCheck = [config.urlPattern];
    if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
    if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

    const uniquePatterns = [
      ...new Set(
        patternsToCheck.filter((p) => typeof p === "string" && p.length > 0),
      ),
    ];

    for (const pattern of uniquePatterns) {
      try {
        const tabs = await chrome.tabs.query({ url: pattern });
        // Avoid picking up the extension's own tabs and the summary tab
        const summaryTabIdToIgnore = summaryWindows[providerKey]
          ? summaryWindows[providerKey].tabId
          : -1;
        const validTab = tabs.find(
          (t) =>
            t.url &&
            !t.url.startsWith("chrome-extension://") &&
            t.windowId !== popupWindowId &&
            t.id !== summaryTabIdToIgnore,
        );
        if (validTab) {
          tabId = validTab.id;
          providerWindows[providerKey] = {
            windowId: validTab.windowId,
            tabId: validTab.id,
          };
          break;
        }
      } catch (e) {}
    }
  }

  // Create new window
  if (!tabId) {
    const newWin = await chrome.windows.create({
      url: config.baseUrl,
      type: "normal",
      focused: false,
    });
    tabId = newWin.tabs[0].id;
    providerWindows[providerKey] = { windowId: newWin.id, tabId: tabId };
    await waitForTabLoad(tabId);
    // Increased from 2000ms to 3000ms to allow full hydration/redirects for Qwen/Grok
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const injected = await ensureContentScript(tabId);
  if (!injected) {
    notifyStatus(providerKey, bt("err_script_injection_failed"), "error");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "fill_and_send",
      text: message,
      provider: providerKey,
      files: files,
    });
    notifyStatus(providerKey, bt("sent"), "success");
  } catch (err) {
    notifyStatus(providerKey, bt("err_prefix") + err.message, "error");
  }
}

function notifyStatus(provider, message, status) {
  chrome.runtime
    .sendMessage({ action: "status_update", status, provider, message })
    .catch(() => {});
}

async function handleLaunchOnly(providers) {
  // Phase 1: Discover existing windows or create new ones (parallel)
  const tasks = providers.map(async (providerKey) => {
    if (!PROVIDER_CONFIG[providerKey]) return;
    const config = PROVIDER_CONFIG[providerKey];

    // Try finding tracked window
    if (providerWindows[providerKey]) {
      try {
        const win = await chrome.windows.get(
          providerWindows[providerKey].windowId,
        );
        if (win && win.id !== popupWindowId) {
          return; // Already open, skip
        } else {
          delete providerWindows[providerKey];
        }
      } catch (e) {
        delete providerWindows[providerKey];
      }
    }

    // Try finding existing window by URL (check all known patterns)
    const patternsToCheck = [config.urlPattern];
    if (config.urlPatternAlt) patternsToCheck.push(config.urlPatternAlt);
    if (config.urlPatterns) patternsToCheck.push(...config.urlPatterns);

    const uniquePatterns = [
      ...new Set(
        patternsToCheck.filter((p) => typeof p === "string" && p.length > 0),
      ),
    ];

    let foundTab = null;
    for (const pattern of uniquePatterns) {
      try {
        const tabs = await chrome.tabs.query({ url: pattern });
        const summaryTabIdToIgnore = summaryWindows[providerKey]
          ? summaryWindows[providerKey].tabId
          : -1;
        const validTab = tabs.find(
          (t) =>
            t.url &&
            !t.url.startsWith("chrome-extension://") &&
            t.windowId !== popupWindowId &&
            t.id !== summaryTabIdToIgnore,
        );

        if (validTab) {
          foundTab = validTab;
          break;
        }
      } catch (e) {}
    }
    if (foundTab && foundTab.windowId !== popupWindowId) {
      providerWindows[providerKey] = {
        windowId: foundTab.windowId,
        tabId: foundTab.id,
      };
      return; // Already open, skip
    }

    // Create new window — do NOT wait for page load, just create
    const newWin = await chrome.windows.create({
      url: config.baseUrl,
      type: "normal",
      focused: false,
    });
    providerWindows[providerKey] = {
      windowId: newWin.id,
      tabId: newWin.tabs[0].id,
    };
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
    uniquePatterns.map((pattern) =>
      chrome.tabs.query({ url: pattern }).catch(() => []),
    ),
  );

  // Flatten all found tabs
  const allTabs = tabQueryResults.flat();

  // 4. Decide: close window or just tab
  for (const tab of allTabs) {
    if (closeWindowIds.has(tab.windowId)) continue; // Already marked for window close
    try {
      const win = await chrome.windows.get(tab.windowId, { populate: true });
      if (win.tabs.length === 1 || win.type === "popup") {
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
    ...Array.from(closeWindowIds).map((id) =>
      chrome.windows.remove(id).catch(() => {}),
    ),
    ...Array.from(closeTabIds).map((id) =>
      chrome.tabs.remove(id).catch(() => {}),
    ),
  ];

  await Promise.allSettled(promises);
  providerWindows = {};

  // Notify popup that close is complete
  chrome.runtime
    .sendMessage({
      action: "status_update",
      status: "success",
      provider: "system",
      message: bt("closed_windows", {
        count: closeWindowIds.size,
        tabs: closeTabIds.size,
      }),
    })
    .catch(() => {});
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
        const win = await chrome.windows.get(
          providerWindows[providerKey].windowId,
        );
        if (win && win.id !== popupWindowId) {
          layout[providerKey] = {
            left: win.left,
            top: win.top,
            width: win.width,
            height: win.height,
            state: win.state,
          };
        }
      } catch (e) {}
    }
  }

  chrome.storage.local.set({ saved_layout: layout });
}

/**
 * Load saved layout from storage
 */
async function loadLayout() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["saved_layout"], (result) => {
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
          state: layout.state,
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
  chrome.storage.local.remove(["saved_layout"]);
}

// Patch handleBroadcast to save layout after sending
const originalHandleBroadcast = handleBroadcast;
handleBroadcast = async function (message, providers) {
  await originalHandleBroadcast.call(this, message, providers);
  // Save layout after all windows are opened and positioned
  setTimeout(() => saveLayout(providers), 1000);
};

// Patch handleTileWindows to save layout after tiling
const originalHandleTileWindows = handleTileWindows;
handleTileWindows = async function (providers) {
  await originalHandleTileWindows.call(this, providers);
  // Save layout after tiling
  saveLayout(providers);
};

// Patch handleLaunchOnly to save layout after launching
const originalHandleLaunchOnly = handleLaunchOnly;
handleLaunchOnly = async function (providers) {
  await originalHandleLaunchOnly.call(this, providers);
  // Save layout after launching and tiling
  setTimeout(() => saveLayout(providers), 1500);
};

// Add message handler for clear layout
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clear_layout") {
    clearSavedLayout().then(() => {
      sendResponse({ status: "ok" });
    });
    return true;
  } else if (request.action === "reset_layout") {
    const providers = request.providers || [];
    applySavedLayout(providers).then(() => {
      sendResponse({ status: "ok" });
    });
    return true;
  } else if (request.action === "language_changed") {
    backgroundLang = request.lang || "en";
    sendResponse({ status: "ok" });
    return true;
  }
});

// === Network Request Monitoring for Accurate Status Detection ===

// Track streaming status per tab
const streamingStatus = new Map(); // tabId -> { provider, isStreaming, conversationId }

// API endpoint patterns for each provider
const API_PATTERNS = {
  grok: {
    pattern: /grok\.com\/rest\/app-chat\/conversations\/[^\/]+\/responses/,
    provider: "grok",
  },
  gemini: {
    // Gemini 网页使用内部 BardChatUi batchexecute 端点，或 streamGenerateContent/generateContent
    pattern:
      /gemini\.google\.com.*\/(streamGenerateContent|generateContent|generate|stream|batchexecute|BardChatUi|_\/bard)/,
    provider: "gemini",
  },
  chatgpt: {
    // ChatGPT 使用 backend-api/conversation
    pattern: /chatgpt\.com\/backend-api\/conversation/,
    provider: "chatgpt",
  },
  deepseek: {
    // DeepSeek 使用 SSE 流式接口，实测端点为 api/v0/chat/completion
    // SSE 结束信号：event: close（服务器主动关闭连接）
    // 完成标志：data: {"p":"response/status","o":"SET","v":"FINISHED"}
    // v\d+ 兼容 v0/v1 等所有版本
    pattern: /chat\.deepseek\.com\/api\/v\d+\/chat\/completion/,
    provider: "deepseek",
  },
  kimi: {
    // Kimi 使用 gRPC-web over HTTP/2，端点为 /apiv2/.../Chat
    // 注意：gRPC over HTTP/2 的持久连接可能导致 onCompleted 不触发
    // content.js 中已有 6 周期稳定安全阀作为兜底
    // 若 onCompleted 不可靠，可向用户索取最新 REST 端点作为替代
    pattern:
      /(?:www\.)?kimi\.(moonshot\.cn|com)\/(apiv2\/kimi\.gateway\.chat\.v1\.ChatService\/Chat|api\/.*chat)/,
    provider: "kimi",
  },
  qwen: {
    // 千问使用多个可能的端点
    pattern:
      /(qianwen|tongyi\.aliyun|qwen\.ai)\.com.*(\/conversation|\/chat|\/stream|\/api\/chat)/,
    provider: "qwen",
  },
  yuanbao: {
    // 元宝使用流式聊天接口
    pattern: /yuanbao\.tencent\.com\/api\/(user\/agent\/)?chat/,
    provider: "yuanbao",
  },
};

// Listen to network requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Only monitor main_frame and sub_frame requests
    if (details.type !== "xmlhttprequest" && details.type !== "fetch") {
      return;
    }

    const url = details.url;
    const tabId = details.tabId;

    // Check which provider this request belongs to
    for (const [key, config] of Object.entries(API_PATTERNS)) {
      if (config.pattern.test(url)) {
        console.log(
          `[Network Monitor] ✓ ${config.provider} streaming started on tab ${tabId}`,
        );
        console.log(`[Network Monitor]   URL: ${url}`);

        // Extract conversation ID from URL if possible
        const conversationMatch = url.match(/conversations?\/([a-zA-Z0-9-]+)/);
        const conversationId = conversationMatch ? conversationMatch[1] : null;

        streamingStatus.set(tabId, {
          provider: config.provider,
          isStreaming: true,
          conversationId: conversationId,
          startTime: Date.now(),
          url: url,
        });

        // Notify content script
        chrome.tabs
          .sendMessage(tabId, {
            action: "streaming_started",
            provider: config.provider,
            conversationId: conversationId,
          })
          .catch(() => {
            // Content script might not be ready yet
          });

        break;
      }
    }
  },
  {
    urls: [
      "*://grok.com/*",
      "*://gemini.google.com/*",
      "*://chatgpt.com/*",
      "*://chat.deepseek.com/*",
      "*://kimi.moonshot.cn/*",
      "*://www.kimi.com/*",
      "*://*.qianwen.com/*",
      "*://tongyi.aliyun.com/*",
      "*://yuanbao.tencent.com/*",
    ],
  },
);

// Listen to completed requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const url = details.url;
    const tabId = details.tabId;

    // Check if this is a streaming API completion
    for (const [key, config] of Object.entries(API_PATTERNS)) {
      if (config.pattern.test(url)) {
        const status = streamingStatus.get(tabId);

        if (status && status.provider === config.provider) {
          const duration = Date.now() - status.startTime;
          console.log(
            `[Network Monitor] ✓ ${config.provider} streaming completed on tab ${tabId} (${duration}ms)`,
          );
          console.log(`[Network Monitor]   URL: ${url}`);

          // Mark as completed
          streamingStatus.set(tabId, {
            ...status,
            isStreaming: false,
            endTime: Date.now(),
          });

          // Notify content script
          chrome.tabs
            .sendMessage(tabId, {
              action: "streaming_completed",
              provider: config.provider,
              conversationId: status.conversationId,
            })
            .catch(() => {
              // Content script might not be ready
            });

          // Clean up after 5 seconds
          setTimeout(() => {
            streamingStatus.delete(tabId);
          }, 5000);
        }

        break;
      }
    }
  },
  {
    urls: [
      "*://grok.com/*",
      "*://gemini.google.com/*",
      "*://chatgpt.com/*",
      "*://chat.deepseek.com/*",
      "*://kimi.moonshot.cn/*",
      "*://www.kimi.com/*",
      "*://*.qianwen.com/*",
      "*://tongyi.aliyun.com/*",
      "*://yuanbao.tencent.com/*",
    ],
  },
);

// Listen to error requests
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const url = details.url;
    const tabId = details.tabId;

    for (const [key, config] of Object.entries(API_PATTERNS)) {
      if (config.pattern.test(url)) {
        console.log(
          `[Network Monitor] ${config.provider} streaming error on tab ${tabId}:`,
          details.error,
        );

        const status = streamingStatus.get(tabId);
        if (status && status.provider === config.provider) {
          streamingStatus.set(tabId, {
            ...status,
            isStreaming: false,
            error: details.error,
          });

          chrome.tabs
            .sendMessage(tabId, {
              action: "streaming_error",
              provider: config.provider,
              error: details.error,
            })
            .catch(() => {});
        }

        break;
      }
    }
  },
  {
    urls: [
      "*://grok.com/*",
      "*://gemini.google.com/*",
      "*://chatgpt.com/*",
      "*://chat.deepseek.com/*",
      "*://kimi.moonshot.cn/*",
      "*://www.kimi.com/*",
      "*://*.qianwen.com/*",
      "*://tongyi.aliyun.com/*",
      "*://yuanbao.tencent.com/*",
    ],
  },
);

// API to check streaming status
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "check_streaming_status") {
    const tabId = sender.tab?.id || request.tabId;
    const status = streamingStatus.get(tabId);

    sendResponse({
      isStreaming: status?.isStreaming || false,
      provider: status?.provider || null,
      conversationId: status?.conversationId || null,
    });
    return true;
  }
});

console.log("[Background] Network monitoring initialized");
