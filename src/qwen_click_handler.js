// 千问平台专用点击处理模块
export async function handleQwenClick(tabId) {
    return chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
            const hostname = window.location.hostname;
            if (!hostname.includes("qianwen") && 
                !hostname.includes("tongyi.aliyun.com") && 
                !hostname.includes("qwen.ai")) {
                return false;
            }

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
                console.warn("[Qwen Click] No button found");
                return false;
            }

            // 向上查找可点击元素
            if (btn.tagName !== "BUTTON" && btn.getAttribute("role") !== "button") {
                const parent = btn.closest("button") || 
                              btn.closest('[role="button"]') || 
                              btn.parentElement;
                if (parent) btn = parent;
            }

            // 执行点击操作
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

            return true;
        }
    });
}