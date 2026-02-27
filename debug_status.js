// 状态检测调试脚本 - 在 Grok 或元宝页面的控制台运行

console.log('=== 状态检测调试 ===');
console.log('当前页面:', window.location.hostname);

// 检测函数
function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1;
}

function isElementDisabled(el) {
    if (!el) return true;
    const style = window.getComputedStyle(el);
    return el.disabled ||
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.classList.contains('disabled') ||
        el.classList.contains('is-disabled') ||
        style.pointerEvents === 'none' ||
        (style.opacity !== '' && parseFloat(style.opacity) < 0.45);
}

// Grok 检测
if (window.location.hostname.includes('grok.com')) {
    console.log('\n=== Grok 状态检测 ===');
    
    // 检查停止按钮
    console.log('\n1. 停止按钮检测:');
    const stopSelectors = [
        'button[aria-label*="Pause"]',
        'button[aria-label*="Stop"]'
    ];
    stopSelectors.forEach(sel => {
        const btn = document.querySelector(sel);
        if (btn) {
            console.log(`✓ 找到: ${sel}`);
            console.log('  - 可见:', isElementVisible(btn));
            console.log('  - 禁用:', isElementDisabled(btn));
            console.log('  - aria-hidden:', btn.getAttribute('aria-hidden'));
        } else {
            console.log(`✗ 未找到: ${sel}`);
        }
    });
    
    // 检查流式标记
    console.log('\n2. 流式标记检测:');
    const streamSelectors = [
        '.result-streaming',
        '[data-testid="message-text-content"] .cursor',
        '.markdown-content .cursor'
    ];
    streamSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        console.log(sel, ':', el ? '✓ 存在' : '✗ 不存在');
    });
    
    // 检查提交按钮
    console.log('\n3. 提交按钮检测:');
    const submitSelectors = [
        'button[aria-label="Submit"]',
        'button[aria-label*="提交"]',
        'button[aria-label="Send message"]'
    ];
    submitSelectors.forEach(sel => {
        const btn = document.querySelector(sel);
        if (btn) {
            console.log(`✓ 找到: ${sel}`);
            console.log('  - 可见:', isElementVisible(btn));
            console.log('  - 禁用:', btn.disabled);
            console.log('  - aria-disabled:', btn.getAttribute('aria-disabled'));
            console.log('  - opacity:', window.getComputedStyle(btn).opacity);
        } else {
            console.log(`✗ 未找到: ${sel}`);
        }
    });
    
    // 检查最新响应
    console.log('\n4. 响应内容检测:');
    const responseSelectors = [
        'div[data-testid="message-text-content"]',
        'div[data-testid="grok-response"]',
        '.markdown-content'
    ];
    responseSelectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            const last = els[els.length - 1];
            const text = (last.innerText || last.textContent || '').trim();
            console.log(`✓ ${sel}: ${els.length}个`);
            console.log('  - 最后一个长度:', text.length);
            console.log('  - 内容预览:', text.substring(0, 50));
        } else {
            console.log(`✗ ${sel}: 未找到`);
        }
    });
}

// 元宝检测
if (window.location.hostname.includes('yuanbao.tencent.com')) {
    console.log('\n=== 元宝状态检测 ===');
    
    // 检查停止按钮
    console.log('\n1. 停止按钮检测:');
    const stopSelectors = [
        '.agent-chat__stop',
        '[class*="stop-btn"]'
    ];
    stopSelectors.forEach(sel => {
        const btn = document.querySelector(sel);
        if (btn) {
            console.log(`✓ 找到: ${sel}`);
            console.log('  - 可见:', isElementVisible(btn));
        } else {
            console.log(`✗ 未找到: ${sel}`);
        }
    });
    
    // 检查思考过程
    console.log('\n2. 思考过程检测:');
    const thinking = document.querySelector('.hyc-component-deepsearch-cot__think');
    if (thinking) {
        console.log('✓ 找到思考过程');
        console.log('  - 可见:', isElementVisible(thinking));
    } else {
        console.log('✗ 未找到思考过程');
    }
    
    // 检查发送按钮
    console.log('\n3. 发送按钮检测:');
    const sendSelectors = [
        '#yuanbao-send-btn',
        '.agent-dialogue__input__send'
    ];
    sendSelectors.forEach(sel => {
        const btn = document.querySelector(sel);
        if (btn) {
            console.log(`✓ 找到: ${sel}`);
            console.log('  - 可见:', isElementVisible(btn));
            console.log('  - 禁用:', isElementDisabled(btn));
        } else {
            console.log(`✗ 未找到: ${sel}`);
        }
    });
    
    // 检查输入框
    console.log('\n4. 输入框检测:');
    const input = document.querySelector('.ql-editor');
    if (input) {
        console.log('✓ 找到输入框');
        console.log('  - 内容:', input.innerText.trim());
        console.log('  - 是否为空:', input.innerText.trim() === '');
    } else {
        console.log('✗ 未找到输入框');
    }
    
    // 检查响应内容
    console.log('\n5. 响应内容检测:');
    const responseSelectors = [
        'div.agent-chat__bubble__content',
        'div[class*="agent-chat__bubble__content"]',
        '.markdown-body'
    ];
    responseSelectors.forEach(sel => {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
            const last = els[els.length - 1];
            const text = (last.innerText || last.textContent || '').trim();
            console.log(`✓ ${sel}: ${els.length}个`);
            console.log('  - 最后一个长度:', text.length);
            console.log('  - 内容预览:', text.substring(0, 50));
        } else {
            console.log(`✗ ${sel}: 未找到`);
        }
    });
}

// 通用检测
console.log('\n=== 通用状态检测 ===');

// 检查通用停止按钮
console.log('\n1. 通用停止按钮:');
const universalStopSelectors = [
    'button[aria-label*="停止"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="Pause"]',
    'button[aria-label*="暂停"]',
    'button[data-testid*="stop"]',
    '[class*="stop-button"]',
    '.stop-generate'
];
let foundStop = false;
universalStopSelectors.forEach(sel => {
    const btn = document.querySelector(sel);
    if (btn && isElementVisible(btn) && !isElementDisabled(btn)) {
        console.log(`✓ 找到: ${sel}`);
        foundStop = true;
    }
});
if (!foundStop) {
    console.log('✗ 未找到任何停止按钮');
}

// 检查输入框状态
console.log('\n2. 输入框状态:');
const input = document.querySelector('textarea, [contenteditable="true"]');
if (input) {
    console.log('✓ 找到输入框');
    console.log('  - 禁用:', isElementDisabled(input));
    console.log('  - aria-disabled:', input.getAttribute('aria-disabled'));
} else {
    console.log('✗ 未找到输入框');
}

// 综合判断
console.log('\n=== 综合判断 ===');
if (foundStop) {
    console.log('🔄 状态: 生成中（发现停止按钮）');
} else {
    console.log('✅ 状态: 已完成（未发现停止按钮）');
}

console.log('\n=== 调试完成 ===');
console.log('请将以上信息提供给开发者');
