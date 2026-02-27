// 在 Kimi 页面的控制台运行此脚本来测试响应选择器

console.log('=== Kimi 响应选择器测试 ===\n');

const selectors = [
    'div[class*="segment"][class*="assistant"]',
    '[class*="chat-segment"][class*="assistant"]',
    '[class*="message-segment"][class*="assistant"]',
    '[class*="message-item"][class*="assistant"]',
    '[class*="msg"][class*="assistant"]',
    '.markdown-body'
];

console.log('测试', selectors.length, '个选择器：\n');

selectors.forEach((sel, idx) => {
    try {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
            const el = elements[elements.length - 1];
            const text = (el.innerText || el.textContent || '').trim();
            
            // 检查是否包含思考过程
            const hasThinking = el.querySelector('[class*="thinking"]') || 
                               el.querySelector('[class*="thought"]') ||
                               el.querySelector('[class*="k25-thought"]');
            
            // 检查是否包含表格
            const hasTable = el.querySelector('table');
            
            // 检查子元素数量
            const childCount = el.children.length;
            
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   找到: ${elements.length} 个元素`);
            console.log(`   文本长度: ${text.length}`);
            console.log(`   包含思考过程: ${hasThinking ? '是' : '否'}`);
            console.log(`   包含表格: ${hasTable ? '是' : '否'}`);
            console.log(`   子元素数量: ${childCount}`);
            console.log(`   元素类名: ${el.className}`);
            console.log(`   文本预览: ${text.substring(0, 150)}...\n`);
        } else {
            console.log(`${idx + 1}. ${sel}`);
            console.log(`   找到: 0 个元素\n`);
        }
    } catch (e) {
        console.log(`${idx + 1}. ${sel}`);
        console.log(`   错误: ${e.message}\n`);
    }
});

// 额外测试：查找所有可能的助手消息容器
console.log('\n=== 查找所有可能的助手消息容器 ===\n');

const allElements = document.querySelectorAll('[class*="segment"], [class*="message"]');
console.log(`找到 ${allElements.length} 个可能的消息元素`);

const assistantElements = Array.from(allElements).filter(el => {
    const className = el.className.toLowerCase();
    return className.includes('assistant') || className.includes('ai');
});

console.log(`其中 ${assistantElements.length} 个包含 "assistant" 或 "ai"`);

if (assistantElements.length > 0) {
    const lastAssistant = assistantElements[assistantElements.length - 1];
    console.log('\n最后一个助手消息元素：');
    console.log('  类名:', lastAssistant.className);
    console.log('  标签:', lastAssistant.tagName);
    console.log('  文本长度:', (lastAssistant.innerText || '').length);
    console.log('  子元素数量:', lastAssistant.children.length);
    
    // 列出所有子元素
    console.log('\n  子元素列表：');
    Array.from(lastAssistant.children).forEach((child, idx) => {
        const text = (child.innerText || child.textContent || '').trim();
        console.log(`    ${idx + 1}. ${child.tagName}.${child.className} - ${text.length} 字符`);
        if (text.length > 0) {
            console.log(`       预览: ${text.substring(0, 100)}...`);
        }
    });
}
