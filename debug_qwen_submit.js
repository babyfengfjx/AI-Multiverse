// 在千问页面的控制台运行此脚本来诊断提交问题

console.log('=== 千问提交诊断 ===\n');

// 1. 检查配置
if (typeof AI_CONFIG !== 'undefined' && AI_CONFIG.qwen) {
    console.log('✓ AI_CONFIG.qwen 已定义');
    console.log('  sendMethod:', AI_CONFIG.qwen.sendMethod);
    console.log('  按钮选择器数量:', AI_CONFIG.qwen.selectors.button.length);
    console.log('\n按钮选择器列表：');
    AI_CONFIG.qwen.selectors.button.forEach((sel, idx) => {
        console.log(`  ${idx + 1}. ${sel}`);
    });
} else {
    console.log('✗ AI_CONFIG.qwen 未定义');
}

console.log('\n=== 测试按钮选择器 ===\n');

const buttonSelectors = [
    'button:has(svg[data-icon-type="qwpcicon-sendChat"])',
    'div[class*="sendButton"]',
    'div[class*="SendButton"]',
    '.text-area-slot-container button',
    '.text-area-slot-container div[role="button"]',
    'span[data-icon-type="qwpcicon-sendChat"]',
    '.text-area-slot-container div[style*="background-color"]',
    'div.text-area-slot-container div:has(svg)',
    'button.ant-btn-primary:not([disabled])',
    'div[class*="operateBtn"]',
    'button:not([disabled]) svg'
];

let foundButton = null;
let foundSelector = null;

buttonSelectors.forEach((sel, idx) => {
    try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
            const el = elements[elements.length - 1];
            const isVisible = el.offsetParent !== null;
            const style = window.getComputedStyle(el);
            const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden';
            const isDisabled = el.disabled || 
                              el.getAttribute('aria-disabled') === 'true' ||
                              el.classList.contains('disabled');
            
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   找到: ${elements.length} 个元素`);
            console.log(`   标签: ${el.tagName}`);
            console.log(`   类名: ${el.className}`);
            console.log(`   可见: ${isVisible ? '✓' : '✗'}`);
            console.log(`   显示: ${isDisplayed ? '✓' : '✗'}`);
            console.log(`   启用: ${!isDisabled ? '✓' : '✗'}`);
            console.log(`   opacity: ${style.opacity}`);
            console.log(`   pointerEvents: ${style.pointerEvents}`);
            
            if (!foundButton && isVisible && isDisplayed && !isDisabled) {
                foundButton = el;
                foundSelector = sel;
                console.log(`   >>> 这是第一个可用的按钮！`);
            }
            console.log('');
        } else {
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   找到: 0 个元素\n`);
        }
    } catch (e) {
        console.log(`${idx + 1}. ${sel}`);
        console.log(`   错误: ${e.message}\n`);
    }
});

if (foundButton) {
    console.log('=== 找到可用按钮 ===');
    console.log('选择器:', foundSelector);
    console.log('元素:', foundButton);
    console.log('\n尝试查找可点击的父元素：');
    
    let clickableBtn = foundButton;
    if (foundButton.tagName === 'svg' || foundButton.tagName === 'SVG' || 
        foundButton.tagName === 'SPAN' || foundButton.tagName === 'DIV') {
        console.log('  元素不是 BUTTON，查找父元素...');
        
        const parent1 = foundButton.closest('button');
        const parent2 = foundButton.closest('div[role="button"]');
        const parent3 = foundButton.closest('div[class*="Button"]');
        const parent4 = foundButton.closest('div[class*="send"]');
        const parent5 = foundButton.closest('div[class*="slot"]');
        const parent6 = foundButton.parentElement;
        
        console.log('  closest("button"):', parent1 ? `${parent1.tagName}.${parent1.className}` : 'null');
        console.log('  closest("div[role=button]"):', parent2 ? `${parent2.tagName}.${parent2.className}` : 'null');
        console.log('  closest("div[class*=Button]"):', parent3 ? `${parent3.tagName}.${parent3.className}` : 'null');
        console.log('  closest("div[class*=send]"):', parent4 ? `${parent4.tagName}.${parent4.className}` : 'null');
        console.log('  closest("div[class*=slot]"):', parent5 ? `${parent5.tagName}.${parent5.className}` : 'null');
        console.log('  parentElement:', parent6 ? `${parent6.tagName}.${parent6.className}` : 'null');
        
        clickableBtn = parent1 || parent2 || parent3 || parent4 || parent5 || parent6;
    }
    
    if (clickableBtn) {
        console.log('\n最终可点击元素:', clickableBtn.tagName, clickableBtn.className);
        console.log('\n=== 测试点击 ===');
        console.log('准备点击按钮...');
        
        // 测试点击序列
        try {
            console.log('1. mousedown...');
            clickableBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            
            setTimeout(() => {
                console.log('2. mouseup...');
                clickableBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                
                setTimeout(() => {
                    console.log('3. click event...');
                    clickableBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    
                    setTimeout(() => {
                        console.log('4. click()...');
                        if (typeof clickableBtn.click === 'function') {
                            clickableBtn.click();
                            console.log('✓ 点击完成！请检查千问是否提交了问题。');
                        } else {
                            console.log('✗ 元素没有 click() 方法');
                        }
                    }, 50);
                }, 50);
            }, 50);
        } catch (e) {
            console.log('✗ 点击失败:', e.message);
        }
    } else {
        console.log('✗ 无法找到可点击的父元素');
    }
} else {
    console.log('✗ 没有找到可用的按钮');
    console.log('\n尝试查找所有可能的发送按钮：');
    
    const allButtons = document.querySelectorAll('button, div[role="button"], [class*="send"], [class*="Send"], [class*="submit"]');
    console.log(`找到 ${allButtons.length} 个可能的按钮元素`);
    
    Array.from(allButtons).forEach((btn, idx) => {
        const text = (btn.innerText || btn.textContent || '').trim();
        const hasSvg = btn.querySelector('svg');
        if (text.length < 20 || hasSvg) {
            console.log(`${idx + 1}. ${btn.tagName}.${btn.className}`);
            console.log(`   文本: "${text}"`);
            console.log(`   有SVG: ${hasSvg ? '是' : '否'}`);
            if (hasSvg) {
                const svg = btn.querySelector('svg');
                console.log(`   SVG data-icon-type: ${svg.getAttribute('data-icon-type')}`);
            }
        }
    });
}

console.log('\n=== 检查输入框 ===\n');

const inputSelectors = [
    'div[role="textbox"]',
    'div[data-placeholder*="千问"]',
    'div[data-slate-editor="true"]',
    'textarea#msg-input',
    'textarea'
];

inputSelectors.forEach((sel, idx) => {
    try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
            const el = elements[elements.length - 1];
            const text = (el.innerText || el.textContent || el.value || '').trim();
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   找到: ${elements.length} 个元素`);
            console.log(`   内容长度: ${text.length}`);
            console.log(`   内容预览: "${text.substring(0, 50)}..."`);
        }
    } catch (e) {}
});
