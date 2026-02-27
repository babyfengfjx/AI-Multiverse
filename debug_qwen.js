// 千问调试脚本 - 在千问页面的控制台中运行此脚本

console.log('=== 千问调试脚本 ===');

// 1. 检查输入框
console.log('\n1. 检查输入框:');
const inputSelectors = [
    'div[role="textbox"]',
    'div[data-placeholder*="千问"]',
    'div[data-slate-editor="true"]',
    'textarea#msg-input',
    'textarea'
];

inputSelectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
        console.log(`✓ 找到输入框: ${sel}`);
        console.log('  - 标签:', el.tagName);
        console.log('  - contenteditable:', el.getAttribute('contenteditable'));
        console.log('  - 可见:', el.offsetParent !== null);
        console.log('  - 禁用:', el.disabled || el.getAttribute('aria-disabled'));
        console.log('  - 当前内容:', el.innerText || el.value);
    } else {
        console.log(`✗ 未找到: ${sel}`);
    }
});

// 2. 检查发送按钮
console.log('\n2. 检查发送按钮:');
const buttonSelectors = [
    'button:has(svg[data-icon-type="qwpcicon-sendChat"])',
    'span[data-icon-type="qwpcicon-sendChat"]',
    '.text-area-slot-container div[style*="background-color"]',
    '.text-area-slot-container div[class*="view-container"]',
    'div.text-area-slot-container div:has(svg)',
    'div[class*="operateBtn"]',
    'button.ant-btn-primary',
    '.send-btn-ZaDDJC',
    'div[class*="send"] svg',
    'button:not([disabled]) svg'
];

buttonSelectors.forEach(sel => {
    try {
        const el = document.querySelector(sel);
        if (el) {
            console.log(`✓ 找到按钮: ${sel}`);
            console.log('  - 标签:', el.tagName);
            console.log('  - 类名:', el.className);
            console.log('  - 可见:', el.offsetParent !== null);
            console.log('  - 禁用:', el.disabled || el.getAttribute('aria-disabled'));
            
            // 查找可点击的父元素
            const clickable = el.tagName === 'BUTTON' ? el : el.closest('button') || el.closest('[role="button"]');
            if (clickable) {
                console.log('  - 可点击元素:', clickable.tagName, clickable.className);
            }
        } else {
            console.log(`✗ 未找到: ${sel}`);
        }
    } catch (e) {
        console.log(`✗ 选择器错误: ${sel}`, e.message);
    }
});

// 3. 检查响应容器
console.log('\n3. 检查响应容器:');
const responseSelectors = [
    '[class*="answer-content-inner"]',
    '[class*="answer-content"]',
    '.tongyi-markdown',
    '.markdown-body',
    '[class*="answer_block"]',
    '[class*="ResponseContent"]',
    '[class*="chatReply"] [class*="content"]',
    '[data-role="assistant"] [class*="content"]',
    '[data-role="assistant"]'
];

responseSelectors.forEach(sel => {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
        console.log(`✓ 找到响应容器: ${sel} (${els.length}个)`);
        const last = els[els.length - 1];
        console.log('  - 最后一个内容长度:', (last.innerText || last.textContent || '').trim().length);
    } else {
        console.log(`✗ 未找到: ${sel}`);
    }
});

// 4. 测试填充功能
console.log('\n4. 测试填充功能:');
const testInput = document.querySelector('div[role="textbox"]') || document.querySelector('textarea');
if (testInput) {
    console.log('找到输入框，准备测试填充...');
    
    // 保存原始内容
    const originalContent = testInput.innerText || testInput.value || '';
    
    // 测试填充
    const testText = '测试文本123';
    testInput.focus();
    
    if (testInput.getAttribute('contenteditable') === 'true') {
        console.log('使用 contenteditable 填充方式');
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        const success = document.execCommand('insertText', false, testText);
        console.log('  - execCommand 结果:', success);
        console.log('  - 填充后内容:', testInput.innerText);
    } else {
        console.log('使用 textarea 填充方式');
        testInput.value = testText;
        testInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('  - 填充后内容:', testInput.value);
    }
    
    // 恢复原始内容
    setTimeout(() => {
        if (testInput.getAttribute('contenteditable') === 'true') {
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            if (originalContent) {
                document.execCommand('insertText', false, originalContent);
            }
        } else {
            testInput.value = originalContent;
            testInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        console.log('已恢复原始内容');
    }, 2000);
} else {
    console.log('✗ 未找到输入框，无法测试');
}

// 5. 检查页面框架
console.log('\n5. 检查页面框架:');
console.log('  - React:', !!document.querySelector('[data-reactroot], [data-reactid]'));
console.log('  - Vue:', !!document.querySelector('[data-v-]'));
console.log('  - Slate:', !!document.querySelector('[data-slate-editor]'));

console.log('\n=== 调试完成 ===');
console.log('请将以上信息截图或复制，以便进一步分析问题');
