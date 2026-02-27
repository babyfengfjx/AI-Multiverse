// 这是修复后的 clickButton 函数，需要替换 src/content/content.js 中的对应部分
// 位置：sendMessage 函数内部，大约在 979-1037 行

const clickButton = async () => {
    // Gemini 使用更短的等待时间，因为它的按钮通常很快就可用
    const isQwen = provider === 'qwen' || /qianwen|tongyi|qwen\.ai/i.test(window.location.hostname);
    const maxAttempts = isGemini ? 20 : (isAsyncUI ? MAX_BUTTON_WAIT_ATTEMPTS_ASYNC : MAX_BUTTON_WAIT_ATTEMPTS_SYNC);
    const interval = isGemini ? 50 : (isAsyncUI ? BUTTON_WAIT_INTERVAL_ASYNC : BUTTON_WAIT_INTERVAL_SYNC);

    for (let i = 0; i < maxAttempts; i++) {
        const targetEl = findElement(config.selectors.button);
        if (targetEl) {
            console.log('[AI Multiverse] Found button element:', targetEl.tagName, targetEl.className);
            
            // 千问特殊处理：可能找到的是 SVG 或 span，需要找到真正的可点击元素
            let clickableBtn;
            if (isQwen) {
                if (targetEl.tagName === 'svg' || targetEl.tagName === 'SVG' || targetEl.tagName === 'SPAN') {
                    // 向上查找可点击的父元素
                    clickableBtn = targetEl.closest('button') || 
                                   targetEl.closest('div[role="button"]') || 
                                   targetEl.closest('div[class*="Button"]') ||
                                   targetEl.closest('div[class*="send"]') ||
                                   targetEl.parentElement;
                } else {
                    clickableBtn = targetEl;
                }
            } else {
                // 如果找到的是 SVG 等子元素，则提升到真正带点击行为的父节点
                clickableBtn = targetEl.tagName === 'BUTTON' || targetEl.getAttribute('role') === 'button'
                    ? targetEl
                    : (targetEl.closest('button') || targetEl.closest('[role="button"]') || targetEl.closest('div[class*="Btn"]') || targetEl.closest('div[class*="slot"]') || targetEl);
            }

            if (!clickableBtn) {
                console.log('[AI Multiverse] Could not find clickable parent, attempt', i + 1);
                await delay(interval);
                continue;
            }

            console.log('[AI Multiverse] Clickable button:', clickableBtn.tagName, clickableBtn.className);

            // 检查常见的禁用标记，避免在按钮灰掉时强行连点
            const isDisabled = clickableBtn.disabled ||
                clickableBtn.getAttribute('aria-disabled') === 'true' ||
                clickableBtn.classList.contains('disabled') ||
                clickableBtn.classList.contains('ds-icon-button--disabled') ||
                clickableBtn.classList.contains('kimi-disabled') ||
                clickableBtn.closest('[class*="disabled"]');

            if (!isDisabled) {
                console.log('[AI Multiverse] Button is enabled, clicking...');
                // 模拟一次"正常人"点击：只触发一次 click 调用，杜绝多次发送
                await delay(DELAY.SHORT);

                // 千问特殊处理：使用更完整的点击序列
                if (isQwen) {
                    console.log('[AI Multiverse] Qwen: Using full click sequence');
                    clickableBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    await delay(50);
                    clickableBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    await delay(50);
                    clickableBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    
                    // 如果有 click 方法，也调用一次
                    if (typeof clickableBtn.click === 'function') {
                        await delay(50);
                        clickableBtn.click();
                    }
                } else {
                    // 特殊处理：千问这种没有真正 BUTTON 元素的平台，直接触发一次 DOM click
                    if (provider === 'qwen' || clickableBtn.tagName !== 'BUTTON') {
                        clickableBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        clickableBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    }

                    if (typeof clickableBtn.click === 'function') {
                        clickableBtn.click();
                    } else {
                        clickableBtn.dispatchEvent(new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        }));
                    }
                }
                
                console.log('[AI Multiverse] Button clicked successfully');
                return true;
            } else {
                console.log('[AI Multiverse] Button is disabled, attempt', i + 1);
            }
        } else {
            console.log('[AI Multiverse] Button not found, attempt', i + 1);
        }

        // Fallback: 如果异步 UI 的发送按钮长时间不激活，则尝试一次 Enter 提交
        // 注意：Kimi 明确只走"点击发送"，不做 Enter 回退，避免重复发送。
        if (isAsyncUI && provider !== 'kimi' && i === 25) {
            console.log('[AI Multiverse] Fast fallback to Enter for', provider);
            sendEnterKey(inputEl);
            // 不立即 return，后续如果按钮激活，还会再尝试一次 click 以保证成功发送
        }

        await delay(interval);
    }
    console.log('[AI Multiverse] Button click failed after all attempts');
    return false;
};
