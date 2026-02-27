// 修复千问平台点击问题的独立模块
function executeMainWorldClickFix(tabId, provider) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: "MAIN",
    args: [provider || ""],
    func: (providerName) => {
      const hostname = window.location.hostname;
      console.log(`[AI Multiverse] Fixed click handler for ${providerName}`);

      // 查找发送按钮
      const findBtn = (selectors) => {
        for (const s of selectors) {
          try {
            const elements = Array.from(document.querySelectorAll(s));
            const visibleEl = elements.reverse().find(
              el => el.offsetParent !== null && 
              el.getBoundingClientRect().width > 0
            );
            if (visibleEl) return visibleEl;
            if (elements.length > 0) return elements[0];
          } catch (e) {}
        }
        return null;
      };

      // 检查按钮是否禁用
      const isBtnDisabled = (btn) => {
        if (!btn) return true;
        if (btn.disabled) return true;
        if (btn.getAttribute("aria-disabled") === "true") return true;
        if (btn.classList.contains("ant-btn-disabled")) return true;
        if (btn.className && btn.className.includes("disabled")) return true;
        const opacity = parseFloat(window.getComputedStyle(btn).opacity);
        if (!isNaN(opacity) && opacity < 0.3) return true;
        return false;
      };

      // 执行点击操作
      const doClick = (btn) => {
        if (typeof btn.click === "function") {
          btn.click();
        } else {
          const opts = {
            bubbles: true,
            composed: true,
            cancelable: true,
            view: window
          };
          btn.dispatchEvent(new MouseEvent("mousedown", opts));
          btn.dispatchEvent(new MouseEvent("mouseup", opts));
          btn.dispatchEvent(new MouseEvent("click", opts));
        }
      };

      // 仅处理千问平台
      if (hostname.includes("qianwen") || 
          hostname.includes("tongyi.aliyun.com") || 
          hostname.includes("qwen.ai")) {
        
        const btnSelectors = [
          'span[data-icon-type="qwpcicon-sendChat"]',
          'div[class*="operateBtn"]',
          'button:has(svg[data-icon-type="qwpcicon-sendChat"])',
          ".text-area-slot-container button",
          'div[class*="sendButton"] button',
          'div[class*="SendButton"] button',
          "button.ant-btn-primary",
          '.text-area-slot-container div[role="button"]'
        ];

        let btn = findBtn(btnSelectors);
        if (!btn) {
          console.warn("[AI Multiverse] No button found");
          return false;
        }

        // 向上查找可点击元素
        if (btn.tagName !== "BUTTON" && btn.getAttribute("role") !== "button") {
          const parent = btn.closest("button") || 
                        btn.closest('[role="button"]') || 
                        btn.parentElement;
          if (parent) btn = parent;
        }

        // 等待按钮可用
        let attempts = 0;
        const maxAttempts = 30; // 30 * 100ms = 3秒超时
        const tryClick = () => {
          attempts++;
          const freshBtn = findBtn(btnSelectors);
          if (freshBtn && !isBtnDisabled(freshBtn)) {
            doClick(freshBtn);
            return true;
          }
          if (attempts < maxAttempts) {
            setTimeout(tryClick, 100);
          } else {
            console.warn("[AI Multiverse] Button still disabled after timeout");
            return false;
          }
        };

        return tryClick();
      }
      return false;
    }
  });
}

// 导出修复函数
export { executeMainWorldClickFix };